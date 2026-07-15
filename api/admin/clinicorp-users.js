// Lista os usuários (CRCs) cadastrados nas contas Clinicorp de uma clínica —
// usado pelo /setup para sugerir o nome completo ao vincular a etiqueta da
// Helena ao usuário que agenda no Clinicorp (ex: digitar "gabriela" e achar
// "GABRIELA RONCATO"), em vez do admin ter que descobrir/digitar de cabeça.
import { makeClinicorpClient } from '../../src/server/clinicorp.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

// Mesmo critério de api/admin/clinics.js: token mascarado contém "…" (tokens
// reais do Clinicorp são UUIDs, nunca têm reticências) ou vem vazio.
const isMaskedToken = (t) => !t || String(t).includes('…')

// Em modo edição, o wizard só tem o token MASCARADO (o GET admin/clinics nunca
// devolve o real) — sem isso a Basic Auth falha com 401 em toda unidade já
// salva. Busca o token real no Supabase, casado por `user`, só para uso
// interno nesta chamada (nunca sai na resposta).
async function restoreRealTokens(units, accountId) {
  const needsRestore = units.some(u => isMaskedToken(u.token))
  if (!needsRestore || !accountId || !SUPABASE_URL || !SUPABASE_KEY) return units

  const res = await fetch(`${SUPABASE_URL}/rest/v1/clinics?account_id=eq.${encodeURIComponent(accountId)}&select=steps&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) return units
  const [row] = await res.json()
  const prevByUser = Object.fromEntries((row?.steps?._clinicorp?.units ?? []).map(u => [u.user, u]))

  return units.map(u => {
    if (!isMaskedToken(u.token)) return u
    const prev = prevByUser[u.user]
    return prev?.token ? { ...u, token: prev.token } : u
  })
}

export default async function handler(req, res) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return res.status(500).json({ error: 'ADMIN_SECRET não configurado no servidor.' })
  if (req.headers['x-admin-secret'] !== secret) return res.status(401).json({ error: 'Não autorizado.' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  // Unidades vêm do próprio wizard (estado atual em mãos); accountId (opcional
  // — ausente ao cadastrar clínica nova) permite restaurar o token real das
  // unidades já salvas, quando o wizard só tem a versão mascarada.
  const rawUnits = Array.isArray(req.body?.units) ? req.body.units : []
  const accountId = req.body?.accountId ?? null
  const units = await restoreRealTokens(rawUnits.filter(u => u.user), accountId)
  const usable = units.filter(u => u.user && !isMaskedToken(u.token))
  if (!usable.length) return res.status(200).json({ users: [], errors: [] })

  const seen = new Set()
  const users = []
  const errors = []

  await Promise.all(usable.map(async (u) => {
    try {
      const client = makeClinicorpClient({ user: u.user, token: u.token, subscriberId: u.user })
      const { list } = await client.users()
      for (const person of list ?? []) {
        const fullName = (person.FullName ?? '').trim()
        if (!fullName || seen.has(fullName)) continue
        seen.add(fullName)
        users.push({ fullName, userName: person.UserName ?? null, unit: u.label || u.user })
      }
    } catch (err) {
      errors.push(`[${u.label || u.user}] ${err.message}`)
    }
  }))

  // Unidades cujo token não pôde ser restaurado (mascarado sem correspondência
  // salva) — erro amigável em vez de 401 silencioso.
  for (const u of units) {
    if (isMaskedToken(u.token)) errors.push(`[${u.label || u.user}] token não disponível para buscar usuários — redigite o Token API desta unidade.`)
  }

  users.sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'))
  return res.status(200).json({ users, errors })
}
