// Lista os usuários (CRCs) cadastrados nas contas Clinicorp de uma clínica —
// usado pelo /setup para sugerir o nome completo ao vincular a etiqueta da
// Helena ao usuário que agenda no Clinicorp (ex: digitar "gabriela" e achar
// "GABRIELA RONCATO"), em vez do admin ter que descobrir/digitar de cabeça.
import { makeClinicorpClient } from '../../src/server/clinicorp.js'

export default async function handler(req, res) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return res.status(500).json({ error: 'ADMIN_SECRET não configurado no servidor.' })
  if (req.headers['x-admin-secret'] !== secret) return res.status(401).json({ error: 'Não autorizado.' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  // Unidades vêm do próprio wizard (ainda não salvas ou já salvas — o front
  // sempre tem o estado atual em mãos), nunca lidas do Supabase aqui: evita
  // expor token de outra clínica e funciona também durante o cadastro (antes
  // de a clínica existir no banco).
  const units = Array.isArray(req.body?.units) ? req.body.units : []
  const usable = units.filter(u => u.user && u.token)
  if (!usable.length) return res.status(200).json({ users: [] })

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

  users.sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'))
  return res.status(200).json({ users, errors })
}
