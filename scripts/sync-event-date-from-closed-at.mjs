// Corrige o bug do backfill-closed-at.mjs (23/07): ele gravava "Fechado em"
// (customField) mas NUNCA atualizava metadata.clinicorp_event_date — o campo
// que o dashboard REALMENTE lê para decidir em que mês o card conta
// (src/utils/parseCards.js, effectiveDate). Resultado: card mostrava a data
// certa no "Fechado em" mas contava no mês ERRADO no dashboard.
//
// Este script NÃO busca no Clinicorp de novo — só sincroniza o metadata a
// partir do que JÁ ESTÁ no customField "Fechado em" do card. Isso preserva
// qualquer correção manual feita direto no card (ex: Rosângela, editada à
// mão para 20/06 depois que o backfill original gravou 16/07 por engano).
//
// Uso:
//   HELENA_TOKEN="Bearer xxx" HELENA_PANEL_ID="uuid" \
//   HELENA_STEP_FECHOU_ID="uuid" HELENA_CLOSED_AT_KEY="fechado-em-" \
//     node scripts/sync-event-date-from-closed-at.mjs           # dry-run
//     node scripts/sync-event-date-from-closed-at.mjs --apply    # aplica
const HELENA = 'https://api.wts.chat'
const token = process.env.HELENA_TOKEN
const panelId = process.env.HELENA_PANEL_ID
const fechouStepId = process.env.HELENA_STEP_FECHOU_ID
const closedAtKey = process.env.HELENA_CLOSED_AT_KEY
const APPLY = process.argv.includes('--apply')

if (!token || !panelId || !fechouStepId || !closedAtKey) {
  console.error('Defina HELENA_TOKEN, HELENA_PANEL_ID, HELENA_STEP_FECHOU_ID, HELENA_CLOSED_AT_KEY.')
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

console.log(`Modo: ${APPLY ? 'APLICANDO DE VERDADE' : 'DRY-RUN'}\n`)

let items = []
for (let pg = 1; pg <= 20; pg++) {
  const j = await helena('GET', `/crm/v1/panel/card?PanelId=${panelId}&PageSize=100&PageNumber=${pg}&IncludeDetails=CustomFields`)
  items = items.concat(j.items ?? [])
  if (!j.hasMorePages) break
}

const fechou = items.filter(c => c.stepId === fechouStepId && !c.archived)
console.log(`Cards em "Fechou": ${fechou.length}`)

let corrigidos = 0, jaOk = 0, semCampo = 0
for (const c of fechou) {
  const raw = c.customFields?.[closedAtKey]
  const val = Array.isArray(raw) ? raw[0] : raw
  if (!val) { semCampo++; continue }
  const fechadoEmIso = String(val).replace(/\//g, '-').slice(0, 10) // "2026/06/20" -> "2026-06-20"
  const eventDateAtual = c.metadata?.clinicorp_event_date
  if (eventDateAtual === fechadoEmIso) { jaOk++; continue }

  corrigidos++
  console.log(`"${c.title}": event_date ${eventDateAtual ?? '(vazio)'} -> ${fechadoEmIso}`)
  if (APPLY) {
    await helena('PUT', `/crm/v2/panel/card/${c.id}`, {
      fields: ['metadata'],
      metadata: { ...c.metadata, clinicorp_event_date: fechadoEmIso },
    })
    console.log('  ✅ gravado')
    await new Promise(r => setTimeout(r, 250))
  }
}

console.log(`\n=== Resumo ===`)
console.log(`Já sincronizados (nada a fazer): ${jaOk}`)
console.log(`Corrigidos: ${corrigidos}`)
console.log(`Sem "${closedAtKey}" preenchido (fora do escopo deste script): ${semCampo}`)
if (!APPLY) console.log('\nRode novamente com --apply para gravar de verdade.')
