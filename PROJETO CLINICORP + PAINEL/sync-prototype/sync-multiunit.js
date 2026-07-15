// Sync multi-unidade (dry-run por padrão) — lê _clinicorp.units, busca cada
// conta Clinicorp separadamente, cruza com os cards do painel Helena e
// move/cria/grava valor. Base do endpoint de produção (api/cron/*).
// Uso:
//   node sync-multiunit.js .env.ibs                    # só mostra o plano
//   node sync-multiunit.js .env.ibs --apply             # aplica de verdade
//   node sync-multiunit.js .env.ibs --apply --limit 5   # aplica só os 5 primeiros de cada lista
import { readFileSync } from 'node:fs'
import { makeClient } from './clinicorp.js'

const envFile = process.argv[2] ?? '.env'
const APPLY = process.argv.includes('--apply')
const limitIdx = process.argv.indexOf('--limit')
const LIMIT = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) : Infinity

for (const line of readFileSync(new URL(envFile, import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const HELENA = 'https://api.wts.chat'
const rawToken = process.env.HELENA_TOKEN
const HELENA_AUTH = /^bearer /i.test(rawToken) ? rawToken : `Bearer ${rawToken}`
const helenaAuth = { Authorization: HELENA_AUTH }
const panelId = process.env.HELENA_PANEL_ID
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function helena(method, path, body) {
  const res = await fetch(`${HELENA}${path}`, {
    method, headers: { ...helenaAuth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 250)}`)
    err.status = res.status
    throw err
  }
  try { return JSON.parse(text) } catch { return null }
}
const helenaGet = (path) => helena('GET', path)

const iso = (d) => d.toISOString().slice(0, 10)
function phoneKey(raw) {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('55') && d.length > 11) d = d.slice(2)
  if (d.length < 10) return null
  return d.slice(0, 2) + d.slice(-8)
}
// "Rita de Cassia" (Clinicorp) → tag "RITA" (Helena): casa pelo primeiro nome,
// ignorando acento/caixa. Apelidos comuns em pt-BR (ex: GABI de GABRIELA) não
// são prefixo do nome completo — precisam de tabela manual. Sem correspondência
// (ex: "Thayanne" sem etiqueta ainda criada na Helena) → null, fica no log.
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

function fmtDateBR(isoDate) {
  if (!isoDate) return null
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

async function findOrCreateContact(nome, telefone) {
  const digits = String(telefone ?? '').replace(/\D/g, '')
  if (!digits) return null
  const candidates = digits.startsWith('55') ? [digits, digits.slice(2)] : [`55${digits}`, digits]
  for (const c of candidates) {
    try {
      const ct = await helenaGet(`/core/v1/contact/phonenumber/${encodeURIComponent(c)}`)
      if (ct?.id) return { id: ct.id, created: false }
    } catch (err) {
      const naoEncontrado = /não encontrado|FORM_ERROR/i.test(err.message)
      if (err.status !== 404 && err.status !== 400 && !naoEncontrado) throw err
    }
    await sleep(150)
  }
  const created = await helena('POST', '/core/v1/contact', { name: nome, phoneNumber: `+${candidates[0]}` })
  return created?.id ? { id: created.id, created: true } : null
}

const UNITS = JSON.parse(process.env.CC_UNITS_JSON)
const today = new Date()
const hoje = iso(today)
const CUTOFF = hoje.slice(0, 7) + '-01'

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
const resolveStep = (target) => {
  for (const cand of TARGET_STEP[target] ?? []) if (stepByTitle[cand]) return stepByTitle[cand]
  return null
}
const RANK = { 'LEADS TRAFEGO': 0, 'LEADS FRIOS': 0, 'LEAD': 0, 'NÃO AGENDADO': 0, 'AGENDADO': 1, 'AGENDOU': 1, 'DESMARCOU': 2, 'CANCELOU': 2, 'FALTOU': 2, 'NÃO COMPARECEU': 2, 'NÃO FECHOU': 3, 'COMPARECEU E NÃO FECHOU': 3, 'ORÇAMENTO EM ABERTO': 4, 'FECHOU': 5, 'COMPARECEU E FECHOU': 5 }
const rankOf = (title) => RANK[(title ?? '').toUpperCase().trim()] ?? 0

let cards = []
for (let pg = 1; pg <= 15; pg++) {
  const page = await helenaGet(`/crm/v1/panel/card?PanelId=${panelId}&PageSize=100&PageNumber=${pg}&IncludeDetails=Contacts`)
  cards = cards.concat(page.items ?? [])
  if (!page.hasMorePages) break
}
console.log(`Painel "${panel.title}": ${cards.length} cards totais${APPLY ? ' · MODO APLICAR' : ' · dry-run'}\n`)

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

const allMoves = [], allCreates = []
const unmatchedCrc = new Set()
let totalAppts = 0, totalEstimates = 0

for (const unit of UNITS) {
  const tagLabel = tagNameById[unit.tagId] ?? unit.tagId ?? 'nenhuma'
  console.log(`=== Unidade: ${unit.label || unit.user} (etiqueta: ${tagLabel}) ===`)
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
  totalAppts += appts.length; totalEstimates += estimates.length

  const desired = new Map()
  const propose = (pid, entry, priority) => {
    if (!pid) return
    const cur = desired.get(String(pid))
    if (!cur || priority > cur.priority) desired.set(String(pid), { ...entry, priority })
  }
  // "Quem agendou" rastreado à parte da prioridade do estado-alvo — um
  // orçamento aprovado (prioridade 7) pode vencer o card, mas o CRC que
  // agendou a consulta (prioridade 1) não pode se perder por isso.
  const agendadorByPatient = new Map()
  for (const a of appts) {
    const quando = String(a.date ?? '').slice(0, 10)
    const type = statusById[a.StatusId]?.Type ?? null
    if (a.Patient_PersonId && a.CreateUserName) agendadorByPatient.set(String(a.Patient_PersonId), a.CreateUserName)
    const extra = { nome: a.PatientName, quando, time: a.fromTime ?? null, telefone: a.MobilePhone, patientId: a.Patient_PersonId, primeiraConsulta: Boolean(a.FirstAppointment) }
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
        const crcNome = agendadorByPatient.get(pid) ?? null
        const crcTagId = findAgendadorTag(crcNome, panel.tags ?? [])
        if (crcNome && !crcTagId) unmatchedCrc.add(crcNome)
        allCreates.push({ unidade: unit.label || unit.user, tagId: unit.tagId, crcTagId, stepId: stepAlvo.id, step: stepAlvo.title, nome: want.nome, telefone: want.telefone, patientId: pid, valor: want.valor ?? null, quando: want.quando, time: want.time ?? null, motivo: want.motivo })
      }
      continue
    }

    const stepAtual = stepTitleById[card.stepId] ?? '?'
    const ehRegressao   = rankOf(stepAlvo.title) < rankOf(stepAtual)
    const reativacao    = want.futura && want.target === 'AGENDADO' && rankOf(stepAtual) < 5
    const fechouTerminal = rankOf(stepAtual) === 5 && want.target !== 'FECHOU'
    const precisaValor  = want.valor > 0 && !(card.monetaryAmount > 0)

    if (fechouTerminal || (ehRegressao && !reativacao)) {
      if (precisaValor && want.target === 'FECHOU') {
        moves++
        allMoves.push({ unidade: unit.label || unit.user, cardId: card.id, card: card.title, de: stepAtual, para: stepAtual, stepAlvoId: card.stepId, valor: want.valor, quando: want.quando, time: want.time ?? null, patientId: pid, motivo: want.motivo })
      }
      continue
    }

    const precisaMover = card.stepId !== stepAlvo.id
    if (precisaMover || precisaValor) {
      moves++
      allMoves.push({
        unidade: unit.label || unit.user, cardId: card.id, card: card.title,
        de: stepAtual, para: precisaMover ? stepAlvo.title : stepAtual, stepAlvoId: stepAlvo.id,
        valor: precisaValor ? want.valor : null, quando: want.quando, time: want.time ?? null, patientId: pid, motivo: want.motivo,
      })
    }
  }
  console.log(`  ${appts.length} agendamentos · ${estimates.length} orçamentos · moveria ${moves} · criaria ${creates} · ignorados (antes de ${CUTOFF}) ${ignoredOld}`)
}

console.log(`\n=== RESUMO: ${totalAppts} agendamentos · ${totalEstimates} orçamentos · MOVERIA ${allMoves.length} · CRIARIA ${allCreates.length} ===`)

if (!APPLY) {
  for (const m of allMoves.slice(0, 30)) console.log(`  MOVE  [${m.unidade}] "${m.card}" ${m.de} → ${m.para}${m.valor ? ` · R$ ${m.valor}` : ''}   [${m.motivo}]`)
  for (const c of allCreates.slice(0, 30)) console.log(`  CREATE [${c.unidade}] ${c.nome} → ${c.step}${c.valor ? ` · R$ ${c.valor}` : ''}   [${c.motivo}]`)
  if (unmatchedCrc.size) console.log(`\n⚠ CRC sem etiqueta correspondente na Helena: ${[...unmatchedCrc].join(', ')}`)
  console.log('\n(dry-run — nada foi escrito; rode com --apply para executar)')
  process.exit(0)
}

// ── APLICAR ───────────────────────────────────────────────────────────────
let moved = 0, created = 0, failed = 0

for (const m of allMoves.slice(0, LIMIT)) {
  try {
    const body = { metadata: { clinicorp_patient_id: String(m.patientId ?? '') } }
    const fields = ['metadata']
    if (m.stepAlvoId) { body.stepId = m.stepAlvoId; fields.push('stepId') }
    if (m.valor > 0) { body.monetaryAmount = m.valor; fields.push('monetaryAmount') }
    if (m.quando) { body.customFields = { data: fmtDateBR(m.quando), ...(m.time ? { 'hor-rio': m.time } : {}) }; fields.push('customFields'); body.metadata.clinicorp_event_date = m.quando }
    body.fields = fields
    await helena('PUT', `/crm/v2/panel/card/${m.cardId}`, body)
    moved++
    console.log(`✅ MOVIDO [${m.unidade}] "${m.card}" ${m.de} → ${m.para}${m.valor ? ` · R$ ${m.valor}` : ''}`)
  } catch (err) { failed++; console.log(`❌ move [${m.unidade}] "${m.card}": ${err.message}`) }
  await sleep(300)
}

for (const c of allCreates.slice(0, LIMIT)) {
  try {
    const contact = await findOrCreateContact(c.nome, c.telefone)
    await sleep(200)
    const tagIds = [c.tagId, c.crcTagId].filter(Boolean)
    const body = {
      stepId: c.stepId, title: c.nome,
      ...(contact ? { contactIds: [contact.id] } : {}),
      ...(tagIds.length ? { tagIds } : {}),
      ...(c.valor > 0 ? { monetaryAmount: c.valor } : {}),
      ...(c.quando ? { dueDate: `${c.quando}T15:00:00.000Z` } : {}),
      ...(c.quando ? { customFields: { data: fmtDateBR(c.quando), ...(c.time ? { 'hor-rio': c.time } : {}) } } : {}),
      metadata: { clinicorp_patient_id: String(c.patientId ?? ''), clinicorp_origem: c.motivo, ...(c.quando ? { clinicorp_event_date: c.quando } : {}) },
    }
    const card = await helena('POST', '/crm/v1/panel/card', body)
    created++
    console.log(`✅ CRIADO [${c.unidade}] "${c.nome}" → ${c.step}${c.valor ? ` · R$ ${c.valor}` : ''}${contact?.created ? ' (contato novo)' : ''} (card ${card?.id?.slice(0, 8)})`)
  } catch (err) { failed++; console.log(`❌ create [${c.unidade}] "${c.nome}": ${err.message}`) }
  await sleep(300)
}

console.log(`\n=== APLICADO: ${moved} movidos · ${created} criados · ${failed} falhas ===`)
if (unmatchedCrc.size) {
  console.log(`\n⚠ CRC sem etiqueta correspondente na Helena (crie a etiqueta pra esses ficarem completos): ${[...unmatchedCrc].join(', ')}`)
}
