import { extractCard, computeDims } from '../src/utils/extract.js'

const HELENA_BASE   = 'https://api.wts.chat'
const SUPABASE_URL  = process.env.SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY
const PAGE_SIZE     = 100

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Chaves reservadas dentro do JSONB `steps` — não são etapas, e sim config v2.
const RESERVED_KEYS = new Set(['_extract', '_dims', '_funnel'])

// Garante o prefixo "Bearer " no token (o mesmo cuidado do admin/panels.js).
function normalizeToken(raw) {
  if (!raw) return null
  const t = String(raw).trim()
  if (!t) return null
  return /^bearer /i.test(t) ? t : `Bearer ${t}`
}

// Aceita o account_id (UUID) ou o slug amigável da clínica
async function getClinicConfig(idOrSlug) {
  const field = UUID_RE.test(idOrSlug) ? 'account_id' : 'slug'
  const url = `${SUPABASE_URL}/rest/v1/clinics?${field}=eq.${encodeURIComponent(idOrSlug)}&select=*&limit=1`

  const res = await fetch(url, {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  })

  const body = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`)
  return JSON.parse(body)[0] ?? null
}

async function fetchPage(panelId, token, pageNumber) {
  const qs = new URLSearchParams({
    PanelId:    panelId,
    PageSize:   String(PAGE_SIZE),
    PageNumber: String(pageNumber),
    IncludeDetails: 'Contacts', // traz card.contacts (id + nome do contato vinculado)
  })
  const res = await fetch(`${HELENA_BASE}/crm/v1/panel/card?${qs}`, {
    headers: { Authorization: token },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Helena API ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

// contactIds (array de UUIDs) sempre vem no card; contacts (array expandido com
// nome, via IncludeDetails=Contacts) é o preferido, mas usamos contactIds como
// fallback pra identificar o contato principal caso o expandido não venha.
function primaryContactId(card) {
  return card.contacts?.[0]?.id ?? card.contactIds?.[0] ?? null
}

// Telefone do contato não vem na listagem de cards — exige uma chamada por
// contato. Falha de forma silenciosa (cai no telefone extraído do texto, se
// configurado como fallback).
async function fetchContact(id, token) {
  try {
    const res = await fetch(`${HELENA_BASE}/core/v1/contact/${encodeURIComponent(id)}`, {
      headers: { Authorization: token },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

const CONTACT_FETCH_CONCURRENCY = 15
const CONTACT_LOOKBACK_DAYS = 90

async function fetchContactsByIds(ids, token) {
  const idList = [...ids]
  const byId = {}
  for (let i = 0; i < idList.length; i += CONTACT_FETCH_CONCURRENCY) {
    const batch = idList.slice(i, i + CONTACT_FETCH_CONCURRENCY)
    const results = await Promise.all(batch.map(id => fetchContact(id, token)))
    batch.forEach((id, j) => { if (results[j]) byId[id] = results[j] })
  }
  return byId
}

// Resolve os títulos das etapas do painel — usado só para rotular cards em
// steps não mapeados (diagnóstico). Falha de forma silenciosa.
async function fetchStepTitles(panelId, token) {
  try {
    const res = await fetch(
      `${HELENA_BASE}/crm/v1/panel/${encodeURIComponent(panelId)}?IncludeDetails=Steps`,
      { headers: { Authorization: token } },
    )
    if (!res.ok) return {}
    const panel = await res.json()
    return Object.fromEntries((panel.steps ?? []).map(s => [s.id, s.title]))
  } catch {
    return {}
  }
}

// ── Fallback legado (clínicas sem config _extract) ───────────────────────────
function parseDescription(description) {
  if (!description) return null
  const dateMatch = description.match(/Data de agendamento:\s*(\d{4}-\d{2}-\d{2})/)
  const timeMatch = description.match(/Horário de atendimento:\s*(\d{2}:\d{2})/)
  if (!dateMatch) return null
  return { date: dateMatch[1], time: timeMatch?.[1] ?? null }
}

function parseTitleAppointment(title) {
  if (!title) return null
  const parts = title.split(',').map(p => p.trim())
  if (parts.length < 3) return null
  const date = parts[parts.length - 1].match(/^(\d{4}-\d{2}-\d{2})$/)?.[1]
  if (!date) return null
  const time = parts.map(p => p.match(/^(\d{2}:\d{2})$/)?.[1]).find(Boolean) ?? null
  return { date, time }
}

// ── Dimensões (cortes do funil) ──────────────────────────────────────────────
//
// _dims: { <chave>: { label, source, values?, rules? } }
//   source 'tag'           → values: { <tagId>: 'Rótulo' }  (casa contra card.tagIds)
//   source 'metadata.<x>'  → rules:  [ { match, value } ]   (substring em metadata.x)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const accountId = req.query.accountId ?? req.query.clinic
  if (!accountId) {
    return res.status(400).json({ error: 'Parâmetro "clinic" (slug) ou "accountId" (uuid) obrigatório. Ex: ?clinic=minha-clinica' })
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Variáveis de ambiente não configuradas no servidor.' })
  }

  const config = await getClinicConfig(accountId).catch(err => {
    throw new Error(`Supabase fetch falhou: ${err.message}`)
  })

  if (!config) {
    return res.status(404).json({ error: `Clínica "${accountId}" não encontrada.` })
  }

  const token       = normalizeToken(config.token)
  const rawSteps    = config.steps ?? {}             // JSONB do Supabase
  const extractCfg  = rawSteps._extract ?? null
  const dimsCfg     = rawSteps._dims ?? null
  const funnelCfg   = rawSteps._funnel ?? null
  // Steps "de verdade" (sem as chaves reservadas de config)
  const steps = Object.fromEntries(
    Object.entries(rawSteps).filter(([k]) => !RESERVED_KEYS.has(k))
  )

  try {
    const first      = await fetchPage(config.panel_id, token, 1)
    const totalPages = first.totalPages ?? 1

    let items = [...(first.items ?? [])]

    if (totalPages > 1) {
      const pages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetchPage(config.panel_id, token, i + 2)
        )
      )
      for (const page of pages) items = items.concat(page.items ?? [])
    }

    // Telefone do contato vinculado exige 1 chamada por contato — só vale a pena
    // se a clínica realmente configurou essa fonte, e só para cards recentes
    // (histórico mais antigo não precisa: dashboard novo, sem uso além disso).
    const usesContactPhone = (extractCfg?.phone ?? []).some(r => r.from === 'contactPhone')
    let contactById = {}
    if (usesContactPhone) {
      const cutoff = new Date(Date.now() - CONTACT_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10)
      const recentContactIds = new Set()
      for (const item of items) {
        const effective = (item.dueDate ?? item.updatedAt ?? item.createdAt ?? '').slice(0, 10)
        if (effective < cutoff) continue
        const id = primaryContactId(item)
        if (id) recentContactIds.add(id)
      }
      contactById = await fetchContactsByIds(recentContactIds, token)
    }

    const stepLookup = Object.fromEntries(
      Object.entries(steps).map(([key, s]) => [
        s.id,
        { key, label: s.label, color: s.color, type: s.type },
      ])
    )

    const cards = items.map(card => {
      const cardContactId = primaryContactId(card)
      const contactPhone = cardContactId
        ? contactById[cardContactId]?.phoneNumberFormatted ?? contactById[cardContactId]?.phoneNumber ?? null
        : null
      const cardForExtract = extractCfg ? { ...card, contactPhone } : card
      const appt = extractCfg
        ? extractCard(cardForExtract, extractCfg)
        : { ...(parseDescription(card.description) ?? parseTitleAppointment(card.title) ?? { date: null, time: null }), name: null, phone: null }

      const step = stepLookup[card.stepId] ?? null

      return {
        id:        card.id,
        title:     card.title ?? null,
        name:      appt.name  ?? null,
        phone:     appt.phone ?? null,
        stepKey:   step?.key   ?? null,
        stepLabel: step?.label ?? null,
        stepType:  step?.type  ?? null,
        stepColor: step?.color ?? null,
        date:      appt?.date  ?? null,
        time:      appt?.time  ?? null,
        value:     card.monetaryAmount ?? null,
        createdAt: card.createdAt ?? null,
        updatedAt: card.updatedAt ?? null,
        dims:      computeDims(card, dimsCfg),
      }
    })

    // ── Diagnóstico: nada some em silêncio ───────────────────────────────────
    const unmappedByStep = {}
    for (const card of items) {
      if (stepLookup[card.stepId]) continue
      const e = unmappedByStep[card.stepId] ?? { stepId: card.stepId, label: null, count: 0 }
      e.count++
      unmappedByStep[card.stepId] = e
    }
    const unmapped = Object.values(unmappedByStep)
    if (unmapped.length) {
      const titles = await fetchStepTitles(config.panel_id, token)
      for (const u of unmapped) u.label = titles[u.stepId] ?? null
    }

    const diagnostics = {
      total:         cards.length,
      noDate:        cards.filter(c => !c.date).length,
      unmappedCount: unmapped.reduce((s, u) => s + u.count, 0),
      unmapped:      unmapped.sort((a, b) => b.count - a.count),
    }

    // Definição das dimensões para o frontend renderizar quebras genericamente
    const dimensions = dimsCfg
      ? Object.fromEntries(Object.entries(dimsCfg).map(([k, def]) => {
          const values = def.source === 'tag'
            ? [...new Set(Object.values(def.values ?? {}))]
            : [...new Set((def.rules ?? []).map(r => r.value))]
          return [k, { label: def.label ?? k, values, isUnit: def.isUnit ?? false }]
        }))
      : {}

    const closedWithValue = cards.filter(c => c.stepType === 'converted' && c.value > 0)
    const computedTicket  = closedWithValue.length > 0
      ? Math.round(closedWithValue.reduce((s, c) => s + c.value, 0) / closedWithValue.length)
      : (config.ticket ?? 10000)

    return res.status(200).json({
      clinic:     config.name,
      ticket:     computedTicket,
      steps,
      dimensions,
      funnelConfig: funnelCfg,
      cards,
      diagnostics,
      fetchedAt:  new Date().toISOString(),
    })
  } catch (err) {
    console.error('[dashboard]', err)
    return res.status(500).json({ error: err.message })
  }
}
