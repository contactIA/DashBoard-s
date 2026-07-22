// Reverte o arquivamento feito por ENGANO em scripts/cleanup-dupes-ibs.mjs —
// aquele script rodou contra o painel da LUMINE (por usar o .env genérico
// errado), não a IBS. Desarquiva os 2 cards de volta (archived: false).
const HELENA = 'https://api.wts.chat'
const token = process.env.HELENA_TOKEN
const APPLY = process.argv.includes('--apply')
if (!token) { console.error('Defina HELENA_TOKEN.'); process.exit(1) }
const auth = token.startsWith('Bearer') ? token : `Bearer ${token}`

const CARD_IDS = [
  '5c0aa6e9-3879-4871-a718-ff8141b7f612', // Thiago Dutra Motterle
  'f467a30f-1a32-49ea-97d2-6d0712d336ee', // Roseli dos Santos de Lima
]

async function helena(method, path, body) {
  const res = await fetch(`${HELENA}${path}`, {
    method, headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`)
  try { return JSON.parse(text) } catch { return null }
}

console.log(`Modo: ${APPLY ? 'APLICANDO' : 'DRY-RUN'}\n`)
for (const id of CARD_IDS) {
  const card = await helena('GET', `/crm/v1/panel/card/${id}`)
  console.log(`${card.title}: archived=${card.archived}`)
  if (APPLY && card.archived) {
    await helena('PUT', `/crm/v2/panel/card/${id}`, { fields: ['archived'], archived: false })
    console.log('  ✅ desarquivado')
  }
}
