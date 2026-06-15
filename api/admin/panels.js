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

      // Amostra de cards (até 3 páginas) para o wizard: preview de extração,
      // distribuição por step e tags de card.
      let cards = []
      try {
        for (let pg = 1; pg <= 3; pg++) {
          const page = await helenaGet(`/crm/v1/panel/card?PanelId=${encodeURIComponent(panelId)}&PageSize=100&PageNumber=${pg}`, token)
          cards = cards.concat(page.items ?? [])
          if (!page.hasMorePages) break
        }
      } catch { /* sem amostra — wizard ainda funciona, só sem preview */ }

      const stepTitle = Object.fromEntries((panel.steps ?? []).map(s => [s.id, s.title]))

      // As tags de CARD não têm nome via API. Para sugerir o que cada uma
      // representa, cruzamos com as tags de CONTATO (essas têm nome) por
      // co-ocorrência numa amostra de contatos.
      let contactTagName = {}
      try {
        const tg = await helenaGet('/core/v1/tag?PageSize=200', token)
        const rows = Array.isArray(tg) ? tg : (tg.items ?? [])
        contactTagName = Object.fromEntries(rows.map(t => [t.id, t.name]))
      } catch { /* sem nomes de contato — segue sem sugestão */ }

      const sampleForCooc = cards.slice(0, 60)
      const contactIds = [...new Set(sampleForCooc.flatMap(c => c.contactIds ?? []))].slice(0, 80)
      const contactTags = {}
      await Promise.all(contactIds.map(async (id) => {
        try {
          const ct = await helenaGet(`/core/v1/contact/${encodeURIComponent(id)}`, token)
          contactTags[id] = (ct.tagIds ?? []).map(t => contactTagName[t]).filter(Boolean)
        } catch { contactTags[id] = [] }
      }))

      // Agrega por tag de card: contagem, steps, títulos e nomes co-ocorrentes
      const tagAgg = {}
      const touch = (tid, c) => {
        const e = tagAgg[tid] ?? (tagAgg[tid] = { id: tid, count: 0, steps: {}, titles: [], cooc: {} })
        e.count++
        const st = stepTitle[c.stepId]
        if (st) e.steps[st] = (e.steps[st] ?? 0) + 1
        if (c.title && e.titles.length < 3 && !e.titles.includes(c.title)) e.titles.push(c.title)
        return e
      }
      for (const c of cards) for (const tid of c.tagIds ?? []) touch(tid, c)
      for (const c of sampleForCooc) {
        const names = (c.contactIds ?? []).flatMap(id => contactTags[id] ?? [])
        for (const tid of c.tagIds ?? []) {
          const e = tagAgg[tid]; if (!e) continue
          for (const nm of names) e.cooc[nm] = (e.cooc[nm] ?? 0) + 1
        }
      }

      // nomes genéricos de funil/IA que não servem como rótulo de dimensão
      const GENERIC = /usada pela ia|frio|tag agendou|urg[êe]ncia|compromisso|agendad|compareceu|faltou|reagend|n[ãa]o agendad|pendente|cliente|oportunidade|venda|desqualific|desmarcou|sem intera|viajando|inadimplente|perdid|conv[êe]nio|servi[çc]o|curr[íi]culo|curso|dor |aquecer|engano|tratativa|honra|contato futur/i

      const tags = Object.values(tagAgg).sort((a, b) => b.count - a.count).map(e => {
        const topSteps = Object.entries(e.steps).sort((a, b) => b[1] - a[1])
        const isSource = /lead|n[ãa]o agend/i.test(topSteps[0]?.[0] ?? '')
        const cooc = Object.entries(e.cooc).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }))
        const cleanSource = cooc.find(x => !GENERIC.test(x.name))      // ex: Meta, Orgânico
        // tag de contato co-ocorrente nº1 é "Agendou IA" ⇒ agendador IA
        const strongIA = cooc[0] && /agendou ia/i.test(cooc[0].name)
        let suggestion = null
        if (isSource && cleanSource) suggestion = { dim: 'Origem', value: cleanSource.name }
        else if (strongIA) suggestion = { dim: 'Agendador', value: 'IA' }
        return {
          id:           e.id,
          count:        e.count,
          steps:        topSteps.slice(0, 3).map(([title, n]) => ({ title, n })),
          sampleTitles: e.titles,
          coTags:       cooc.slice(0, 3),
          suggestion,
        }
      })

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
