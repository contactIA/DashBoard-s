// Serve a planilha da frota Clinicorp (nome, token, usuário API, agenda, ID
// Helena) para a tela /setup "Importar Clinicorp" — os dados reais ficam só
// na env var CLINICORP_DIRECTORY_JSON (servidor), nunca no bundle do frontend.
export default async function handler(req, res) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return res.status(500).json({ error: 'ADMIN_SECRET não configurado no servidor.' })
  if (req.headers['x-admin-secret'] !== secret) return res.status(401).json({ error: 'Não autorizado.' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })

  let directory = []
  try {
    directory = JSON.parse(process.env.CLINICORP_DIRECTORY_JSON ?? '[]')
  } catch {
    return res.status(500).json({ error: 'CLINICORP_DIRECTORY_JSON inválido no servidor.' })
  }

  return res.status(200).json({ directory })
}
