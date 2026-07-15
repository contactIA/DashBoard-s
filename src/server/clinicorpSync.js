// Motor de sincronização Clinicorp → painel Helena. Uma clínica pode ter
// várias "unidades" (contas Clinicorp separadas, ex: Bueno/Eldorado) que
// compartilham o mesmo painel — cada unidade tem sua própria etiqueta no
// painel, usada pra saber de qual conta veio o card e para marcar os novos.
//
// Validado manualmente (dry-run + apply) na Lumine e na IBS Implantes antes
// de entrar no cron de produção — ver PROJETO CLINICORP + PAINEL/sync-prototype/.
import { makeClinicorpClient } from './clinicorp.js'

const HELENA = 'https://api.wts.chat'

function normalizeHelenaToken(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return null
  return /^bearer /i.test(t) ? t : `Bearer ${t}`
}

const iso = (d) => d.toISOString().slice(0, 10)

// chave de telefone: DDD + últimos 8 dígitos (tolera 9º dígito e DDI 55)
function phoneKey(raw) {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('55') && d.length > 11) d = d.slice(2)
  if (d.length < 10) return null
  return d.slice(0, 2) + d.slice(-8)
}

function fmtDateBR(isoDate) {
  if (!isoDate) return null
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

// Formato ISO local (sem timezone) que a Helena usa nos customFields tipo data
// do card (ex: "agendado-para": "2026-07-08T12:00:00.0000000") — confirmado
// via leitura/escrita real no card da Cristiane (IBS): a Helena aceita string
// simples nesse formato e empacota em array sozinha na leitura. Hora ausente
// (ex: "Agendado em", que é só data) usa meia-noite local.
function isoLocal(dateStr, timeStr) {
  if (!dateStr) return null
  const hhmm = timeStr && /^\d{1,2}:\d{2}$/.test(timeStr) ? timeStr.padStart(5, '0') : '00:00'
  return `${dateStr}T${hhmm}:00.0000000`
}

// Normaliza nome para comparação (acento/caixa/espaços) — usado pelo mapa CRC
// explícito do setup (_crcMap), que casa a etiqueta da Helena com o nome de
// quem agendou no Clinicorp (CreateUserName). Fonte única de casamento: sem
// adivinhação por apelido/prefixo (removida — dava falso-match e era imprevisível).
const normTag = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()

// A fonte da verdade para "qual etapa do painel significa o quê" é o
// mapeamento de MÉTRICAS feito no wizard do /setup (obrigatório no cadastro):
// clinic.steps.<slug> = { id, label, type } — funciona para QUALQUER clínica,
// independente de como ela nomeou as etapas do painel.
const TARGET_TYPE = {
  'AGENDADO': 'scheduled',
  'DESMARCOU': 'cancelled',
  'FALTOU': 'missed',
  'NÃO FECHOU': 'attended',
  'ORÇAMENTO EM ABERTO': 'negotiating',
  'FECHOU': 'converted',
}

// Ranking do funil por TYPE — card nunca anda "para trás" automaticamente.
const TYPE_RANK = {
  lead: 0, notScheduled: 0,
  scheduled: 1, rescheduled: 1,
  cancelled: 2, missed: 2,
  attended: 3, negotiating: 4, converted: 5,
}

// Fallback por título para clínicas antigas cujo mapeamento não cubra um tipo
// (nunca deveria acontecer — o wizard exige mapear as etapas).
const TARGET_STEP_FALLBACK = {
  'AGENDADO': ['AGENDOU', 'AGENDADO'],
  'DESMARCOU': ['DESMARCOU', 'CANCELOU'],
  'FALTOU': ['FALTOU', 'NÃO COMPARECEU'],
  'NÃO FECHOU': ['NÃO FECHOU', 'COMPARECEU E NÃO FECHOU'],
  'ORÇAMENTO EM ABERTO': ['ORÇAMENTO EM ABERTO'],
  'FECHOU': ['FECHOU', 'COMPARECEU E FECHOU'],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Helena/Clinicorp devolvem 429 quando o limite da CONTA é excedido (o limite
// é por conta, não global — clínicas diferentes não competem entre si). Sem
// isso, um 429 esporádico contava como falha; com retry, só atrasa a ação.
async function withRetry429(fn, { attempts = 3, baseDelayMs = 2000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      if (err.status === 429 && i < attempts - 1) {
        await sleep(baseDelayMs * (i + 1))
        continue
      }
      throw err
    }
  }
}

/**
 * Sincroniza uma clínica (todas as suas unidades Clinicorp) com o painel
 * Helena. `clinic` = { accountId, name, panelId, token, steps } (linha crua
 * da tabela `clinics`, com token e steps._clinicorp sem máscara).
 * Retorna um resumo — nunca lança; erros por unidade ficam em `errors`.
 */
export async function syncClinicClinicorp(clinic) {
  const units = clinic.steps?._clinicorp?.units ?? []
  const summary = { clinic: clinic.name, accountId: clinic.accountId, moved: 0, created: 0, failed: 0, errors: [], unmatchedCrc: new Set() }
  if (!units.length) return summary

  const helenaAuth = { Authorization: normalizeHelenaToken(clinic.token) }
  const panelId = clinic.panelId

  async function helenaRaw(method, path, body) {
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
  const helena = (method, path, body) => withRetry429(() => helenaRaw(method, path, body))
  const helenaGet = (path) => helena('GET', path)

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
      await sleep(120)
    }
    const created = await helena('POST', '/core/v1/contact', { name: nome, phoneNumber: `+${candidates[0]}` })
    return created?.id ? { id: created.id, created: true } : null
  }

  let panel
  try {
    panel = await helenaGet(`/crm/v1/panel/${panelId}?IncludeDetails=Steps&IncludeDetails=Tags`)
  } catch (err) {
    summary.errors.push(`painel: ${err.message}`)
    return summary
  }
  const stepByTitle = {}
  for (const s of panel.steps ?? []) stepByTitle[s.title.toUpperCase().trim()] = s
  const stepTitleById = Object.fromEntries((panel.steps ?? []).map((s) => [s.id, s.title]))
  const stepById = Object.fromEntries((panel.steps ?? []).map((s) => [s.id, s]))

  // Mapeamento do setup: type → stepId e stepId → type (fonte da verdade)
  const stepIdByType = {}
  const typeByStepId = {}
  for (const [key, s] of Object.entries(clinic.steps ?? {})) {
    if (key.startsWith('_') || !s?.type || !s?.id) continue
    if (!stepIdByType[s.type]) stepIdByType[s.type] = s.id
    typeByStepId[s.id] = s.type
  }

  const resolveStep = (target) => {
    // 1º: pelo tipo mapeado no setup (funciona com qualquer nome de etapa)
    const mappedId = stepIdByType[TARGET_TYPE[target]]
    if (mappedId && stepById[mappedId]) return stepById[mappedId]
    // 2º: fallback por títulos conhecidos (clínicas antigas/mapeamento incompleto)
    for (const cand of TARGET_STEP_FALLBACK[target] ?? []) if (stepByTitle[cand]) return stepByTitle[cand]
    return null
  }

  // Ranking anti-regressão pelo TYPE do setup; título conhecido como fallback
  const TITLE_RANK_FALLBACK = {
    'LEADS TRAFEGO': 0, 'LEADS FRIOS': 0, 'LEAD': 0, 'NÃO AGENDADO': 0,
    'AGENDADO': 1, 'AGENDOU': 1,
    'DESMARCOU': 2, 'CANCELOU': 2, 'FALTOU': 2, 'NÃO COMPARECEU': 2,
    'NÃO FECHOU': 3, 'COMPARECEU E NÃO FECHOU': 3,
    'ORÇAMENTO EM ABERTO': 4,
    'FECHOU': 5, 'COMPARECEU E FECHOU': 5,
  }
  const rankOfStep = (stepId) => {
    const type = typeByStepId[stepId]
    if (type in TYPE_RANK) return TYPE_RANK[type]
    return TITLE_RANK_FALLBACK[(stepTitleById[stepId] ?? '').toUpperCase().trim()] ?? 0
  }

  // _dates (setup): quais customFields do card recebem "Agendado Para" (data+hora
  // da consulta, campo único) e "Agendado em" (dia em que o agendamento foi
  // criado no Clinicorp). Ausente → LEGADO (keys fixas 'data'/'hor-rio', como
  // antes desta mudança) — não mexe em clínica que ainda não migrou no wizard.
  const dateCfg = clinic.steps?._dates ?? null
  function buildDateCustomFields(quando, time, criadoEm) {
    if (!dateCfg) {
      return quando ? { data: fmtDateBR(quando), ...(time ? { 'hor-rio': time } : {}) } : null
    }
    const cf = {}
    const sf = dateCfg.scheduledFor
    if (sf?.key && quando) {
      // "Agendado Para" é campo único data+hora, formato ISO local da Helena
      cf[sf.key] = isoLocal(quando, time)
    }
    const ca = dateCfg.createdAt
    if (ca?.key && criadoEm) cf[ca.key] = isoLocal(criadoEm, null) // "Agendado em" (só data)
    return Object.keys(cf).length ? cf : null
  }

  let cards = []
  try {
    for (let pg = 1; pg <= 20; pg++) {
      const page = await helenaGet(`/crm/v1/panel/card?PanelId=${panelId}&PageSize=100&PageNumber=${pg}&IncludeDetails=Contacts`)
      cards = cards.concat(page.items ?? [])
      if (!page.hasMorePages) break
    }
  } catch (err) {
    summary.errors.push(`cards: ${err.message}`)
    return summary
  }

  const contactIds = [...new Set(cards.map((c) => c.contacts?.[0]?.id ?? c.contactIds?.[0]).filter(Boolean))]
  const contactPhone = {}
  for (let i = 0; i < contactIds.length; i += 10) {
    await Promise.all(contactIds.slice(i, i + 10).map(async (id) => {
      try {
        const res = await fetch(`${HELENA}/core/v1/contact/${id}`, { headers: helenaAuth })
        if (res.ok) { const ct = await res.json(); contactPhone[id] = ct.phoneNumber ?? ct.phoneNumberFormatted ?? null }
      } catch { /* best-effort */ }
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

  const today = new Date()
  const hoje = iso(today)

  const allMoves = [], allCreates = []

  for (const unit of units) {
    if (!unit.user || !unit.token) continue
    // Corte FIXO por unidade — a data em que ela foi vinculada no setup
    // (unit.syncSince). Sem isso, um corte recalculado a cada rodada ("início
    // do mês corrente") avança sozinho: um fato de julho que só aparece no
    // Clinicorp em agosto (ex: orçamento aprovado com atraso) seria perdido
    // porque o corte já teria virado para agosto. Unidades antigas sem o
    // campo (vinculadas antes desta correção) caem no fallback por mês.
    const CUTOFF = unit.syncSince || (hoje.slice(0, 7) + '-01')
    const clinicorp = makeClinicorpClient({ user: unit.user, token: unit.token, subscriberId: unit.user })

    // Mapa CRC POR UNIDADE (unit.crcMap): a mesma pessoa pode existir como
    // usuário diferente em cada conta Clinicorp (ex: "Gabriela Vieira Da
    // Silva" no Bueno, "Gabriela Vieira" no Eldorado) — por isso o mapa não é
    // por clínica, é por unidade. Fonte ÚNICA de casamento, sem adivinhação
    // por apelido/prefixo; sem match, o card é criado sem etiqueta de CRC e o
    // nome vai para unmatchedCrc, para o admin revisar/mapear depois.
    const crcMap = unit.crcMap ?? []
    const resolveCrcTagId = (createUserName) => {
      if (!createUserName || !crcMap.length) return null
      const alvo = normTag(createUserName)
      for (const m of crcMap) {
        if (!m.clinicorpName || !m.tagId) continue
        if (normTag(m.clinicorpName) === alvo) return m.tagId
      }
      return null
    }

    const apptFrom = iso(new Date(today.getTime() - 60 * 86_400_000))
    const apptTo = iso(new Date(today.getTime() + 30 * 86_400_000))
    let appts = []
    try {
      const raw = await clinicorp.appointments(apptFrom, apptTo, { IncludeCanceled: 'true' })
      appts = Array.isArray(raw) ? raw : raw.items ?? raw.list ?? []
    } catch (err) { summary.errors.push(`[${unit.label || unit.user}] appointments: ${err.message}`); continue }

    let statusById = {}
    try {
      const { list } = await clinicorp.statusList()
      statusById = Object.fromEntries((list ?? []).map((s) => [s.id, s]))
    } catch { /* best-effort */ }

    let estimates = []
    for (const back of [60, 30]) {
      const f = iso(new Date(today.getTime() - back * 86_400_000))
      const t = iso(new Date(today.getTime() - (back - 30) * 86_400_000))
      try {
        const raw = await clinicorp.estimates(f, t)
        estimates = estimates.concat(Array.isArray(raw) ? raw : raw.items ?? raw.list ?? [])
      } catch (err) { summary.errors.push(`[${unit.label || unit.user}] estimates ${f}..${t}: ${err.message}`) }
    }

    const desired = new Map()
    const propose = (pid, entry, priority) => {
      if (!pid) return
      const cur = desired.get(String(pid))
      if (!cur || priority > cur.priority) desired.set(String(pid), { ...entry, priority })
    }
    // "Quem agendou" rastreado à parte da prioridade — um orçamento aprovado
    // (prioridade 7) pode vencer o estado do card sem apagar quem atendeu.
    const agendadorByPatient = new Map()
    for (const a of appts) {
      const quando = String(a.date ?? '').slice(0, 10)
      const type = statusById[a.StatusId]?.Type ?? null
      if (a.Patient_PersonId && a.CreateUserName) agendadorByPatient.set(String(a.Patient_PersonId), a.CreateUserName)
      const criadoEm = String(a.CreateDate ?? '').slice(0, 10) || null // "Agendado em": dia em que o agendamento foi criado no Clinicorp
      const extra = { nome: a.PatientName, quando, time: a.fromTime ?? null, criadoEm, telefone: a.MobilePhone, patientId: a.Patient_PersonId, primeiraConsulta: Boolean(a.FirstAppointment) }
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

    for (const [pid, want] of desired) {
      const stepAlvo = resolveStep(want.target)
      if (!stepAlvo) continue
      const key = phoneKey(want.telefone)
      const card = cardsByClinicorpId.get(pid) ?? (key ? cardsByPhone.get(key) : null)
      if (want.quando < CUTOFF && !card) continue // histórico velho: só atualiza, nunca cria

      if (!card) {
        if (want.primeiraConsulta || want.valor != null || want.target === 'FECHOU') {
          const crcNome = agendadorByPatient.get(pid) ?? null
          const crcTagId = resolveCrcTagId(crcNome) // SÓ o mapa do setup (_crcMap) — sem adivinhação
          if (crcNome && !crcTagId) summary.unmatchedCrc.add(crcNome)
          allCreates.push({ unidade: unit.label || unit.user, tagId: unit.tagId, crcTagId, stepId: stepAlvo.id, step: stepAlvo.title, nome: want.nome, telefone: want.telefone, patientId: pid, valor: want.valor ?? null, quando: want.quando, time: want.time ?? null, criadoEm: want.criadoEm ?? null, motivo: want.motivo })
        }
        continue
      }

      const ehRegressao = rankOfStep(stepAlvo.id) < rankOfStep(card.stepId)
      const reativacao = want.futura && want.target === 'AGENDADO' && rankOfStep(card.stepId) < 5
      const fechouTerminal = rankOfStep(card.stepId) === 5 && want.target !== 'FECHOU'
      const precisaValor = want.valor > 0 && !(card.monetaryAmount > 0)

      if (fechouTerminal || (ehRegressao && !reativacao)) {
        if (precisaValor && want.target === 'FECHOU') {
          allMoves.push({ cardId: card.id, card: card.title, stepAlvoId: card.stepId, valor: want.valor, quando: want.quando, time: want.time ?? null, criadoEm: want.criadoEm ?? null, patientId: pid })
        }
        continue
      }

      const precisaMover = card.stepId !== stepAlvo.id
      if (precisaMover || precisaValor) {
        allMoves.push({ cardId: card.id, card: card.title, stepAlvoId: stepAlvo.id, valor: precisaValor ? want.valor : null, quando: want.quando, time: want.time ?? null, criadoEm: want.criadoEm ?? null, patientId: pid })
      }
    }
  }

  for (const m of allMoves) {
    try {
      const body = { metadata: { clinicorp_patient_id: String(m.patientId ?? '') } }
      const fields = ['metadata']
      if (m.stepAlvoId) { body.stepId = m.stepAlvoId; fields.push('stepId') }
      if (m.valor > 0) { body.monetaryAmount = m.valor; fields.push('monetaryAmount') }
      const cf = buildDateCustomFields(m.quando, m.time, m.criadoEm)
      if (cf) { body.customFields = cf; fields.push('customFields') }
      if (m.quando) body.metadata.clinicorp_event_date = m.quando
      body.fields = fields
      await helena('PUT', `/crm/v2/panel/card/${m.cardId}`, body)
      summary.moved++
    } catch (err) { summary.failed++; summary.errors.push(`move "${m.card}": ${err.message}`) }
    await sleep(250)
  }

  for (const c of allCreates) {
    try {
      const contact = await findOrCreateContact(c.nome, c.telefone)
      await sleep(150)
      const tagIds = [c.tagId, c.crcTagId].filter(Boolean)
      const cf = buildDateCustomFields(c.quando, c.time, c.criadoEm)
      const body = {
        stepId: c.stepId, title: c.nome,
        ...(contact ? { contactIds: [contact.id] } : {}),
        ...(tagIds.length ? { tagIds } : {}),
        ...(c.valor > 0 ? { monetaryAmount: c.valor } : {}),
        ...(cf ? { customFields: cf } : {}),
        metadata: { clinicorp_patient_id: String(c.patientId ?? ''), clinicorp_origem: c.motivo, ...(c.quando ? { clinicorp_event_date: c.quando } : {}) },
      }
      await helena('POST', '/crm/v1/panel/card', body)
      summary.created++
    } catch (err) { summary.failed++; summary.errors.push(`create "${c.nome}": ${err.message}`) }
    await sleep(250)
  }

  summary.unmatchedCrc = [...summary.unmatchedCrc]
  return summary
}
