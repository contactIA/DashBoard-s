const HELENA_BASE = 'https://api.wts.chat'

const stripAccents = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')

// Sugere a qual dimensão uma tag de card pertence, a partir do nome real dela.
// É só um chute para pré-preencher o wizard — o admin confirma/edita.
function suggestDimension(name) {
  const n = stripAccents(name).toLowerCase()
  if (/organico|\bmeta\b|google|facebook|instagram|\bads?\b|anuncio|trafego|campanha|indica/.test(n)) return { dim: 'Origem' }
  if (/\bia\b|\bcrc\b|humano|recep|secret|consultor|agendador|vendedor/.test(n)) return { dim: 'Agendador' }
  return null
}

function normalizeToken(raw) {
  if (!raw) return null
  const t = String(raw).trim()
  if (!t) return null
  return /^bearer /i.test(t) ? t : `Bearer ${t}`
}

async function helenaGet(path, token) {
  const res = await fetch(`${HELENA_BASE}${path}`, { headers: { Authorization: token } })
  const body = await res.text()
  if (!res.ok) {
    const err = new Error(
      res.status === 401
        ? 'Token Helena inválido ou sem permissão.'
        : `Helena API ${res.status}: ${body.slice(0, 200)}`
    )
    err.status = res.status === 401 ? 400 : 502
    throw err
  }
  return JSON.parse(body)
}

// Telefone do contato pro preview do wizard — best-effort, sem lançar erro.
async function fetchContactSafe(id, token) {
  try {
    const res = await fetch(`${HELENA_BASE}/core/v1/contact/${encodeURIComponent(id)}`, { headers: { Authorization: token } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Campos personalizados de card, cadastrados na conta Helena — pro wizard
// oferecer um dropdown em vez do admin ter que adivinhar/digitar a chave
// interna do campo. Busca os dois EntityType (PANEL e CONTACT) porque contas
// diferentes cadastram os campos de agendamento em um ou outro. Best-effort:
// sem isso o wizard ainda funciona (admin digita a key na mão).
async function fetchCustomFieldsSafe(token) {
  const oneType = async (entityType) => {
    try {
      const list = await helenaGet(`/core/v1/custom-field?EntityType=${entityType}`, token)
      return (list ?? []).map(f => ({ id: f.id, key: f.key ?? null, name: f.name ?? '(sem nome)', type: f.type ?? null, entityType }))
    } catch {
      return []
    }
  }
  const [panel, contact] = await Promise.all([oneType('PANEL'), oneType('CONTACT')])
  return [...panel, ...contact]
}

// Resolve o token da clínica já cadastrada (modo edição, sem re-digitar o token)
async function tokenFromSupabase(accountId) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/clinics?account_id=eq.${encodeURIComponent(accountId)}&select=token&limit=1`
  const res = await fetch(url, {
    headers: {
      'apikey':        process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}`)
  const rows = await res.json()
  return rows[0]?.token ?? null
}

export default async function handler(req, res) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return res.status(500).json({ error: 'ADMIN_SECRET não configurado no servidor.' })
  if (req.headers['x-admin-secret'] !== secret) return res.status(401).json({ error: 'Não autorizado.' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })

  const { panelId, accountId } = req.query

  let token = normalizeToken(req.headers['x-helena-token'])
  if (!token && accountId) token = normalizeToken(await tokenFromSupabase(accountId).catch(() => null))
  if (!token) return res.status(400).json({ error: 'Informe o token Helena (header "x-helena-token") ou um accountId já cadastrado.' })

  try {
    // ── Painel específico, com steps + amostra de cards e tags ────────────────
    if (panelId) {
      // IncludeDetails=Tags traz as etiquetas de CARD já nomeadas (com cor).
      // São um registro separado das etiquetas de contato (/core/v1/tag).
      const [panel, customFields] = await Promise.all([
        helenaGet(`/crm/v1/panel/${encodeURIComponent(panelId)}?IncludeDetails=Steps&IncludeDetails=Tags`, token),
        fetchCustomFieldsSafe(token),
      ])

      // Amostra de cards (até 3 páginas) para o wizard: preview de extração
      // e estatística de uso de cada tag de card.
      let cards = []
      try {
        for (let pg = 1; pg <= 3; pg++) {
          const page = await helenaGet(`/crm/v1/panel/card?PanelId=${encodeURIComponent(panelId)}&PageSize=100&PageNumber=${pg}&IncludeDetails=Contacts&IncludeDetails=CustomFields`, token)
          cards = cards.concat(page.items ?? [])
          if (!page.hasMorePages) break
        }
      } catch { /* sem amostra — wizard ainda funciona, só sem preview */ }

      const stepTitle = Object.fromEntries((panel.steps ?? []).map(s => [s.id, s.title]))

      // Uso de cada tag de card na amostra: quantos cards e em quais steps.
      const usage = {}
      for (const c of cards) {
        for (const tid of c.tagIds ?? []) {
          const e = usage[tid] ?? (usage[tid] = { count: 0, steps: {} })
          e.count++
          const st = stepTitle[c.stepId]
          if (st) e.steps[st] = (e.steps[st] ?? 0) + 1
        }
      }

      // Tags de card nomeadas, ordenadas por volume de uso.
      const tags = (panel.tags ?? [])
        .map(t => {
          const u = usage[t.id] ?? { count: 0, steps: {} }
          const steps = Object.entries(u.steps).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([title, n]) => ({ title, n }))
          return {
            id:         t.id,
            name:       (t.name ?? '').trim() || '(sem nome)',
            color:      t.bgColor ?? null,
            textColor:  t.nameColor ?? null,
            count:      u.count,
            steps,
            suggestion: suggestDimension(t.name ?? ''),
          }
        })
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

      // Cards de amostra enxutos (só o necessário para o preview de extração).
      // N pequeno (até 12) — busca o telefone real do contato vinculado de cada
      // um, pro preview mostrar o valor de verdade quando essa fonte for escolhida.
      const sample = cards.slice(0, 12)
      const contactsForPreview = await Promise.all(
        sample.map(c => {
          const id = c.contacts?.[0]?.id ?? c.contactIds?.[0] ?? null
          return id ? fetchContactSafe(id, token) : Promise.resolve(null)
        })
      )
      const sampleCards = sample.map((c, i) => ({
        title:        c.title ?? null,
        description:  c.description ?? null,
        tagIds:       c.tagIds ?? [],
        metadata:     c.metadata ?? null,
        customFields: c.customFields ?? null,
        dueDate:      c.dueDate ?? null,
        contacts:     c.contacts ?? [],
        contactPhone: contactsForPreview[i]?.phoneNumberFormatted ?? contactsForPreview[i]?.phoneNumber ?? null,
      }))

      return res.status(200).json({
        id:        panel.id,
        title:     panel.title,
        companyId: panel.companyId,
        steps: (panel.steps ?? [])
          .filter(s => !s.archived)
          .sort((a, b) => a.position - b.position)
          .map(s => ({ id: s.id, title: s.title, position: s.position, cardCount: s.cardCount })),
        tags,
        sampleCards,
        customFields,
      })
    }

    // ── Listagem de todos os painéis (paginado) ──────────────────────────────
    let pageNumber = 1
    let hasMore = true
    let items = []
    while (hasMore && pageNumber <= 10) {
      const page = await helenaGet(`/crm/v1/panel?PageSize=100&PageNumber=${pageNumber}`, token)
      items = items.concat(page.items ?? [])
      hasMore = page.hasMorePages === true
      pageNumber++
    }

    return res.status(200).json({
      panels: items
        .filter(p => !p.archived)
        .map(p => ({
          id:          p.id,
          title:       p.title,
          description: p.description,
          key:         p.key,
          scope:       p.scope,
          companyId:   p.companyId,
        })),
    })
  } catch (err) {
    return res.status(err.status ?? 500).json({ error: err.message })
  }
}
