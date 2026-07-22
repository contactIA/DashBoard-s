// Encontra cards duplicados (mesmo clinicorp_patient_id, 2+ cards ativos) em
// QUALQUER painel — sem lista fixa de nomes. Nasceu do erro de 22/07: um
// script anterior (cleanup-dupes-ibs.mjs) tinha uma lista de patientIds
// fixa e rodou sem querer contra o painel ERRADO (Lumine em vez de IBS,
// por causa de um .env genérico carregado por engano) — arquivou cards
// legítimos da Lumine achando que eram duplicatas da IBS.
//
// LIÇÃO: nunca fixar patientId/nome no script. Sempre exigir HELENA_PANEL_ID
// explícito (sem fallback nenhum) e descobrir as duplicatas NA HORA, contra
// o painel informado. Sempre roda em modo LISTAGEM por padrão — arquivar
// exige --apply E o operador escolher quais IDs confirmar (ver ao final).
//
// Uso:
//   HELENA_TOKEN="Bearer xxx" HELENA_PANEL_ID="uuid-do-painel-certo" \
//     node scripts/find-duplicate-patients.mjs
const HELENA = 'https://api.wts.chat'
const token = process.env.HELENA_TOKEN
const panelId = process.env.HELENA_PANEL_ID

if (!token || !panelId) {
  console.error('Defina HELENA_TOKEN e HELENA_PANEL_ID no ambiente — SEM fallback de propósito (evita repetir o erro de 22/07: rodar contra o painel errado).')
  process.exit(1)
}
const auth = token.startsWith('Bearer') ? token : `Bearer ${token}`

async function helena(path) {
  const res = await fetch(`${HELENA}${path}`, { headers: { Authorization: auth } })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

const panel = await helena(`/crm/v1/panel/${panelId}?IncludeDetails=Steps`)
console.log(`Painel: ${panel.title} (${panelId})`)
const stepTitle = Object.fromEntries((panel.steps ?? []).map(s => [s.id, s.title]))

let items = []
for (let pg = 1; pg <= 20; pg++) {
  const j = await helena(`/crm/v1/panel/card?PanelId=${panelId}&PageSize=100&PageNumber=${pg}`)
  items = items.concat(j.items ?? [])
  if (!j.hasMorePages) break
}
console.log(`Total de cards: ${items.length}`)

const byPid = {}
for (const c of items) {
  if (c.archived) continue
  const pid = c.metadata?.clinicorp_patient_id
  if (pid) (byPid[pid] ??= []).push(c)
}
const dups = Object.entries(byPid).filter(([, arr]) => arr.length > 1)
console.log(`\nPatientId com 2+ cards ativos: ${dups.length}\n`)

for (const [pid, arr] of dups) {
  console.log(`pid ${pid} — "${arr[0].title}" (${arr.length}x):`)
  for (const c of arr) {
    console.log(`  id=${c.id}  etapa="${stepTitle[c.stepId] ?? c.stepId}"  valor=R$${c.monetaryAmount ?? '—'}  createdAt=${c.createdAt}`)
  }
}
console.log('\n=== Isto é só LISTAGEM. Nenhum card foi alterado. ===')
console.log('Para arquivar, escolha manualmente os IDs "loser" de cada grupo e confirme com o usuário antes de agir — cards em etapas DIFERENTES podem não ser duplicata simples (ex: um pode já ter avançado no funil de verdade).')
