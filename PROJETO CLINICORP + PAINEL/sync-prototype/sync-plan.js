// PLANO DE SINCRONIZAÇÃO (dry-run): cruza Clinicorp ↔ cards do painel Helena
// e imprime o que o sync FARIA — nenhuma escrita acontece.
//
// Regra de estado-alvo por paciente (prioridade de cima para baixo):
//   1. orçamento APPROVED  → FECHOU     (+ monetaryAmount = Amount)
//   2. orçamento OPEN      → ORÇAMENTO EM ABERTO
//   3. orçamento REJECTED  → NÃO FECHOU
//   4. agendamento Deleted → DESMARCOU
//   5. agendamento MISSED  → FALTOU
//   6. CHECKOUT/IN_SESSION/ARRIVED sem orçamento → NÃO FECHOU (compareceu, não fechou)
//   7. futuro/sem status/CONFIRMED → AGENDADO
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { makeClient } from './clinicorp.js'

for (const line of readFileSync(new URL('.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const HELENA = 'https://api.wts.chat'
const helenaAuth = { Authorization: `Bearer ${process.env.HELENA_TOKEN}` }
const panelId = process.env.HELENA_PANEL_ID

const clinicorp = makeClient({
  user:         process.env.CLINICORP_USER,
  token:        process.env.CLINICORP_TOKEN,
  subscriberId: process.env.CLINICORP_SUBSCRIBER,
})

// ── util ─────────────────────────────────────────────────────────────────────
const iso = (d) => d.toISOString().slice(0, 10)
// chave de telefone: DDD + últimos 8 dígitos (tolera 9º dígito e DDI 55)
function phoneKey(raw) {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('55') && d.length > 11) d = d.slice(2)
  if (d.length < 10) return null
  const ddd = d.slice(0, 2)
  return ddd + d.slice(-8)
}

async function helenaGet(path) {
  const res = await fetch(`${HELENA}${path}`, { headers: helenaAuth })
  if (!res.ok) throw new Error(`Helena ${res.status} em ${path}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

// ── 1. Clinicorp: agendamentos (60 dias atrás → 30 à frente) ─────────────────
const today = new Date()
const apptFrom = iso(new Date(today.getTime() - 60 * 86_400_000))
const apptTo   = iso(new Date(today.getTime() + 30 * 86_400_000))
const apptsRaw = await clinicorp.appointments(apptFrom, apptTo, { IncludeCanceled: 'true' })
const appts = Array.isArray(apptsRaw) ? apptsRaw : apptsRaw.items ?? apptsRaw.list ?? []

const { list: statusList } = await clinicorp.statusList()
const statusById = Object.fromEntries(statusList.map(s => [s.id, s]))

// ── 2. Clinicorp: orçamentos (2 janelas de 30 dias) ──────────────────────────
let estimates = []
for (const back of [60, 30]) {
  const f = iso(new Date(today.getTime() - back * 86_400_000))
  const t = iso(new Date(today.getTime() - (back - 30) * 86_400_000))
  const raw = await clinicorp.estimates(f, t)
  estimates = estimates.concat(Array.isArray(raw) ? raw : raw.items ?? raw.list ?? [])
}

// ── 3. Estado-alvo por PACIENTE (chave = id Clinicorp; telefones agregados) ──
// Um paciente pode ter vários telefones (fixo no orçamento, celular na agenda).
// Chavear por telefone gerava duplicata — a chave é o Patient_PersonId, e TODOS
// os telefones vistos ficam disponíveis para o match com o card Helena.
const desired = new Map() // patientId → { target, valor?, motivo, nome, quando, phones:Set }

function propose(key, entry, priority) {
  const pid = entry.clinicorpPatientId ?? key
  if (!pid) return
  const cur = desired.get(pid)
  const phones = cur?.phones ?? new Set()
  if (key) phones.add(key)
  if (!cur || priority > cur.priority) desired.set(pid, { ...entry, priority, phones })
  else cur.phones = phones
}

const hoje = iso(today)
// Histórico anterior ao mês corrente não entra mais no funil (decisão: cards
// de maio/jun importados no piloto foram arquivados — reimportar história
// antiga distorce o período e não compensa o volume de cards gerados).
// Com o cron rodando a cada ~15min em produção isso vira só uma rede de
// segurança: o sync nunca fica dias atrasado, então não há "atraso" a cobrir.
const CUTOFF = hoje.slice(0, 7) + '-01'
for (const a of appts) {
  const key = phoneKey(a.MobilePhone)
  const nome = a.PatientName
  const quando = String(a.date ?? '').slice(0, 10)
  const type = statusById[a.StatusId]?.Type ?? null
  const primeiraConsulta = Boolean(a.FirstAppointment)
  const extra = { nome, quando, time: a.fromTime ?? null, primeiraConsulta, telefone: a.MobilePhone, clinicorpPatientId: a.Patient_PersonId }
  if (a.Deleted === 'X') {
    propose(key, { target: 'DESMARCOU', motivo: `agendamento ${quando} desmarcado`, ...extra }, 2)
  } else if (type === 'MISSED') {
    propose(key, { target: 'FALTOU', motivo: `faltou em ${quando}`, ...extra }, 3)
  } else if (['CHECKOUT', 'IN_SESSION', 'ARRIVED'].includes(type)) {
    propose(key, { target: 'NÃO FECHOU', motivo: `atendido em ${quando} (sem orçamento localizado)`, ...extra }, 4)
  } else if (quando >= hoje) {
    // consulta FUTURA: remarcação reativa o card (única volta permitida no funil)
    propose(key, { target: 'AGENDADO', motivo: `consulta futura ${quando} (${type ?? 'sem status'})`, futura: true, ...extra }, 1)
  }
}

for (const e of estimates) {
  const key = phoneKey(e.PatientMobilePhone)
  const nome = e.PatientName
  const quando = String(e.Date ?? '').slice(0, 10)
  const extra = { nome, quando, telefone: e.PatientMobilePhone, clinicorpPatientId: e.PatientId }
  if (e.Status === 'APPROVED') {
    propose(key, { target: 'FECHOU', valor: e.Amount, motivo: `orçamento APROVADO ${quando} · R$ ${e.Amount}`, ...extra }, 7)
  } else if (e.Status === 'OPEN') {
    propose(key, { target: 'ORÇAMENTO EM ABERTO', valor: e.Amount, motivo: `orçamento em aberto ${quando} · R$ ${e.Amount}`, ...extra }, 6)
  } else if (e.Status === 'REJECTED') {
    propose(key, { target: 'NÃO FECHOU', valor: e.Amount, motivo: `orçamento REPROVADO ${quando}`, ...extra }, 5)
  }
}

// ── 4. Helena: steps + todos os cards do painel (com contatos) ───────────────
const panel = await helenaGet(`/crm/v1/panel/${panelId}?IncludeDetails=Steps`)
const stepByTitle = {}
for (const s of panel.steps ?? []) stepByTitle[s.title.toUpperCase().trim()] = s
const stepTitleById = Object.fromEntries((panel.steps ?? []).map(s => [s.id, s.title]))

// alvo lógico → step real do painel da Lumine
const TARGET_STEP = {
  'AGENDADO':            'AGENDADO',
  'DESMARCOU':           'DESMARCOU',
  'FALTOU':              'FALTOU',
  'NÃO FECHOU':          'NÃO FECHOU',
  'ORÇAMENTO EM ABERTO': 'ORÇAMENTO EM ABERTO',
  'FECHOU':              'FECHOU',
}

let cards = []
for (let pg = 1; pg <= 10; pg++) {
  const page = await helenaGet(`/crm/v1/panel/card?PanelId=${panelId}&PageSize=100&PageNumber=${pg}&IncludeDetails=Contacts`)
  cards = cards.concat(page.items ?? [])
  if (!page.hasMorePages) break
}

// telefone dos contatos (1 chamada por contato, concorrência 10)
const contactIds = [...new Set(cards.map(c => c.contacts?.[0]?.id ?? c.contactIds?.[0]).filter(Boolean))]
const contactPhone = {}
for (let i = 0; i < contactIds.length; i += 10) {
  await Promise.all(contactIds.slice(i, i + 10).map(async (id) => {
    try {
      const res = await fetch(`${HELENA}/core/v1/contact/${id}`, { headers: helenaAuth })
      if (res.ok) {
        const ct = await res.json()
        contactPhone[id] = ct.phoneNumber ?? ct.phoneNumberFormatted ?? null
      }
    } catch {}
  }))
}

const normName = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\(\d+\)/g, '').replace(/[^a-z ]/g, '').trim().split(/\s+/).slice(0, 2).join(' ')

const cardsByPhone = new Map()
const cardsByClinicorpId = new Map()
const cardNames = new Set()
for (const c of cards) {
  if (c.archived) continue
  const cid = c.contacts?.[0]?.id ?? c.contactIds?.[0]
  const key = phoneKey(contactPhone[cid])
  if (key && !cardsByPhone.has(key)) cardsByPhone.set(key, c)
  // vínculo forte: cards já sincronizados carregam o id do paciente Clinicorp
  const clinId = c.metadata?.clinicorp_patient_id
  if (clinId && !cardsByClinicorpId.has(clinId)) cardsByClinicorpId.set(clinId, c)
  const n = normName(c.title)
  if (n) cardNames.add(n)
}

// ── 5. Plano de movimentação ─────────────────────────────────────────────────
// Ranking do funil: card nunca anda "para trás" automaticamente.
// Exceções: consulta FUTURA reativa para AGENDADO; FECHOU é terminal (só recebe valor).
const RANK = { 'LEADS TRAFEGO': 0, 'LEADS FRIOS': 0, 'AGENDADO': 1, 'DESMARCOU': 2, 'FALTOU': 2, 'NÃO FECHOU': 3, 'ORÇAMENTO EM ABERTO': 4, 'FECHOU': 5 }

const moves = [], creates = [], already = [], skipped = [], review = [], antigos = []
for (const [pid, want] of desired) {
  const stepAlvo = stepByTitle[TARGET_STEP[want.target]]
  if (!stepAlvo) continue
  // fato anterior ao cutoff: só atualiza card JÁ existente (ex: reativação
  // futura), nunca cria um novo — evita ressuscitar o histórico arquivado.
  const cardExistente = cardsByClinicorpId.get(String(pid))
    ?? [...want.phones].map(ph => cardsByPhone.get(ph)).find(Boolean)
  if (want.quando < CUTOFF && !cardExistente) { antigos.push(want); continue }
  const card = cardExistente ?? null
  if (!card) {
    // criar só quando é entrada de funil de verdade: 1ª consulta ou tem orçamento
    if (want.primeiraConsulta || want.valor != null || want.target === 'FECHOU') {
      // homônimo no painel sem match de telefone/id → revisão manual, não cria
      if (cardNames.has(normName(want.nome))) {
        review.push({ nome: want.nome, target: want.target, motivo: want.motivo })
      } else {
        creates.push({ nome: want.nome, stepId: stepAlvo.id, step: stepAlvo.title, ...want })
      }
    }
    continue
  }
  const stepAtual = stepTitleById[card.stepId] ?? '?'
  const rankAtual = RANK[stepAtual.toUpperCase().trim()] ?? 0
  const rankAlvo  = RANK[stepAlvo.title.toUpperCase().trim()] ?? 0

  const ehRegressao = rankAlvo < rankAtual
  const reativacao  = want.futura && want.target === 'AGENDADO' && stepAtual !== 'FECHOU'
  const fechouTerminal = stepAtual.toUpperCase().includes('FECHOU') && !stepAtual.toUpperCase().includes('NÃO') && want.target !== 'FECHOU'

  const precisaValor = want.valor > 0 && !(card.monetaryAmount > 0)
  if (fechouTerminal || (ehRegressao && !reativacao)) {
    if (precisaValor && want.target === 'FECHOU') {
      moves.push({ cardId: card.id, card: card.title, stepAtual, stepAlvo: stepAtual, stepAlvoId: card.stepId, valor: want.valor, motivo: want.motivo, clinicorpPatientId: want.clinicorpPatientId })
    } else {
      skipped.push({ card: card.title, de: stepAtual, para: stepAlvo.title, motivo: want.motivo })
    }
    continue
  }

  const precisaMover = card.stepId !== stepAlvo.id
  if (precisaMover || precisaValor) {
    moves.push({
      cardId: card.id, card: card.title, stepAtual,
      stepAlvo: stepAlvo.title, stepAlvoId: stepAlvo.id,
      valor: precisaValor ? want.valor : null, motivo: want.motivo,
      quando: want.quando ?? null, time: want.time ?? null,
      clinicorpPatientId: want.clinicorpPatientId,
    })
  } else {
    already.push(card.title)
  }
}

console.log(`\n=== PLANO DE SINCRONIZAÇÃO (dry-run · nada foi movido) ===`)
console.log(`Clinicorp: ${appts.length} agendamentos · ${estimates.length} orçamentos · ${desired.size} pacientes com estado-alvo`)
console.log(`Helena: ${cards.length} cards no painel · ${cardsByPhone.size} com telefone identificado`)
console.log(`Cutoff: só cria card para fatos a partir de ${CUTOFF} · ${antigos.length} fato(s) anterior(es) ignorado(s) (sem card ativo pra atualizar)\n`)

console.log(`▶ MOVERIA ${moves.length} card(s):`)
for (const m of moves.slice(0, 25)) {
  console.log(`  · "${(m.card ?? '').slice(0, 30)}"  ${m.stepAtual} → ${m.stepAlvo}${m.valor ? ` · grava R$ ${m.valor}` : ''}   [${m.motivo}]`)
}
if (moves.length > 25) console.log(`  … +${moves.length - 25}`)

console.log(`\n▶ CRIARIA ${creates.length} card(s) (paciente Clinicorp sem card no painel):`)
for (const c of creates.slice(0, 15)) {
  console.log(`  · ${c.nome} → ${c.target}${c.valor ? ` · R$ ${c.valor}` : ''}   [${c.motivo}]`)
}
if (creates.length > 15) console.log(`  … +${creates.length - 15}`)

console.log(`\n▶ JÁ CORRETOS: ${already.length} card(s) — sync não tocaria`)

console.log(`\n▶ PROTEGIDOS pela trava anti-regressão: ${skipped.length} card(s) (não rebaixa; FECHOU é terminal)`)
for (const s of skipped.slice(0, 8)) {
  console.log(`  · "${(s.card ?? '').slice(0, 30)}" ficaria ${s.de} (alvo ingênuo era ${s.para})   [${s.motivo}]`)
}

if (review.length) {
  console.log(`\n▶ REVISÃO MANUAL: ${review.length} homônimo(s) no painel sem match de telefone/id — sync NÃO cria:`)
  for (const r of review) console.log(`  · ${r.nome} → ${r.target}   [${r.motivo}]`)
}

mkdirSync(new URL('out/', import.meta.url), { recursive: true })
writeFileSync(new URL('out/sync-plan.json', import.meta.url), JSON.stringify({ moves, creates, already, skipped, review, cutoff: CUTOFF, antigosIgnorados: antigos.length }, null, 2))
console.log(`\nPlano completo salvo em out/sync-plan.json`)
