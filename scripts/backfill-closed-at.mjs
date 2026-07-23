// Backfill de "Fechado em" (customField configurável, ex: fechado-em-) para
// cards já em "Compareceu e Fechou"/"Fechou" que fecharam ANTES da correção
// de 22/07 (commit 44b69fa) — o motor de sync só passou a gravar essa data
// dali pra frente; cards fechados antes ficam sem o campo até este backfill.
//
// Para cada card: acha o clinicorp_patient_id, identifica a UNIDADE certa
// pela etiqueta do card (ex: BUENO/ELDORADO — nunca mistura conta), busca o
// orçamento APPROVED correspondente no Clinicorp daquela unidade, e grava
// e.Date (a data real de aprovação) SÓ no campo "Fechado em" — nunca toca em
// "Agendado Para".
//
// Uso (JSON de unidades: [{ label, tagId, user, token }]):
//   HELENA_TOKEN="Bearer xxx" HELENA_PANEL_ID="uuid" \
//   HELENA_STEP_FECHOU_ID="uuid-da-etapa" \
//   HELENA_CLOSED_AT_KEY="fechado-em-" \
//   CC_UNITS_JSON='[{"label":"Bueno","tagId":"...","user":"...","token":"..."}]' \
//     node scripts/backfill-closed-at.mjs           # dry-run
//     node scripts/backfill-closed-at.mjs --apply    # aplica de verdade
import { makeClinicorpClient } from '../src/server/clinicorp.js'

const HELENA = 'https://api.wts.chat'
const token = process.env.HELENA_TOKEN
const panelId = process.env.HELENA_PANEL_ID
const fechouStepId = process.env.HELENA_STEP_FECHOU_ID
const closedAtKey = process.env.HELENA_CLOSED_AT_KEY
const units = JSON.parse(process.env.CC_UNITS_JSON ?? '[]')
const APPLY = process.argv.includes('--apply')

if (!token || !panelId || !fechouStepId || !closedAtKey || !units.length) {
  console.error('Defina HELENA_TOKEN, HELENA_PANEL_ID, HELENA_STEP_FECHOU_ID, HELENA_CLOSED_AT_KEY e CC_UNITS_JSON.')
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

// 1) Busca todos os cards em "Fechou" sem o campo preenchido
let items = []
for (let pg = 1; pg <= 20; pg++) {
  const j = await helena('GET', `/crm/v1/panel/card?PanelId=${panelId}&PageSize=100&PageNumber=${pg}&IncludeDetails=CustomFields`)
  items = items.concat(j.items ?? [])
  if (!j.hasMorePages) break
}
const alvo = items.filter(c =>
  c.stepId === fechouStepId && !c.archived &&
  !c.customFields?.[closedAtKey] &&
  c.metadata?.clinicorp_patient_id
)
console.log(`Cards em "Fechou" sem "${closedAtKey}", com patientId: ${alvo.length}`)

// 2) Busca estimates APPROVED de cada unidade numa janela ampla (últimos 12 meses)
const hoje = new Date()
const ranges = []
for (let back = 0; back <= 12; back += 1) {
  const to = new Date(hoje.getFullYear(), hoje.getMonth() - back + 1, 0)
  const from = new Date(hoje.getFullYear(), hoje.getMonth() - back, 1)
  ranges.push([from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)])
}

const approvedByUnit = {} // label -> Map(patientId -> estimate)
for (const u of units) {
  console.log(`\nBuscando orçamentos aprovados da unidade "${u.label}"...`)
  const client = makeClinicorpClient({ user: u.user, token: u.token, subscriberId: u.user })
  const byPid = new Map()
  for (const [from, to] of ranges) {
    try {
      const raw = await client.estimates(from, to)
      const arr = Array.isArray(raw) ? raw : raw.items ?? raw.list ?? []
      for (const e of arr) {
        if (e.Status !== 'APPROVED') continue
        const pid = String(e.PatientId)
        const cur = byPid.get(pid)
        // Guarda o orçamento com Date mais RECENTE por paciente (último fechamento)
        if (!cur || String(e.Date) > String(cur.Date)) byPid.set(pid, e)
      }
    } catch (err) { console.log(`  aviso: ${from}..${to}: ${err.message}`) }
  }
  approvedByUnit[u.label] = byPid
  console.log(`  ${byPid.size} paciente(s) com orçamento aprovado encontrado(s).`)
}

// 3) Casa cada card com a unidade pela etiqueta, e com o orçamento pelo patientId
const tagIdToUnit = Object.fromEntries(units.map(u => [u.tagId, u.label]))
let achados = 0, semUnidade = 0, semOrcamento = 0

for (const c of alvo) {
  const unitTag = (c.tagIds ?? []).find(t => tagIdToUnit[t])
  const unitLabel = unitTag ? tagIdToUnit[unitTag] : null
  if (!unitLabel) { semUnidade++; continue }
  const pid = String(c.metadata.clinicorp_patient_id)
  const est = approvedByUnit[unitLabel]?.get(pid)
  if (!est) { semOrcamento++; continue }
  const fechadoEmIso = String(est.Date).slice(0, 10)     // "2026-07-16"
  const fechadoEm = fechadoEmIso.replace(/-/g, '/')       // "2026/07/16" (formato do customField)
  achados++
  console.log(`"${c.title}" [${unitLabel}] -> Fechado em = ${fechadoEm} (orçamento R$${est.Amount})`)
  if (APPLY) {
    // grava customFields E metadata.clinicorp_event_date JUNTOS — bug de
    // 23/07: um backfill anterior só gravava o customField e deixava o
    // event_date (o campo que o dashboard REALMENTE lê) desatualizado,
    // fazendo o card contar no mês errado mesmo com "Fechado em" certo.
    await helena('PUT', `/crm/v2/panel/card/${c.id}`, {
      fields: ['customFields', 'metadata'],
      customFields: { [closedAtKey]: fechadoEm },
      metadata: { ...c.metadata, clinicorp_event_date: fechadoEmIso },
    })
    console.log('  ✅ gravado (customField + metadata.event_date)')
    await new Promise(r => setTimeout(r, 250))
  }
}

console.log(`\n=== Resumo ===`)
console.log(`Cards corrigidos: ${achados}`)
console.log(`Sem etiqueta de unidade reconhecida: ${semUnidade}`)
console.log(`Sem orçamento aprovado encontrado no Clinicorp (fora da janela de 12 meses ou paciente não achado): ${semOrcamento}`)
if (!APPLY) console.log('\nRode novamente com --apply para gravar de verdade.')
