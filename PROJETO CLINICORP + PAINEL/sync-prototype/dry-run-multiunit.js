// DRY-RUN multi-unidade: lê _clinicorp.units da clínica, busca cada conta
// Clinicorp separadamente e mostra o que o sync faria — NENHUMA escrita.
// Uso: node dry-run-multiunit.js
import { readFileSync } from 'node:fs'
import { makeClient } from './clinicorp.js'

const envFile = process.argv[2] ?? '.env'
for (const line of readFileSync(new URL(envFile, import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const HELENA = 'https://api.wts.chat'
// Token salvo no Supabase já vem com o prefixo "Bearer " — não duplicar.
const rawToken = process.env.HELENA_TOKEN
const helenaAuth = { Authorization: /^bearer /i.test(rawToken) ? rawToken : `Bearer ${rawToken}` }
const panelId = process.env.HELENA_PANEL_ID

async function helenaGet(path) {
  const res = await fetch(`${HELENA}${path}`, { headers: helenaAuth })
  if (!res.ok) throw new Error(`Helena ${res.status} em ${path}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

const iso = (d) => d.toISOString().slice(0, 10)
function phoneKey(raw) {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('55') && d.length > 11) d = d.slice(2)
  if (d.length < 10) return null
  return d.slice(0, 2) + d.slice(-8)
}

const UNITS = JSON.parse(process.env.CC_UNITS_JSON)
const today = new Date()
const hoje = iso(today)
const CUTOFF = hoje.slice(0, 7) + '-01'

// ── Helena: painel (steps + tags) + todos os cards ───────────────────────────
const panel = await helenaGet(`/crm/v1/panel/${panelId}?IncludeDetails=Steps&IncludeDetails=Tags`)
const stepByTitle = {}
for (const s of panel.steps ?? []) stepByTitle[s.title.toUpperCase().trim()] = s
const stepTitleById = Object.fromEntries((panel.steps ?? []).map(s => [s.id, s.title]))
const tagNameById = Object.fromEntries((panel.tags ?? []).map(t => [t.id, t.name]))

const TARGET_STEP = {
  'AGENDADO': ['AGENDOU', 'AGENDADO'], 'DESMARCOU': ['DESMARCOU', 'CANCELOU'],
  'FALTOU': ['FALTOU', 'NÃO COMPARECEU'], 'NÃO FECHOU': ['NÃO FECHOU', 'COMPARECEU E NÃO FECHOU'],
  'ORÇAMENTO EM ABERTO': ['ORÇAMENTO EM ABERTO'], 'FECHOU': ['FECHOU', 'COMPARECEU E FECHOU'],
}
function resolveStep(target) {
  for (const cand of TARGET_STEP[target] ?? []) if (stepByTitle[cand]) return stepByTitle[cand]
  return null
}

let cards = []
for (let pg = 1; pg <= 15; pg++) {
  const page = await helenaGet(`/crm/v1/panel/card?PanelId=${panelId}&PageSize=100&PageNumber=${pg}&IncludeDetails=Contacts`)
  cards = cards.concat(page.items ?? [])
  if (!page.hasMorePages) break
}
console.log(`Painel "${panel.title}": ${cards.length} cards totais\n`)

const contactIds = [...new Set(cards.map(c => c.contacts?.[0]?.id ?? c.contactIds?.[0]).filter(Boolean))]
const contactPhone = {}
for (let i = 0; i < contactIds.length; i += 10) {
  await Promise.all(contactIds.slice(i, i + 10).map(async (id) => {
    try {
      const res = await fetch(`${HELENA}/core/v1/contact/${id}`, { headers: helenaAuth })
      if (res.ok) { const ct = await res.json(); contactPhone[id] = ct.phoneNumber ?? ct.phoneNumberFormatted ?? null }
    } catch {}
  }))
}

const cardsByPhone = new Map()
const cardsByClinicorpId = new Map()
for (const c of cards) {
  if (c.archived) continue
  const cid = c.contacts?.[0]?.id ?? c.contactIds?.[0]
  const key = phoneKey(contactPhone[cid])
  if (key && !cardsByPhone.has(key)) cardsByPhone.set(key, c)
  const clinId = c.metadata?.clinicorp_patient_id
  if (clinId && !cardsByClinicorpId.has(clinId)) cardsByClinicorpId.set(clinId, c)
}

// ── por unidade: busca Clinicorp e monta o plano (só leitura) ────────────────
let totalAppts = 0, totalEstimates = 0
const allMoves = [], allCreates = [], allSkippedOld = []

for (const unit of UNITS) {
  console.log(`\n=== Unidade: ${unit.label || unit.user} (etiqueta: ${tagNameById[unit.tagId] ?? unit.tagId ?? 'nenhuma'}) ===`)
  const clinicorp = makeClient({ user: unit.user, token: unit.token, subscriberId: unit.user })

  const apptFrom = iso(new Date(today.getTime() - 60 * 86_400_000))
  const apptTo   = iso(new Date(today.getTime() + 30 * 86_400_000))
  let appts = []
  try {
    const raw = await clinicorp.appointments(apptFrom, apptTo, { IncludeCanceled: 'true' })
    appts = Array.isArray(raw) ? raw : raw.items ?? raw.list ?? []
  } catch (err) { console.log(`  ❌ appointments: ${err.message}`); continue }

  const { list: statusList } = await clinicorp.statusList().catch(() => ({ list: [] }))
  const statusById = Object.fromEntries(statusList.map(s => [s.id, s]))

  let estimates = []
  for (const back of [60, 30]) {
    const f = iso(new Date(today.getTime() - back * 86_400_000))
    const t = iso(new Date(today.getTime() - (back - 30) * 86_400_000))
    try {
      const raw = await clinicorp.estimates(f, t)
      estimates = estimates.concat(Array.isArray(raw) ? raw : raw.items ?? raw.list ?? [])
    } catch (err) { console.log(`  ❌ estimates ${f}..${t}: ${err.message}`) }
  }

  console.log(`  ${appts.length} agendamentos · ${estimates.length} orçamentos (janela ${apptFrom}..${apptTo})`)
  totalAppts += appts.length; totalEstimates += estimates.length

  const desired = new Map()
  const propose = (pid, entry, priority) => {
    if (!pid) return
    const cur = desired.get(String(pid))
    if (!cur || priority > cur.priority) desired.set(String(pid), { ...entry, priority })
  }
  for (const a of appts) {
    const quando = String(a.date ?? '').slice(0, 10)
    const type = statusById[a.StatusId]?.Type ?? null
    const extra = { nome: a.PatientName, quando, telefone: a.MobilePhone, patientId: a.Patient_PersonId, primeiraConsulta: Boolean(a.FirstAppointment) }
    if (a.Deleted === 'X') propose(a.Patient_PersonId, { target: 'DESMARCOU', motivo: `desmarcado ${quando}`, ...extra }, 2)
    else if (type === 'MISSED') propose(a.Patient_PersonId, { target: 'FALTOU', motivo: `faltou ${quando}`, ...extra }, 3)
    else if (['CHECKOUT', 'IN_SESSION', 'ARRIVED'].includes(type)) propose(a.Patient_PersonId, { target: 'NÃO FECHOU', motivo: `atendido ${quando}`, ...extra }, 4)
    else if (quando >= hoje) propose(a.Patient_PersonId, { target: 'AGENDADO', motivo: `consulta futura ${quando}`, futura: true, ...extra }, 1)
  }
  for (const e of estimates) {
    const quando = String(e.Date ?? '').slice(0, 10)
    const extra = { nome: e.PatientName, quando, telefone: e.PatientMobilePhone, patientId: e.PatientId }
    if (e.Status === 'APPROVED') propose(e.PatientId, { target: 'FECHOU', valor: e.Amount, motivo: `orçamento APROVADO ${quando} · R$ ${e.Amount}`, ...extra }, 7)
    else if (e.Status === 'OPEN') propose(e.PatientId, { target: 'ORÇAMENTO EM ABERTO', valor: e.Amount, motivo: `orçamento em aberto ${quando} · R$ ${e.Amount}`, ...extra }, 6)
    else if (e.Status === 'REJECTED') propose(e.PatientId, { target: 'NÃO FECHOU', valor: e.Amount, motivo: `orçamento REPROVADO ${quando}`, ...extra }, 5)
  }

  let moves = 0, creates = 0, ignoredOld = 0
  for (const [pid, want] of desired) {
    const stepAlvo = resolveStep(want.target)
    if (!stepAlvo) continue
    const key = phoneKey(want.telefone)
    const card = cardsByClinicorpId.get(pid) ?? (key ? cardsByPhone.get(key) : null)
    if (want.quando < CUTOFF && !card) { ignoredOld++; continue }
    if (!card) {
      if (want.primeiraConsulta || want.valor != null || want.target === 'FECHOU') {
        creates++
        allCreates.push({ unidade: unit.label || unit.user, tagId: unit.tagId, nome: want.nome, target: want.target, valor: want.valor ?? null, motivo: want.motivo })
      }
      continue
    }
    const stepAtual = stepTitleById[card.stepId] ?? '?'
    const precisaMover = stepAtual.toUpperCase() !== stepAlvo.title.toUpperCase()
    const precisaValor  = want.valor > 0 && !(card.monetaryAmount > 0)
    if (precisaMover || precisaValor) {
      moves++
      allMoves.push({
        unidade: unit.label || unit.user, card: card.title,
        de: stepAtual, para: precisaMover ? stepAlvo.title : stepAtual,
        valor: precisaValor ? want.valor : null, motivo: want.motivo,
      })
    }
  }
  console.log(`  → moveria ${moves} · criaria ${creates} · ignorados (fato antes de ${CUTOFF}, sem card) ${ignoredOld}`)
}

console.log(`\n=== RESUMO GERAL (dry-run · nada foi escrito) ===`)
console.log(`Total Clinicorp: ${totalAppts} agendamentos · ${totalEstimates} orçamentos (nas 2 unidades)`)
console.log(`MOVERIA ${allMoves.length} card(s):`)
for (const m of allMoves.slice(0, 30)) console.log(`  · [${m.unidade}] "${m.card}" ${m.de} → ${m.para}${m.valor ? ` · grava R$ ${m.valor}` : ''}   [${m.motivo}]`)
console.log(`\nCRIARIA ${allCreates.length} card(s) novo(s) (de julho em diante, sem card existente):`)
for (const c of allCreates.slice(0, 30)) console.log(`  · [${c.unidade}] ${c.nome} → ${c.target}${c.valor ? ` · R$ ${c.valor}` : ''}   [${c.motivo}]`)
