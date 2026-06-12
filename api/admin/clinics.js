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

function validatePayload(body, { requireToken }) {
  const errors = []
  if (!body.accountId) errors.push('accountId é obrigatório')
  if (!body.name?.trim()) errors.push('name é obrigatório')
  if (requireToken && !normalizeToken(body.token)) errors.push('token é obrigatório')
  if (!body.panelId) errors.push('panelId é obrigatório')
  if (!body.steps || typeof body.steps !== 'object' || Object.keys(body.steps).length === 0) {
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
      const rows = await sb('/clinics?select=account_id,name,token,panel_id,ticket,steps&order=name.asc')
      return res.status(200).json({
        clinics: rows.map(r => ({
          accountId:   r.account_id,
          name:        r.name,
          tokenMasked: maskToken(r.token),
          panelId:     r.panel_id,
          ticket:      r.ticket,
          steps:       r.steps,
        })),
      })
    }

    // ── Criar ────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body ?? {}
      const errors = validatePayload(body, { requireToken: true })
      if (errors.length) return res.status(400).json({ error: errors.join('; ') })

      const existing = await sb(`/clinics?account_id=eq.${encodeURIComponent(body.accountId)}&select=account_id&limit=1`)
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Já existe uma clínica cadastrada para este accountId. Use a edição.' })
      }

      const [row] = await sb('/clinics', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          account_id: body.accountId,
          name:       body.name.trim(),
          token:      normalizeToken(body.token),
          panel_id:   body.panelId,
          ticket:     body.ticket ?? null,
          steps:      body.steps,
        }),
      })
      return res.status(201).json({ accountId: row.account_id })
    }

    // ── Atualizar ────────────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const body = req.body ?? {}
      const errors = validatePayload(body, { requireToken: false })
      if (errors.length) return res.status(400).json({ error: errors.join('; ') })

      const patch = {
        name:     body.name.trim(),
        panel_id: body.panelId,
        ticket:   body.ticket ?? null,
        steps:    body.steps,
      }
      const token = normalizeToken(body.token)
      if (token) patch.token = token // token vazio = manter o atual

      const rows = await sb(`/clinics?account_id=eq.${encodeURIComponent(body.accountId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      })
      if (!rows?.length) return res.status(404).json({ error: 'Clínica não encontrada.' })
      return res.status(200).json({ accountId: rows[0].account_id })
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
