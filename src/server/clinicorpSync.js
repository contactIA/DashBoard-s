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
  // `moves` detalha cada PUT aplicado (card + flags que o dispararam) — é o
  // que permite diagnosticar um move que não converge (re-aplicado toda rodada).
  const summary = { clinic: clinic.name, accountId: clinic.accountId, moved: 0, created: 0, failed: 0, errors: [], unmatchedCrc: new Set(), moves: [] }
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
  // da consulta, campo único), "Agendado em" (dia em que o agendamento foi
  // criado no Clinicorp) e "Fechado em" (dia em que o ORÇAMENTO foi aprovado —
  // pode ser meses depois da consulta, ex: agendado 28/05, consulta 03/06,
  // fechou só em 20/07: as 3 datas são INDEPENDENTES, nenhuma sobrescreve a
  // outra). Ausente → LEGADO (keys fixas 'data'/'hor-rio') — não mexe em
  // clínica que ainda não migrou no wizard.
  const dateCfg = clinic.steps?._dates ?? null
  function buildDateCustomFields(quando, time, criadoEm, fechadoEm) {
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
    const fe = dateCfg.closedAt
    if (fe?.key && fechadoEm) cf[fe.key] = isoLocal(fechadoEm, null) // "Fechado em" (só data)
    return Object.keys(cf).length ? cf : null
  }

  // Lê o valor atual de um customField do card — a Helena devolve tanto valor
  // simples quanto array de 1 item, dependendo do campo (confirmado via leitura
  // real). Confirmado por teste real (scripts/test-customfields-merge.mjs) que o
  // PUT de customFields faz MERGE, não REPLACE.
  const cardFieldValue = (card, key) => {
    const v = card.customFields?.[key]
    return Array.isArray(v) ? v[0] ?? null : v ?? null
  }

  let cards = []
  try {
    for (let pg = 1; pg <= 20; pg++) {
      const page = await helenaGet(`/crm/v1/panel/card?PanelId=${panelId}&PageSize=100&PageNumber=${pg}&IncludeDetails=Contacts&IncludeDetails=CustomFields`)
      cards = cards.concat(page.items ?? [])
      if (!page.hasMorePages) break
    }
  } catch (err) {
    summary.errors.push(`cards: ${err.message}`)
    return summary
  }

  // Telefones dos contatos: base do dedup por telefone (cardsByPhone). Um 429
  // aqui NÃO pode ser engolido em silêncio — sem o telefone, o dedup fica cego
  // e o sync CRIA CARD DUPLICADO para paciente com cadastro dobrado no
  // Clinicorp (aconteceu de verdade em 16/07: 5 duplicatas em uma rodada que
  // estourou rate-limit). withRetry429 + falha residual registrada em errors.
  const contactIds = [...new Set(cards.map((c) => c.contacts?.[0]?.id ?? c.contactIds?.[0]).filter(Boolean))]
  const contactPhone = {}
  let contactFetchFails = 0
  for (let i = 0; i < contactIds.length; i += 10) {
    await Promise.all(contactIds.slice(i, i + 10).map(async (id) => {
      try {
        const ct = await helenaGet(`/core/v1/contact/${id}`)
        contactPhone[id] = ct?.phoneNumber ?? ct?.phoneNumberFormatted ?? null
      } catch { contactFetchFails++ }
    }))
  }
  if (contactFetchFails > 0) summary.errors.push(`contatos: ${contactFetchFails} telefone(s) não carregado(s) — dedup por telefone parcial nesta rodada`)

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

  const allMoves = [], allCreates = [], moveCandidates = []
  // Só etiquetas conhecidas por algum crcMap podem ser removidas/trocadas pelo
  // MOVE — protege tags de unidade/origem/etc., que não fazem parte disso.
  const allCrcTagIds = new Set(units.flatMap((u) => (u.crcMap ?? []).map((m) => m.tagId)))

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
      const criadoEm = String(a.CreateDate ?? '').slice(0, 10) || null // "Agendado em": dia em que o agendamento foi criado no Clinicorp
      // Guarda o agendamento mais recente por DATA DO AGENDADO EM (CreateDate) —
      // com 2+ agendamentos do paciente na janela, "quem agendou por último" vence,
      // consistente com o valor gravado em customFields['agendado-em-'] (want.criadoEm).
      if (a.Patient_PersonId && a.CreateUserName) {
        const pid0 = String(a.Patient_PersonId)
        const agendadoEm = String(criadoEm ?? '')
        const prevAgendador = agendadorByPatient.get(pid0)
        if (!prevAgendador || agendadoEm > prevAgendador.agendadoEm) {
          agendadorByPatient.set(pid0, { nome: a.CreateUserName, agendadoEm })
        }
      }
      const extra = { nome: a.PatientName, quando, time: a.fromTime ?? null, criadoEm, telefone: a.MobilePhone, patientId: a.Patient_PersonId, primeiraConsulta: Boolean(a.FirstAppointment) }
      if (a.Deleted === 'X') propose(a.Patient_PersonId, { target: 'DESMARCOU', motivo: `desmarcado ${quando}`, ...extra }, 2)
      else if (type === 'MISSED') propose(a.Patient_PersonId, { target: 'FALTOU', motivo: `faltou ${quando}`, ...extra }, 3)
      else if (['CHECKOUT', 'IN_SESSION', 'ARRIVED'].includes(type)) propose(a.Patient_PersonId, { target: 'NÃO FECHOU', motivo: `atendido ${quando}`, ...extra }, 4)
      else if (quando >= hoje) propose(a.Patient_PersonId, { target: 'AGENDADO', motivo: `consulta futura ${quando}`, futura: true, ...extra }, 1)
    }
    // e.Date (≈ LastChange_Date, confirmado contra a API real 20/07: diferença
    // de 1-2s) é QUANDO O STATUS DO ORÇAMENTO MUDOU pela última vez — para
    // FECHOU (aprovado), essa é a data de FECHAMENTO, que pode ser meses depois
    // da consulta (visto na prática: orçamento criado dez/25, aprovado jun/26).
    // NUNCA é a data do "Agendado Para" — por isso `quando` aqui fica de fora
    // do desejo (não é usado pelo CUTOFF/criação de card por agendamento) e
    // vira `fechadoEm`, gravado só no novo campo "Fechado em" (dateCfg.closedAt).
    for (const e of estimates) {
      const fechadoEm = String(e.Date ?? '').slice(0, 10)
      const extra = { nome: e.PatientName, fechadoEm, telefone: e.PatientMobilePhone, patientId: e.PatientId }
      if (e.Status === 'APPROVED') propose(e.PatientId, { target: 'FECHOU', valor: e.Amount, motivo: `orçamento APROVADO ${fechadoEm} · R$ ${e.Amount}`, ...extra }, 7)
      else if (e.Status === 'OPEN') propose(e.PatientId, { target: 'ORÇAMENTO EM ABERTO', valor: e.Amount, motivo: `orçamento em aberto ${fechadoEm} · R$ ${e.Amount}`, ...extra }, 6)
      else if (e.Status === 'REJECTED') propose(e.PatientId, { target: 'NÃO FECHOU', valor: e.Amount, motivo: `orçamento REPROVADO ${fechadoEm}`, ...extra }, 5)
    }

    for (const [pid, want] of desired) {
      const stepAlvo = resolveStep(want.target)
      if (!stepAlvo) continue
      const key = phoneKey(want.telefone)
      const card = cardsByClinicorpId.get(pid) ?? (key ? cardsByPhone.get(key) : null)
      // Corte por histórico velho: desejos de ESTIMATE (FECHOU/aberto/reprovado)
      // não têm `quando` (data de agendamento) — não fazem sentido criar card
      // sozinhos sem uma consulta associada, então o corte não se aplica a eles
      // (want.quando undefined → comparação sempre falsa → nunca bloqueia,
      // mas a criação abaixo já exige want.target === 'FECHOU' explicitamente).
      if (want.quando < CUTOFF && !card) continue // histórico velho: só atualiza, nunca cria

      if (!card) {
        if (want.primeiraConsulta || want.valor != null || want.target === 'FECHOU') {
          const crcNome = agendadorByPatient.get(pid)?.nome ?? null
          const crcTagId = resolveCrcTagId(crcNome) // SÓ o mapa do setup (_crcMap) — sem adivinhação
          if (crcNome && !crcTagId) summary.unmatchedCrc.add(crcNome)
          allCreates.push({ unidade: unit.label || unit.user, tagId: unit.tagId, crcTagId, stepId: stepAlvo.id, step: stepAlvo.title, nome: want.nome, telefone: want.telefone, patientId: pid, valor: want.valor ?? null, quando: want.quando ?? null, time: want.time ?? null, criadoEm: want.criadoEm ?? null, fechadoEm: want.fechadoEm ?? null, motivo: want.motivo })
        }
        continue
      }

      // NÃO decide nada ainda — só registra o candidato. Paciente com cadastro
      // DOBRADO no Clinicorp (2 pids, ou o mesmo pid em 2 unidades) gera 2+
      // desejos para o MESMO card; decidir por desejo causava ping-pong eterno
      // (ex: pid "fechou 10/07" satisfeito não gera move, aí o pid "faltou
      // 01/07" vira o único candidato e desfaz — observado 16/07 na NEUSA).
      // A escolha do vencedor por card (maior prioridade) acontece DEPOIS,
      // sobre TODOS os desejos, satisfeitos ou não.
      moveCandidates.push({ card, want, pid, stepAlvo, crcTagId: resolveCrcTagId(agendadorByPatient.get(pid)?.nome ?? null) })
    }
  }

  // Vencedor por card: maior prioridade entre todos os desejos que resolvem
  // para ele (FECHOU=7 > aberto=6 > reprovado=5 > atendido=4 > faltou=3 >
  // desmarcou=2 > futura=1). Só o vencedor tem flags calculadas.
  const bestByCard = new Map()
  for (const cand of moveCandidates) {
    const cur = bestByCard.get(cand.card.id)
    if (!cur || cand.want.priority > cur.want.priority) bestByCard.set(cand.card.id, cand)
  }

  for (const { card, want, pid, stepAlvo, crcTagId } of bestByCard.values()) {
    const ehRegressao = rankOfStep(stepAlvo.id) < rankOfStep(card.stepId)
    const reativacao = want.futura && want.target === 'AGENDADO' && rankOfStep(card.stepId) < 5
    const fechouTerminal = rankOfStep(card.stepId) === 5 && want.target !== 'FECHOU'
    const precisaValor = want.valor > 0 && !(card.monetaryAmount > 0)
    // Agendador DINÂMICO: a etiqueta de CRC acompanha quem agendou por ÚLTIMO
    // (agendadorByPatient já resolvido pela data do Agendado em). Sem match
    // (nome fora do crcMap) → crcTagId null → NÃO mexe em tagIds (decisão 2).
    const cardTagIds = card.tagIds ?? []
    const precisaCrc = Boolean(crcTagId) && !cardTagIds.includes(crcTagId)
    // "Fechado em" (novo campo, 20/07): grava a data de APROVAÇÃO do orçamento
    // SEM NUNCA tocar em "Agendado Para" — as 3 datas (agendado em/agendado
    // para/fechado em) são independentes. Repara mesmo em card já FECHOU
    // (fechouTerminal), pois o orçamento pode ser reaprovado/atualizado depois.
    const precisaFechadoEm = want.target === 'FECHOU' && Boolean(want.fechadoEm) &&
      dateCfg?.closedAt?.key && cardFieldValue(card, dateCfg.closedAt.key)?.slice(0, 10).replace(/\//g, '-') !== want.fechadoEm

    if (fechouTerminal || (ehRegressao && !reativacao)) {
      if ((precisaValor && want.target === 'FECHOU') || precisaCrc || precisaFechadoEm) {
        allMoves.push({ cardId: card.id, card: card.title, stepAlvoId: card.stepId, valor: (precisaValor && want.target === 'FECHOU') ? want.valor : null, quando: null, time: null, criadoEm: null, fechadoEm: want.fechadoEm ?? null, patientId: pid, crcTagId, cardTagIds, flags: { precisaValor, precisaCrc, precisaFechadoEm, terminal: true } })
      }
      continue
    }

    const precisaMover = card.stepId !== stepAlvo.id
    if (precisaMover || precisaValor || precisaCrc || precisaFechadoEm) {
      allMoves.push({ cardId: card.id, card: card.title, stepAlvoId: stepAlvo.id, valor: precisaValor ? want.valor : null, quando: want.quando ?? null, time: want.time ?? null, criadoEm: want.criadoEm ?? null, fechadoEm: want.fechadoEm ?? null, patientId: pid, crcTagId, cardTagIds, flags: { precisaMover, precisaValor, precisaCrc, precisaFechadoEm } })
    }
  }

  // Modo dry-run (CLINICORP_SYNC_DRY_RUN=1): monta tudo, não escreve nada —
  // usado para diagnosticar moves sem tocar em produção.
  const DRY = process.env.CLINICORP_SYNC_DRY_RUN === '1'

  for (const m of allMoves) {
    try {
      // Leitura FRESCA por ID antes de escrever: a LISTAGEM paginada do painel
      // pode vir defasada (observado 16/07 — card já movido reaparecia na
      // lista com o step antigo). Duas consequências práticas:
      //   1. pular o move se o card já está no estado desejado (evita re-PUT
      //      idempotente toda rodada enquanto a lista não atualiza);
      //   2. montar tagIds a partir das tags ATUAIS reais, não das da lista
      //      (senão uma tag adicionada há minutos seria removida sem querer).
      // No DRY, usa o estado da listagem mesmo (sem custo extra por card).
      const fresh = DRY ? null : await helenaGet(`/crm/v1/panel/card/${m.cardId}`)
      const tagsAtuais = fresh?.tagIds ?? m.cardTagIds ?? []

      const body = { metadata: { clinicorp_patient_id: String(m.patientId ?? '') } }
      const fields = ['metadata']
      if (m.stepAlvoId) { body.stepId = m.stepAlvoId; fields.push('stepId') }
      if (m.valor > 0) { body.monetaryAmount = m.valor; fields.push('monetaryAmount') }
      const cf = buildDateCustomFields(m.quando, m.time, m.criadoEm, m.fechadoEm)
      if (cf) { body.customFields = cf; fields.push('customFields') }
      // clinicorp_event_date alimenta o KPI "em que mês o card conta" (ver
      // effectiveDate em src/utils/parseCards.js) — para FECHOU, é o fechadoEm
      // (data de aprovação, pode ser meses após a consulta); para os demais
      // desfechos, é a data do agendamento (m.quando). NUNCA os dois juntos.
      const eventDate = m.fechadoEm ?? m.quando
      if (eventDate) body.metadata.clinicorp_event_date = eventDate
      if (m.crcTagId && !tagsAtuais.includes(m.crcTagId)) {
        // Troca SÓ etiquetas de CRC mapeadas (allCrcTagIds); unidade/origem/etc.
        // intocáveis. m.crcTagId null (sem match) → não entra aqui, tagIds intocado.
        body.tagIds = [...tagsAtuais.filter((t) => !allCrcTagIds.has(t)), m.crcTagId]
        fields.push('tagIds')
      }
      body.fields = fields
      if (DRY) {
        summary.moves.push({ card: m.card, cardId: m.cardId, stepAlvo: stepTitleById[m.stepAlvoId] ?? m.stepAlvoId, flags: m.flags ?? null, quando: eventDate ?? null, dryBody: body })
        continue
      }

      // Já convergiu? (estado fresco = desejado) → nada a escrever nesta rodada.
      const stepJaOk = !body.stepId || fresh?.stepId === body.stepId
      const tagsJaOk = !body.tagIds
      const valorJaOk = !(m.valor > 0) || fresh?.monetaryAmount > 0
      const dataJaOk = !eventDate || fresh?.metadata?.clinicorp_event_date === eventDate
      if (stepJaOk && tagsJaOk && valorJaOk && dataJaOk) continue
      // Verificação pós-escrita: observado em 16/07 que a Helena às vezes
      // responde 200 SEM aplicar stepId/tagIds (no-op silencioso — o mesmo
      // body reenviado depois aplica normal). Relê o card e retenta 1x;
      // persistindo, conta como falha VISÍVEL em vez de "moved" mentiroso.
      let aplicado = false
      for (let tentativa = 0; tentativa < 2 && !aplicado; tentativa++) {
        if (tentativa > 0) await sleep(1000)
        await helena('PUT', `/crm/v2/panel/card/${m.cardId}`, body)
        await sleep(400)
        const check = await helenaGet(`/crm/v1/panel/card/${m.cardId}`)
        const stepOk = !body.stepId || check?.stepId === body.stepId
        const tagsOk = !body.tagIds || (check?.tagIds ?? []).includes(m.crcTagId)
        aplicado = stepOk && tagsOk
      }
      if (!aplicado) {
        summary.failed++
        summary.errors.push(`move "${m.card}": PUT 200 mas stepId/tagIds não aplicados (2 tentativas)`)
        continue
      }
      summary.moved++
      summary.moves.push({ card: m.card, flags: m.flags ?? null, quando: eventDate ?? null })
    } catch (err) { summary.failed++; summary.errors.push(`move "${m.card}": ${err.message}`) }
    await sleep(250)
  }

  // Com dedup por telefone parcial (429 residual), criar é arriscado — um
  // paciente com cadastro dobrado no Clinicorp poderia virar card duplicado.
  // Adia TODOS os creates para a próxima rodada (30 min), que é barato;
  // duplicar card em produção não é.
  if (contactFetchFails > 0 && allCreates.length > 0) {
    summary.errors.push(`creates adiados: ${allCreates.length} card(s) não criado(s) nesta rodada por dedup parcial`)
    allCreates.length = 0
  }
  if (DRY && allCreates.length > 0) {
    summary.errors.push(`DRY: ${allCreates.length} create(s) suprimido(s): ${allCreates.map((c) => c.nome).join(', ')}`)
    allCreates.length = 0
  }

  for (const c of allCreates) {
    try {
      const contact = await findOrCreateContact(c.nome, c.telefone)
      await sleep(150)
      const tagIds = [c.tagId, c.crcTagId].filter(Boolean)
      const cf = buildDateCustomFields(c.quando, c.time, c.criadoEm, c.fechadoEm)
      // Mesma regra do move: event_date é fechadoEm quando há fechamento,
      // senão a data do agendamento — nunca os dois somados/confundidos.
      const eventDate = c.fechadoEm ?? c.quando
      const body = {
        stepId: c.stepId, title: c.nome,
        ...(contact ? { contactIds: [contact.id] } : {}),
        ...(tagIds.length ? { tagIds } : {}),
        ...(c.valor > 0 ? { monetaryAmount: c.valor } : {}),
        ...(cf ? { customFields: cf } : {}),
        metadata: { clinicorp_patient_id: String(c.patientId ?? ''), clinicorp_origem: c.motivo, ...(eventDate ? { clinicorp_event_date: eventDate } : {}) },
      }
      await helena('POST', '/crm/v1/panel/card', body)
      summary.created++
    } catch (err) { summary.failed++; summary.errors.push(`create "${c.nome}": ${err.message}`) }
    await sleep(250)
  }

  summary.unmatchedCrc = [...summary.unmatchedCrc]
  return summary
}
