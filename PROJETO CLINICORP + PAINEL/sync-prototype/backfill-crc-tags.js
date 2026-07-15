// Backfill: os cards criados na rodada anterior (antes da etiqueta de CRC
// existir no código) ficaram só com a etiqueta de unidade. Aqui: descobre a
// unidade de cada card pela tag que já tem, busca de novo o agendamento no
// Clinicorp daquela unidade e ADICIONA (sem remover) a etiqueta do CRC.
import { readFileSync, writeFileSync } from 'node:fs'
import { makeClient } from './clinicorp.js'

for (const line of readFileSync(new URL('.env.ibs', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const HELENA = 'https://api.wts.chat'
const rawToken = process.env.HELENA_TOKEN
const helenaAuth = { Authorization: /^bearer /i.test(rawToken) ? rawToken : `Bearer ${rawToken}`, 'Content-Type': 'application/json' }
const panelId = process.env.HELENA_PANEL_ID
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function helena(method, path, body) {
  const res = await fetch(`${HELENA}${path}`, { method, headers: helenaAuth, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`)
  try { return JSON.parse(text) } catch { return null }
}

const NICKNAMES = { GABI: 'GABRIELA', BIA: 'BEATRIZ', BETH: 'ELIZABETH', PATY: 'PATRICIA' }
const normTag = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
function findAgendadorTag(createUserName, panelTags) {
  if (!createUserName || /usu[aá]rio exclu[ií]do/i.test(createUserName)) return null
  const first = normTag(createUserName).split(/\s+/)[0]
  if (!first) return null
  for (const t of panelTags) {
    const tagFirst = normTag(t.name).split(/\s+/)[0]
    if (!tagFirst) continue
    if (first === tagFirst || first.startsWith(tagFirst) || tagFirst.startsWith(first)) return t.id
    if (NICKNAMES[tagFirst] === first || NICKNAMES[first] === tagFirst) return t.id
  }
  return null
}

const UNITS = JSON.parse(process.env.CC_UNITS_JSON)
const panel = await helena('GET', `/crm/v1/panel/${panelId}?IncludeDetails=Tags`)
const unitByTagId = new Map(UNITS.map(u => [u.tagId, u]))

const today = new Date()
const iso = (d) => d.toISOString().slice(0, 10)
const apptFrom = iso(new Date(today.getTime() - 60 * 86_400_000))
const apptTo   = iso(new Date(today.getTime() + 30 * 86_400_000))

// mapa patientId → CreateUserName, por unidade
const agendadorByUnit = new Map()
for (const unit of UNITS) {
  const clinicorp = makeClient({ user: unit.user, token: unit.token, subscriberId: unit.user })
  const raw = await clinicorp.appointments(apptFrom, apptTo, { IncludeCanceled: 'true' })
  const items = Array.isArray(raw) ? raw : raw.items ?? raw.list ?? []
  const m = new Map()
  for (const a of items) if (a.Patient_PersonId && a.CreateUserName) m.set(String(a.Patient_PersonId), a.CreateUserName)
  agendadorByUnit.set(unit.tagId, m)
}

let cards = []
for (let pg = 1; pg <= 15; pg++) {
  const page = await helena('GET', `/crm/v1/panel/card?PanelId=${panelId}&PageSize=100&PageNumber=${pg}`)
  cards = cards.concat(page.items ?? [])
  if (!page.hasMorePages) break
}

const log = []
let updated = 0, skipped = 0, noMatch = 0
for (const c of cards) {
  if (!c.metadata?.clinicorp_patient_id) continue
  const unitTagId = (c.tagIds ?? []).find(t => unitByTagId.has(t))
  if (!unitTagId) continue
  const alreadyHasCrc = (c.tagIds ?? []).some(t => (panel.tags ?? []).some(pt => pt.id === t && pt.id !== unitTagId))
  if (alreadyHasCrc) { skipped++; continue }

  const crcNome = agendadorByUnit.get(unitTagId)?.get(String(c.metadata.clinicorp_patient_id))
  const crcTagId = findAgendadorTag(crcNome, panel.tags ?? [])
  if (!crcTagId) { noMatch++; continue }

  try {
    await helena('PUT', `/crm/v2/panel/card/${c.id}`, { fields: ['tagIds'], tagIds: [...(c.tagIds ?? []), crcTagId] })
    updated++
    log.push({ card: c.title, crc: crcNome })
    console.log(`✅ "${c.title}" + etiqueta ${(panel.tags ?? []).find(t => t.id === crcTagId)?.name} (${crcNome})`)
  } catch (err) {
    console.log(`❌ "${c.title}": ${err.message}`)
  }
  await sleep(250)
}

writeFileSync(new URL('out/backfill-crc-log.json', import.meta.url), JSON.stringify(log, null, 2))
console.log(`\n=== ${updated} atualizado(s) · ${skipped} já tinham CRC · ${noMatch} sem CreateUserName/etiqueta correspondente ===`)
