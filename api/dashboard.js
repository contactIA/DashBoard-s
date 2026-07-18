import { extractCard, computeDims } from '../src/utils/extract.js'

const HELENA_BASE   = 'https://api.wts.chat'
const SUPABASE_URL  = process.env.SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY
const PAGE_SIZE     = 100

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Chaves reservadas dentro do JSONB `steps` — não são etapas, e sim config v2.
// Toda chave com prefixo "_" é config (_extract, _dims, _funnel, _clinicorp,
// _dates, _flags, _ignored, ...); etapa de verdade nunca começa com "_".
const isReservedKey = (k) => k.startsWith('_')

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
  })
  // Contacts: nome do contato vinculado. CustomFields: campos personalizados
  // configurados no painel Helena — ambos vêm de fora se não pedidos.
  qs.append('IncludeDetails', 'Contacts')
  qs.append('IncludeDetails', 'CustomFields')
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

// ── FASE A3: monta a resposta a partir da tabela `cards` do Supabase ─────────
// Mesmo formato do caminho Helena. stepType/label/cor são resolvidos AQUI
// (pelo mapeamento atual do /setup, não pelo step_type gravado na ingestão) —
// mudou o setup, a leitura já reflete sem esperar o próximo cron.
async function fetchAllCardRows(accountId) {
  const rows = []
  const CHUNK = 1000 // teto de linhas por resposta do PostgREST
  for (let offset = 0; ; offset += CHUNK) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/cards?account_id=eq.${encodeURIComponent(accountId)}&select=card_id,step_id,title,name,phone,date,time,scheduled_at,event_date,value,dims,created_at,updated_at&order=card_id`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Range: `${offset}-${offset + CHUNK - 1}` } }
    )
    const body = await res.text()
    if (!res.ok) throw new Error(`Supabase cards ${res.status}: ${body.slice(0, 200)}`)
    const page = JSON.parse(body)
    rows.push(...page)
    if (page.length < CHUNK) break
  }
  return rows
}

async function respondFromDb(res, config, { steps, dimsCfg, funnelCfg, flags, ignoredIds }) {
  const rows = await fetchAllCardRows(config.account_id)

  const stepLookup = Object.fromEntries(
    Object.entries(steps).map(([key, s]) => [s.id, { key, label: s.label, color: s.color, type: s.type }])
  )

  const cards = rows.map(r => {
    const step = stepLookup[r.step_id] ?? null
    return {
      id:          r.card_id,
      title:       r.title,
      name:        r.name,
      phone:       r.phone,
      stepKey:     step?.key ?? null,
      stepLabel:   step?.label ?? null,
      stepType:    step?.type ?? null,
      stepColor:   step?.color ?? null,
      date:        r.date,
      time:        r.time,
      value:       r.value != null ? Number(r.value) : null,
      createdAt:   r.created_at,
      updatedAt:   r.updated_at,
      eventDate:   r.event_date,
      scheduledAt: r.scheduled_at,
      dims:        r.dims ?? {},
    }
  })

  // Diagnóstico equivalente ao do caminho Helena (sem chamada extra para
  // títulos de step — etapa desconhecida aparece pelo stepId).
  const unmappedByStep = {}
  for (const r of rows) {
    if (stepLookup[r.step_id] || ignoredIds.has(r.step_id)) continue
    const e = unmappedByStep[r.step_id] ?? { stepId: r.step_id, label: null, count: 0 }
    e.count++
    unmappedByStep[r.step_id] = e
  }
  const unmapped = Object.values(unmappedByStep)
  const pastLead = cards.filter(c => c.stepType && c.stepType !== 'lead' && c.stepType !== 'notScheduled')
  const diagnostics = {
    total:         cards.length,
    noDate:        pastLead.filter(c => !c.date).length,
    noDateOf:      pastLead.length,
    unmappedCount: unmapped.reduce((s, u) => s + u.count, 0),
    unmapped:      unmapped.sort((a, b) => b.count - a.count),
  }

  const dimensions = dimsCfg
    ? Object.fromEntries(Object.entries(dimsCfg).map(([k, def]) => {
        let values
        if (def.source === 'tag') {
          values = [...new Set(Object.values(def.values ?? {}))]
        } else if (def.source?.startsWith('customFields.')) {
          const counts = new Map()
          for (const c of cards) {
            const v = c.dims?.[k]
            if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
          }
          values = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v)
        } else {
          values = [...new Set((def.rules ?? []).map(r => r.value))]
        }
        return [k, { label: def.label ?? k, values, isUnit: def.isUnit ?? false, source: def.source ?? 'tag' }]
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
    flags,
    cards,
    diagnostics,
    source:     'db',
    fetchedAt:  new Date().toISOString(),
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const accountId = req.query.accountId ?? req.query.clinic
  if (!accountId) {
    return res.status(400).json({ error: 'Parâmetro "clinic" (slug) ou "accountId" (uuid) obrigatório. Ex: ?clinic=minha-clinica' })
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Variáveis de ambiente não configuradas no servidor.' })
  }

  let config
  try {
    config = await getClinicConfig(accountId)
  } catch (err) {
    console.error('[dashboard] Supabase:', err)
    return res.status(500).json({ error: `Falha ao buscar a configuração da clínica: ${err.message}` })
  }

  if (!config) {
    return res.status(404).json({ error: `Clínica "${accountId}" não encontrada.` })
  }

  const token       = normalizeToken(config.token)
  const rawSteps    = config.steps ?? {}             // JSONB do Supabase
  const extractCfg  = rawSteps._extract ?? null
  const dimsCfg     = rawSteps._dims ?? null
  const funnelCfg   = rawSteps._funnel ?? null
  const flags       = rawSteps._flags ?? {}

  // ── Token de acesso por clínica (LGPD — dados de paciente no payload) ─────
  // Virada GRADUAL: só exige quando a clínica tem steps._flags.requireToken
  // ligado E a coluna access_token preenchida (supabase/access_token.sql).
  // URL passa a ser /?clinic=slug&t=<access_token>. Sem a flag, comportamento
  // atual (o UUID do accountId já funciona como capability não-adivinhável).
  if (flags.requireToken) {
    if (!config.access_token || req.query.t !== config.access_token) {
      return res.status(401).json({ error: 'Acesso negado — link inválido ou desatualizado. Solicite o link correto à Contact.' })
    }
  }
  // Etapas que o admin mandou ignorar no /setup — fora das métricas E fora do
  // aviso de "não mapeadas" (ignorar foi decisão, não drift).
  const ignoredIds  = new Set(rawSteps._ignored ?? [])
  // Steps "de verdade" (sem as chaves reservadas de config)
  const steps = Object.fromEntries(
    Object.entries(rawSteps).filter(([k]) => !isReservedKey(k))
  )

  // ── FASE A3: leitura da tabela `cards` (ingerida pelo cron) em vez da ─────
  // Helena ao vivo. Virada por clínica via steps._flags.readFromDb; overrides
  // para a validação-sombra: ?source=db força o caminho novo, ?source=helena
  // força o antigo (escape hatch com a flag ligada). Resposta tem o MESMO
  // formato — o front não distingue (campo extra `source` marca o caminho).
  const useDb = req.query.source === 'db' || (flags.readFromDb === true && req.query.source !== 'helena')
  if (useDb) {
    try {
      return await respondFromDb(res, config, { steps, dimsCfg, funnelCfg, flags, ignoredIds })
    } catch (err) {
      console.error('[dashboard/db]', err)
      return res.status(500).json({ error: `Falha lendo a base de cards: ${err.message}` })
    }
  }

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
        // data real do evento (gravada pelo sync Clinicorp no metadata) —
        // corrige a atribuição temporal de cards criados/movidos retroativamente
        eventDate: card.metadata?.clinicorp_event_date ?? null,
        // "Agendado em" — dia em que a CRC/IA/sync agendou (campo do card via
        // _extract.scheduledAt); usado no funil para a barra "Agendaram"
        scheduledAt: appt?.scheduledAt ?? null,
        dims:      computeDims(card, dimsCfg),
      }
    })

    // ── Diagnóstico: nada some em silêncio ───────────────────────────────────
    // Etapa em _ignored não é drift: o admin decidiu deixá-la fora no /setup.
    const unmappedByStep = {}
    for (const card of items) {
      if (stepLookup[card.stepId] || ignoredIds.has(card.stepId)) continue
      const e = unmappedByStep[card.stepId] ?? { stepId: card.stepId, label: null, count: 0 }
      e.count++
      unmappedByStep[card.stepId] = e
    }
    const unmapped = Object.values(unmappedByStep)
    if (unmapped.length) {
      const titles = await fetchStepTitles(config.panel_id, token)
      for (const u of unmapped) u.label = titles[u.stepId] ?? null
    }

    // noDate só acusa card que JÁ passou de lead: quem está em Leads/Não agendou
    // ainda não tem "Agendado Para" mesmo — falta de data ali não é problema.
    const pastLead = cards.filter(
      c => c.stepType && c.stepType !== 'lead' && c.stepType !== 'notScheduled'
    )
    const diagnostics = {
      total:         cards.length,
      noDate:        pastLead.filter(c => !c.date).length,
      noDateOf:      pastLead.length,
      unmappedCount: unmapped.reduce((s, u) => s + u.count, 0),
      unmapped:      unmapped.sort((a, b) => b.count - a.count),
    }

    // Definição das dimensões para o frontend renderizar quebras genericamente
    const dimensions = dimsCfg
      ? Object.fromEntries(Object.entries(dimsCfg).map(([k, def]) => {
          let values
          if (def.source === 'tag') {
            values = [...new Set(Object.values(def.values ?? {}))]
          } else if (def.source?.startsWith('customFields.')) {
            // Campo de valor livre (ex: Campanhas): sem lista fixa — os valores
            // são os distintos vistos nos cards, ordenados por contagem (mais
            // frequente primeiro).
            const counts = new Map()
            for (const c of cards) {
              const v = c.dims?.[k]
              if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
            }
            values = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v)
          } else {
            values = [...new Set((def.rules ?? []).map(r => r.value))]
          }
          return [k, { label: def.label ?? k, values, isUnit: def.isUnit ?? false, source: def.source ?? 'tag' }]
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
      flags,
      cards,
      diagnostics,
      source:     'helena',
      fetchedAt:  new Date().toISOString(),
    })
  } catch (err) {
    console.error('[dashboard]', err)
    return res.status(500).json({ error: err.message })
  }
}
