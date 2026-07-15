// Em vez de corrigir retroativamente a data de ~99 cards de maio/junho
// (mais lento e mais numérico do que vale a pena para o piloto), fazemos o
// mais simples: ARQUIVA os cards sincronizados cujo fato aconteceu ANTES de
// CUTOFF, e para os que ficam (CUTOFF em diante) grava a data real do evento
// (clinicorp_event_date) — daqui pra frente o sync roda quase em tempo real
// e esse problema de atribuição não se repete.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { makeClient } from './clinicorp.js'

const CUTOFF = '2026-07-01'

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

function fmtDateBR(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const clinicorp = makeClient({
  user: process.env.CLINICORP_USER, token: process.env.CLINICORP_TOKEN, subscriberId: process.env.CLINICORP_SUBSCRIBER,
})
const iso = (d) => d.toISOString().slice(0, 10)
const today = new Date()

const apptFrom = iso(new Date(today.getTime() - 60 * 86_400_000))
const apptTo   = iso(new Date(today.getTime() + 30 * 86_400_000))
const apptsRaw = await clinicorp.appointments(apptFrom, apptTo, { IncludeCanceled: 'true' })
const appts = Array.isArray(apptsRaw) ? apptsRaw : apptsRaw.items ?? apptsRaw.list ?? []
const { list: statusList } = await clinicorp.statusList()
const statusById = Object.fromEntries(statusList.map(s => [s.id, s]))

let estimates = []
for (const back of [60, 30]) {
  const f = iso(new Date(today.getTime() - back * 86_400_000))
  const t = iso(new Date(today.getTime() - (back - 30) * 86_400_000))
  const raw = await clinicorp.estimates(f, t)
  estimates = estimates.concat(Array.isArray(raw) ? raw : raw.items ?? raw.list ?? [])
}

const bestByPatient = new Map()
function propose(pid, entry, priority) {
  if (!pid) return
  const cur = bestByPatient.get(String(pid))
  if (!cur || priority > cur.priority) bestByPatient.set(String(pid), { ...entry, priority })
}
const hoje = iso(today)
for (const a of appts) {
  const pid = a.Patient_PersonId, quando = String(a.date ?? '').slice(0, 10)
  const type = statusById[a.StatusId]?.Type ?? null
  if (a.Deleted === 'X') propose(pid, { quando, time: a.fromTime ?? null }, 2)
  else if (type === 'MISSED') propose(pid, { quando, time: a.fromTime ?? null }, 3)
  else if (['CHECKOUT', 'IN_SESSION', 'ARRIVED'].includes(type)) propose(pid, { quando, time: a.fromTime ?? null }, 4)
  else if (quando >= hoje) propose(pid, { quando, time: a.fromTime ?? null }, 1)
}
for (const e of estimates) {
  const pid = e.PatientId, quando = String(e.Date ?? '').slice(0, 10)
  if (e.Status === 'APPROVED') propose(pid, { quando, time: null }, 7)
  else if (e.Status === 'OPEN') propose(pid, { quando, time: null }, 6)
  else if (e.Status === 'REJECTED') propose(pid, { quando, time: null }, 5)
}

let cards = []
for (let pg = 1; pg <= 10; pg++) {
  const j = await helena('GET', `/crm/v1/panel/card?PanelId=${panelId}&PageSize=100&PageNumber=${pg}`)
  cards = cards.concat(j.items ?? [])
  if (!j.hasMorePages) break
}

const synced = cards.filter(c => c.metadata?.clinicorp_patient_id && !c.archived)
console.log(`${cards.length} cards no painel · ${synced.length} sincronizados pelo piloto (ativos)\n`)

const archived = [], kept = [], semDado = []
for (const c of synced) {
  const want = bestByPatient.get(String(c.metadata.clinicorp_patient_id))
  if (!want?.quando) { semDado.push(c.title); continue }

  if (want.quando < CUTOFF) {
    try {
      await helena('PUT', `/crm/v2/panel/card/${c.id}`, { fields: ['archived'], archived: true })
      archived.push({ card: c.title, cardId: c.id, quando: want.quando })
      console.log(`🗄  ARQUIVADO "${c.title}" (fato de ${want.quando}, antes de ${CUTOFF})`)
    } catch (err) {
      console.log(`❌ arquivar "${c.title}": ${err.message}`)
    }
  } else {
    try {
      await helena('PUT', `/crm/v2/panel/card/${c.id}`, {
        fields: ['metadata', 'customFields'],
        metadata: { clinicorp_patient_id: c.metadata.clinicorp_patient_id, clinicorp_event_date: want.quando },
        customFields: { data: fmtDateBR(want.quando), ...(want.time ? { 'hor-rio': want.time } : {}) },
      })
      kept.push({ card: c.title, cardId: c.id, quando: want.quando })
      console.log(`✅ MANTIDO "${c.title}" (fato de ${want.quando}) · data do evento gravada`)
    } catch (err) {
      console.log(`❌ atualizar "${c.title}": ${err.message}`)
    }
  }
  await sleep(250)
}

if (semDado.length) {
  console.log(`\n⚠ ${semDado.length} card(s) sem dado Clinicorp para reconstruir a data (não tocados): ${semDado.slice(0, 10).join(', ')}`)
}

mkdirSync(new URL('out/', import.meta.url), { recursive: true })
writeFileSync(new URL('out/prune-log.json', import.meta.url), JSON.stringify({ archived, kept, semDado }, null, 2))
console.log(`\n=== ${archived.length} arquivado(s) · ${kept.length} mantido(s) com data corrigida · log em out/prune-log.json ===`)
