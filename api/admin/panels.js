const HELENA_BASE = 'https://api.wts.chat'

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
      const panel = await helenaGet(`/crm/v1/panel/${encodeURIComponent(panelId)}?IncludeDetails=Steps`, token)

      // Amostra de cards (1ª página) para o wizard: preview de extração + tags de card.
      let cards = []
      try {
        const page = await helenaGet(`/crm/v1/panel/card?PanelId=${encodeURIComponent(panelId)}&PageSize=100&PageNumber=1`, token)
        cards = page.items ?? []
      } catch { /* sem amostra — wizard ainda funciona, só sem preview */ }

      // Tags de card distintas, com contagem e um título de exemplo
      const tagAgg = {}
      for (const c of cards) {
        for (const tid of c.tagIds ?? []) {
          const e = tagAgg[tid] ?? { id: tid, count: 0, sampleTitle: c.title ?? null }
          e.count++
          tagAgg[tid] = e
        }
      }
      const tags = Object.values(tagAgg).sort((a, b) => b.count - a.count)

      // Cards de amostra enxutos (só o necessário para o preview de extração)
      const sampleCards = cards.slice(0, 12).map(c => ({
        title:       c.title ?? null,
        description: c.description ?? null,
        tagIds:      c.tagIds ?? [],
        metadata:    c.metadata ?? null,
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
