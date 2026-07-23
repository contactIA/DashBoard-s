// Arquiva cards duplicados (mesmo clinicorp_patient_id, 2+ cards ativos) em
// QUALQUER painel informado explicitamente. Sucessor de find-duplicate-patients.mjs
// (só listava) — usa a MESMA descoberta e aplica a regra de decisão:
//   - Entre cards no MESMO estágio: mantém o mais ANTIGO (createdAt menor).
//   - Entre cards em estágios DIFERENTES: mantém o de MAIOR avanço no funil
//     (rank pelo título da etapa — mesma régua do protótipo cleanup-dupes.js),
//     nunca um card "atrasado" por cima de um mais avançado.
// SEMPRE roda em dry-run por padrão. Escrita exige --apply.
//
// Uso:
//   HELENA_TOKEN="Bearer xxx" HELENA_PANEL_ID="uuid" node scripts/cleanup-duplicate-patients.mjs
//   HELENA_TOKEN="Bearer xxx" HELENA_PANEL_ID="uuid" node scripts/cleanup-duplicate-patients.mjs --apply
const HELENA = 'https://api.wts.chat'
const token = process.env.HELENA_TOKEN
const panelId = process.env.HELENA_PANEL_ID
const APPLY = process.argv.includes('--apply')

if (!token || !panelId) {
  console.error('Defina HELENA_TOKEN e HELENA_PANEL_ID no ambiente — sem fallback, de propósito.')
  process.exit(1)
}
const auth = token.startsWith('Bearer') ? token : `Bearer ${token}`

async function helena(method, path, body) {
  const res = await fetch(`${HELENA}${path}`, {
    method, headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`)
  try { return JSON.parse(text) } catch { return null }
}

const panel = await helena('GET', `/crm/v1/panel/${panelId}?IncludeDetails=Steps`)
console.log(`Painel: ${panel.title} (${panelId})\n`)
const stepTitle = Object.fromEntries((panel.steps ?? []).map(s => [s.id, s.title]))

// Rank de avanço no funil por TÍTULO — mesma régua conceitual do motor de
// sync (TYPE_RANK em clinicorpSync.js), mas por nome porque aqui não temos
// o mapeamento steps._type de cada clínica à mão neste script standalone.
const RANK_BY_TITLE = {
  'LEADS': 0, 'LEAD': 0, 'NÃO AGENDADOS': 0, 'NÃO AGENDADO': 0,
  'AGENDOU': 1, 'AGENDADO': 1, 'AGENDADOS': 1,
  'DESMARCADOS': 2, 'DESMARCOU': 2, 'FALTOSOS': 2, 'FALTOU': 2,
  'COMPARECIDOS': 3, 'COMPARECEU': 3,
  'COMPARECEU E NÃO FECHOU': 4, 'NÃO FECHOU': 4, 'ORÇAMENTO EM ABERTO': 4,
  'COMPARECEU E FECHOU': 5, 'FECHOU': 5,
}
const rankOf = (c) => RANK_BY_TITLE[(stepTitle[c.stepId] ?? '').toUpperCase().trim()] ?? -1

let items = []
for (let pg = 1; pg <= 20; pg++) {
  const j = await helena('GET', `/crm/v1/panel/card?PanelId=${panelId}&PageSize=100&PageNumber=${pg}`)
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
console.log(`PatientId com 2+ cards ativos: ${dups.length}\n`)
console.log(`Modo: ${APPLY ? 'APLICANDO DE VERDADE' : 'DRY-RUN (nada será escrito — use --apply para confirmar)'}\n`)

let totalArquivado = 0
for (const [pid, arr] of dups) {
  // Ordena por rank desc (maior avanço primeiro), empate por createdAt asc (mais antigo primeiro)
  const sorted = [...arr].sort((a, b) => rankOf(b) - rankOf(a) || String(a.createdAt).localeCompare(String(b.createdAt)))
  const keeper = sorted[0]
  const losers = sorted.slice(1)
  console.log(`pid ${pid} — "${keeper.title}": mantém "${stepTitle[keeper.stepId]}" (${keeper.id}, ${keeper.createdAt})`)
  for (const loser of losers) {
    console.log(`  arquiva "${stepTitle[loser.stepId]}" (${loser.id}, ${loser.createdAt}) R$${loser.monetaryAmount ?? '—'}`)
    totalArquivado++
    if (APPLY) {
      await helena('PUT', `/crm/v2/panel/card/${loser.id}`, { fields: ['archived'], archived: true })
      console.log(`    ✅ arquivado`)
      await new Promise(r => setTimeout(r, 250))
    }
  }
}
console.log(`\n=== ${totalArquivado} card(s) ${APPLY ? 'arquivado(s)' : 'seriam arquivado(s)'} ===`)
if (!APPLY) console.log('Rode novamente com --apply para executar de verdade.')
