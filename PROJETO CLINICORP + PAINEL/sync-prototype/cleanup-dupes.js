// Limpa cards duplicados do piloto: mantém o melhor, transfere valor/etapa
// se necessário e ARQUIVA (não deleta) o duplicado. Log em out/cleanup-log.json.
import { readFileSync, writeFileSync } from 'node:fs'

for (const line of readFileSync(new URL('.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const HELENA = 'https://api.wts.chat'
const AUTH = { Authorization: `Bearer ${process.env.HELENA_TOKEN}`, 'Content-Type': 'application/json' }
const panelId = process.env.HELENA_PANEL_ID
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function helena(method, path, body) {
  const res = await fetch(`${HELENA}${path}`, { method, headers: AUTH, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`)
  try { return JSON.parse(text) } catch { return null }
}

const panel = await helena('GET', `/crm/v1/panel/${panelId}?IncludeDetails=Steps`)
const stepTitle = Object.fromEntries((panel.steps ?? []).map(s => [s.id, s.title]))
const RANK = { 'LEADS TRAFEGO': 0, 'LEADS FRIOS': 0, 'AGENDADO': 1, 'DESMARCOU': 2, 'FALTOU': 2, 'NÃO FECHOU': 3, 'ORÇAMENTO EM ABERTO': 4, 'FECHOU': 5 }
const rankOf = (c) => RANK[(stepTitle[c.stepId] ?? '').toUpperCase().trim()] ?? 0

let cards = []
for (let pg = 1; pg <= 10; pg++) {
  const j = await helena('GET', `/crm/v1/panel/card?PanelId=${panelId}&PageSize=100&PageNumber=${pg}`)
  cards = cards.concat(j.items ?? [])
  if (!j.hasMorePages) break
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\(\d+\)/g, '').replace(/[^a-z ]/g, '').trim().split(/\s+/).slice(0, 2).join(' ')

const byName = {}
for (const c of cards) if (!c.archived) (byName[norm(c.title)] ??= []).push(c)

const log = []
for (const [name, arr] of Object.entries(byName)) {
  if (arr.length < 2 || !name) continue

  // escolhe o keeper: original (sem metadata do sync) > maior etapa > tem valor > mais antigo
  const score = (c) => (c.metadata?.clinicorp_patient_id ? 0 : 100) + rankOf(c) * 10 + (c.monetaryAmount > 0 ? 1 : 0)
  const sorted = [...arr].sort((a, b) => score(b) - score(a) || String(a.createdAt).localeCompare(String(b.createdAt)))
  const keeper = sorted[0]
  const losers = sorted.slice(1)

  for (const loser of losers) {
    const patch = { fields: ['archived'], archived: true }
    const keeperPatch = { fields: [] }

    // transfere valor se o duplicado tem e o keeper não
    if (loser.monetaryAmount > 0 && !(keeper.monetaryAmount > 0)) {
      keeperPatch.monetaryAmount = loser.monetaryAmount
      keeperPatch.fields.push('monetaryAmount')
    }
    // etapa mais avançada vence (funil só anda pra frente)
    if (rankOf(loser) > rankOf(keeper)) {
      keeperPatch.stepId = loser.stepId
      keeperPatch.fields.push('stepId')
    }
    // preserva o vínculo clinicorp no keeper
    if (loser.metadata?.clinicorp_patient_id && !keeper.metadata?.clinicorp_patient_id) {
      keeperPatch.metadata = { clinicorp_patient_id: loser.metadata.clinicorp_patient_id }
      keeperPatch.fields.push('metadata')
    }

    if (keeperPatch.fields.length) {
      await helena('PUT', `/crm/v2/panel/card/${keeper.id}`, keeperPatch)
      await sleep(250)
    }
    await helena('PUT', `/crm/v2/panel/card/${loser.id}`, patch)
    await sleep(250)

    log.push({
      paciente: keeper.title,
      manteve: `${keeper.id.slice(0, 8)} (${stepTitle[keeper.stepId]})`,
      arquivou: `${loser.id.slice(0, 8)} (${stepTitle[loser.stepId]})`,
      transferiu: keeperPatch.fields.filter(f => f !== 'metadata'),
    })
    console.log(`🧹 "${keeper.title}": manteve ${stepTitle[keeper.stepId]}, arquivou duplicado em ${stepTitle[loser.stepId]}${keeperPatch.fields.length ? ` · transferiu ${keeperPatch.fields.join(',')}` : ''}`)
  }
}

writeFileSync(new URL('out/cleanup-log.json', import.meta.url), JSON.stringify(log, null, 2))
console.log(`\n=== ${log.length} duplicata(s) arquivada(s) · log em out/cleanup-log.json ===`)
