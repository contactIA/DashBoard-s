const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

function sbHeaders(extra = {}) {
  return {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type':  'application/json',
    ...extra,
  }
}

async function sb(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { ...init, headers: sbHeaders(init.headers) })
  const body = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`)
  return body ? JSON.parse(body) : null
}

function normalizeToken(raw) {
  if (!raw) return null
  const t = String(raw).trim()
  if (!t) return null
  return /^bearer /i.test(t) ? t : `Bearer ${t}`
}

function maskToken(token) {
  if (!token) return null
  const raw = token.replace(/^bearer\s+/i, '')
  return `${raw.slice(0, 8)}…${raw.slice(-4)}`
}

// ── Token Clinicorp: mascarado na leitura, restaurado na escrita ─────────────
// O GET admin nunca devolve o token real das unidades Clinicorp (mesmo modelo
// do token Helena). Como o wizard reenvia o `steps` inteiro no PUT, o servidor
// detecta o token mascarado (contém "…" — tokens reais são UUIDs) ou vazio e
// restaura o valor real da unidade correspondente (casada pelo Usuário API).
const isMaskedToken = (t) => !t || String(t).includes('…')

function maskClinicorpUnits(steps) {
  const cc = steps?._clinicorp
  if (!cc?.units?.length) return steps
  return {
    ...steps,
    _clinicorp: { ...cc, units: cc.units.map(u => ({ ...u, token: maskToken(u.token) })) },
  }
}

// Retorna { steps, errors[] } — erro quando um token mascarado não tem unidade
// anterior para restaurar (ex: admin trocou o Usuário API sem redigitar o token).
function restoreClinicorpTokens(incomingSteps, currentSteps) {
  const incoming = incomingSteps?._clinicorp?.units
  if (!incoming?.length) return { steps: incomingSteps, errors: [] }

  const prevByUser = Object.fromEntries(
    (currentSteps?._clinicorp?.units ?? []).map(u => [u.user, u])
  )
  const errors = []
  const units = incoming.map(u => {
    if (!isMaskedToken(u.token)) return u
    const prev = prevByUser[u.user]
    if (prev?.token) return { ...u, token: prev.token }
    errors.push(`Unidade "${u.label || u.user}": informe o Token API (não há token salvo para restaurar).`)
    return u
  })
  return { steps: { ...incomingSteps, _clinicorp: { ...incomingSteps._clinicorp, units } }, errors }
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

function validatePayload(body, { requireToken }) {
  const errors = []
  if (!body.accountId) errors.push('accountId é obrigatório')
  if (!body.name?.trim()) errors.push('name é obrigatório')
  if (!body.slug || !SLUG_RE.test(body.slug)) {
    errors.push('slug é obrigatório (apenas letras minúsculas, números e hífens, ex: minha-clinica)')
  }
  if (requireToken && !normalizeToken(body.token)) errors.push('token é obrigatório')
  if (!body.panelId) errors.push('panelId é obrigatório')
  const realSteps = body.steps && typeof body.steps === 'object'
    ? Object.keys(body.steps).filter(k => !k.startsWith('_'))
    : []
  if (!realSteps.length) {
    errors.push('steps deve conter ao menos uma etapa mapeada')
  }
  return errors
}

export default async function handler(req, res) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return res.status(500).json({ error: 'ADMIN_SECRET não configurado no servidor.' })
  if (req.headers['x-admin-secret'] !== secret) return res.status(401).json({ error: 'Não autorizado.' })
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Variáveis de ambiente do Supabase não configuradas.' })
  }

  try {
    // ── Listar ───────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const rows = await sb('/clinics?select=*&order=name.asc')
      return res.status(200).json({
        clinics: rows.map(r => ({
          accountId:   r.account_id,
          name:        r.name,
          slug:        r.slug ?? null,
          tokenMasked: maskToken(r.token),
          panelId:     r.panel_id,
          ticket:      r.ticket,
          steps:       maskClinicorpUnits(r.steps),
        })),
      })
    }

    // ── Criar ────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body ?? {}
      const errors = validatePayload(body, { requireToken: true })
      // No cadastro não existe token salvo para restaurar — mascarado é erro
      for (const u of body.steps?._clinicorp?.units ?? []) {
        if (isMaskedToken(u.token)) errors.push(`Unidade Clinicorp "${u.label || u.user}": informe o Token API completo.`)
      }
      if (errors.length) return res.status(400).json({ error: errors.join('; ') })

      const conflictFilter = `or=(account_id.eq.${encodeURIComponent(body.accountId)},slug.eq.${encodeURIComponent(body.slug)})`
      const existing = await sb(`/clinics?${conflictFilter}&select=account_id,slug&limit=1`)
      if (existing.length > 0) {
        const reason = existing[0].slug === body.slug
          ? `O slug "${body.slug}" já está em uso por outra clínica.`
          : 'Já existe uma clínica cadastrada para esta conta Helena. Use a edição.'
        return res.status(409).json({ error: reason })
      }

      const [row] = await sb('/clinics', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          account_id: body.accountId,
          name:       body.name.trim(),
          slug:       body.slug,
          token:      normalizeToken(body.token),
          panel_id:   body.panelId,
          ticket:     body.ticket ?? null,
          steps:      body.steps,
        }),
      })
      return res.status(201).json({ accountId: row.account_id, slug: row.slug })
    }

    // ── Atualizar ────────────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const body = req.body ?? {}
      const errors = validatePayload(body, { requireToken: false })
      if (errors.length) return res.status(400).json({ error: errors.join('; ') })

      const slugTaken = await sb(
        `/clinics?slug=eq.${encodeURIComponent(body.slug)}&account_id=neq.${encodeURIComponent(body.accountId)}&select=account_id&limit=1`
      )
      if (slugTaken.length > 0) {
        return res.status(409).json({ error: `O slug "${body.slug}" já está em uso por outra clínica.` })
      }

      // Tokens Clinicorp mascarados/vazios voltam do wizard — restaura os reais
      const [current] = await sb(`/clinics?account_id=eq.${encodeURIComponent(body.accountId)}&select=steps&limit=1`)
      if (!current) return res.status(404).json({ error: 'Clínica não encontrada.' })
      const restored = restoreClinicorpTokens(body.steps, current.steps)
      if (restored.errors.length) return res.status(400).json({ error: restored.errors.join('; ') })

      const patch = {
        name:     body.name.trim(),
        slug:     body.slug,
        panel_id: body.panelId,
        ticket:   body.ticket ?? null,
        steps:    restored.steps,
      }
      const token = normalizeToken(body.token)
      if (token) patch.token = token // token vazio = manter o atual

      const rows = await sb(`/clinics?account_id=eq.${encodeURIComponent(body.accountId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      })
      if (!rows?.length) return res.status(404).json({ error: 'Clínica não encontrada.' })
      return res.status(200).json({ accountId: rows[0].account_id, slug: rows[0].slug })
    }

    // ── Excluir ──────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { accountId } = req.query
      if (!accountId) return res.status(400).json({ error: 'Parâmetro "accountId" obrigatório.' })
      await sb(`/clinics?account_id=eq.${encodeURIComponent(accountId)}`, { method: 'DELETE' })
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (err) {
    console.error('[admin/clinics]', err)
    return res.status(500).json({ error: err.message })
  }
}
