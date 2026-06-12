const HELENA_BASE   = 'https://api.wts.chat'
const SUPABASE_URL  = process.env.SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY
const PAGE_SIZE     = 100

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  const res = await fetch(`${HELENA_BASE}/crm/v1/panel/card?${qs}`, {
    headers: { Authorization: token },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Helena API ${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

function parseDescription(description) {
  if (!description) return null
  const dateMatch = description.match(/Data de agendamento:\s*(\d{4}-\d{2}-\d{2})/)
  const timeMatch = description.match(/Horário de atendimento:\s*(\d{2}:\d{2})/)
  if (!dateMatch) return null
  return {
    date: dateMatch[1],
    time: timeMatch?.[1] ?? null,
  }
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

  const config = await getClinicConfig(accountId).catch(err => {
    throw new Error(`Supabase fetch falhou: ${err.message}`)
  })

  if (!config) {
    return res.status(404).json({ error: `Clínica "${accountId}" não encontrada.` })
  }

  const steps = config.steps // já é objeto (JSONB do Supabase)

  try {
    const first      = await fetchPage(config.panel_id, config.token, 1)
    const totalCards = first.total ?? first.totalCount ?? first.count ?? (first.items?.length ?? 0)
    const totalPages = Math.max(1, Math.ceil(totalCards / PAGE_SIZE))

    let items = [...(first.items ?? [])]

    if (totalPages > 1) {
      const pages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetchPage(config.panel_id, config.token, i + 2)
        )
      )
      for (const page of pages) items = items.concat(page.items ?? [])
    }

    const stepLookup = Object.fromEntries(
      Object.entries(steps).map(([key, s]) => [
        s.id,
        { key, label: s.label, color: s.color, type: s.type },
      ])
    )

    const cards = items.map(card => {
      const appt = parseDescription(card.description)
      const step = stepLookup[card.stepId] ?? null
      return {
        id:        card.id,
        title:     card.title ?? null,
        stepKey:   step?.key   ?? null,
        stepLabel: step?.label ?? null,
        stepType:  step?.type  ?? null,
        stepColor: step?.color ?? null,
        date:      appt?.date  ?? null,
        time:      appt?.time  ?? null,
        value:     card.monetaryAmount ?? null,
        createdAt: card.createdAt ?? null,
      }
    })

    const closedWithValue = cards.filter(c => c.stepType === 'converted' && c.value > 0)
    const computedTicket  = closedWithValue.length > 0
      ? Math.round(closedWithValue.reduce((s, c) => s + c.value, 0) / closedWithValue.length)
      : (config.ticket ?? 10000)

    return res.status(200).json({
      clinic:    config.name,
      ticket:    computedTicket,
      steps,
      cards,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[dashboard]', err)
    return res.status(500).json({ error: err.message })
  }
}
