/**
 * Nome/telefone para exibição: prioriza o que o backend extraiu via _extract
 * (inclui contato vinculado na Helena); o parse do título é só fallback para
 * clínicas legadas sem extração configurada.
 */
export function withContact(c) {
  const t = parseTitle(c.title)
  return { ...c, name: c.name ?? t.name, phone: c.phone ?? t.phone }
}

/** Extrai nome e telefone do título do card: "Nome:X - Telefone: Y" */
export function parseTitle(title) {
  if (!title) return { name: 'Sem nome', phone: null }
  const m = title.match(/Nome:\s*(.+?)\s*-\s*Telefone:\s*(\d+)/i)
  if (m) return { name: m[1].trim(), phone: m[2] }
  // Formato "Nome, nascimento, HH:MM, AAAA-MM-DD" — usa só o nome
  const parts = title.split(',').map(p => p.trim())
  if (parts.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[parts.length - 1])) {
    return { name: parts[0] || 'Sem nome', phone: null }
  }
  return { name: title, phone: null }
}

/** Formata telefone: 11 dígitos → (XX) 9XXXX-XXXX, 10 → (XX) XXXX-XXXX */
export function fmtPhone(phone) {
  if (!phone) return null
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return phone
}

/** Formata valor em BRL, com opção compacta */
export function fmtBRL(n, { short = false } = {}) {
  if (short && n >= 1000) {
    if (n >= 1_000_000) return 'R$ ' + (n / 1_000_000).toFixed(1).replace('.', ',') + 'M'
    return 'R$ ' + Math.round(n / 1000) + 'k'
  }
  return 'R$ ' + n.toLocaleString('pt-BR')
}

/**
 * Data efetiva do card para "aconteceu no período" — rastreia atividade no
 * pipeline, não a data do agendamento em si (essa é só exibida, ver `date`):
 *   - Lead (topo do funil, ainda não trabalhado): data de CRIAÇÃO.
 *   - Qualquer outra etapa (agendou, reagendou, cancelou, faltou, etc.):
 *     data da ÚLTIMA ATUALIZAÇÃO — aproxima quando o card entrou nesse estado.
 */
export function effectiveDate(c) {
  // Data REAL do evento (ex: sync Clinicorp grava quando o paciente fechou/
  // faltou/desmarcou) — sem ela, um card criado/movido hoje sobre um fato de
  // junho contaria como receita de julho.
  if (c?.eventDate) return c.eventDate
  if (c?.stepType === 'lead') return c?.createdAt?.slice(0, 10) ?? null
  return c?.updatedAt?.slice(0, 10) ?? c?.createdAt?.slice(0, 10) ?? null
}

/** O card cai no período [from, to] pela data efetiva? */
export function inPeriod(c, from, to) {
  const d = effectiveDate(c)
  return Boolean(d && d >= from && d <= to)
}

/** O lead foi AGENDADO no período? (barra "Agendaram" do funil)
 *  Usa a data "Agendado em" (c.scheduledAt — dia em que a CRC/IA/sync marcou o
 *  agendamento), distinta da data da consulta (c.date, "Agendado Para").
 *  Fallback: data efetiva, para cards sem esse campo (legado/sem extração). */
export function scheduledInPeriod(c, from, to) {
  const d = c?.scheduledAt ?? effectiveDate(c)
  return Boolean(d && d >= from && d <= to)
}

/** O card foi CRIADO no período [from, to]? (usado no topo do funil: "entraram")
 *  Card criado retroativamente pelo sync (fato antigo importado hoje) usa a
 *  data do evento quando ela é anterior à criação — o menor dos dois vale. */
export function createdInPeriod(c, from, to) {
  const created = c?.createdAt?.slice(0, 10) ?? null
  const ev = c?.eventDate ?? null
  const d = created && ev ? (ev < created ? ev : created) : (created ?? ev)
  return Boolean(d && d >= from && d <= to)
}

/** Calcula KPIs para o período [from, to] */
export function computeKpis(cards, from, to) {
  if (!cards?.length || !from || !to) return null

  // Leads e "não agendou" ficam fora dos KPIs de atendimento — nunca tiveram
  // consulta, então vivem no funil/topo, não na agenda.
  const inRange     = cards.filter(c => c.stepType !== 'lead' && c.stepType !== 'notScheduled' && inPeriod(c, from, to))
  const negotiating = inRange.filter(c => c.stepType === 'negotiating')   // orçamento em aberto
  const notClosed   = inRange.filter(c => c.stepType === 'attended')      // compareceu, não fechou
  const converted   = inRange.filter(c => c.stepType === 'converted')
  const missed      = inRange.filter(c => c.stepType === 'missed')
  const cancelled   = inRange.filter(c => c.stepType === 'cancelled')
  const scheduled   = inRange.filter(c => c.stepType === 'scheduled')
  const rescheduled = inRange.filter(c => c.stepType === 'rescheduled')

  // Quem compareceu = não fechou + em negociação + fechou
  const showed       = notClosed.length + negotiating.length + converted.length
  const shouldAttend = showed + missed.length            // tinha consulta: compareceu ou faltou
  const decided      = notClosed.length + converted.length // compareceu E já decidiu (em aberto fora)

  return {
    total:        inRange.length,
    shouldAttend,
    attended:     showed,            // compareceram (inclui em negociação e fechados)
    notClosed:    notClosed.length,  // compareceram e não fecharam (sem os em aberto)
    negotiating:  negotiating.length,
    converted:    converted.length,
    missed:       missed.length,
    cancelled:    cancelled.length,
    rescheduled:  rescheduled.length,
    scheduled:    scheduled.length,
    attendanceRate:
      shouldAttend > 0 ? (showed / shouldAttend) * 100 : null,
    conversionRate:
      decided > 0 ? (converted.length / decided) * 100 : null,   // em aberto fora do denominador
    missRate:
      shouldAttend > 0 ? (missed.length / shouldAttend) * 100 : null,
    noDate: cards.filter(c => !c.date).length,
  }
}

/** Retorna KPIs do período imediatamente anterior de mesma duração */
export function computePreviousKpis(cards, from, to) {
  const duration = new Date(to) - new Date(from)
  const prevTo   = new Date(new Date(from) - 86_400_000)
  const prevFrom = new Date(prevTo - duration)
  return computeKpis(
    cards,
    prevFrom.toISOString().slice(0, 10),
    prevTo.toISOString().slice(0, 10),
  )
}

/**
 * Tempo de resposta da CRC (PLANO_AGENDADOR_CAMPANHA.md FASE 5) — só faz
 * sentido para clínicas SEM IA (com IA, mede o tempo da automação, não do
 * humano). Mede createdAt → scheduledAt (dias, 1 casa): "lead chegou → CRC
 * agendou". Cards do período (por scheduledInPeriod — mesma janela usada na
 * barra "Agendaram" do funil) que tenham os dois campos preenchidos.
 */
export function computeResponseTime(cards, from, to) {
  if (!cards?.length || !from || !to) return null
  const withBoth = cards.filter(c => c.createdAt && c.scheduledAt && scheduledInPeriod(c, from, to))
  if (!withBoth.length) return { count: 0, avgDays: null, medianDays: null }

  const days = withBoth
    .map(c => (new Date(c.scheduledAt) - new Date(c.createdAt)) / 86_400_000)
    .filter(d => Number.isFinite(d) && d >= 0)
    .sort((a, b) => a - b)
  if (!days.length) return { count: 0, avgDays: null, medianDays: null }

  const avgDays = days.reduce((s, d) => s + d, 0) / days.length
  const mid = Math.floor(days.length / 2)
  const medianDays = days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2

  return { count: days.length, avgDays, medianDays }
}

/** Tempo de resposta do período imediatamente anterior de mesma duração */
export function computePreviousResponseTime(cards, from, to) {
  const duration = new Date(to) - new Date(from)
  const prevTo   = new Date(new Date(from) - 86_400_000)
  const prevFrom = new Date(prevTo - duration)
  return computeResponseTime(
    cards,
    prevFrom.toISOString().slice(0, 10),
    prevTo.toISOString().slice(0, 10),
  )
}

/** Calcula delta percentual (retorna null se denominador for 0 ou prev for null) */
export function delta(current, prev) {
  if (prev == null || prev === 0 || current == null) return null
  return ((current - prev) / Math.abs(prev)) * 100
}

/**
 * Calcula figuras de receita usando apenas valores reais (monetaryAmount).
 * Cards sem valor são listados separadamente para alerta de preenchimento.
 */
export function computeRevenue(cards, from, to, ticket, today) {
  if (!cards?.length) return null

  const inRange = cards.filter(c => inPeriod(c, from, to))

  const fechados  = inRange.filter(c => c.stepType === 'converted')
  const naoFechou = inRange.filter(c => c.stepType === 'attended')      // já exclui em negociação
  const negociacao= inRange.filter(c => c.stepType === 'negotiating')   // orçamento em aberto
  const faltas    = inRange.filter(c => c.stepType === 'missed')

  // Agendamentos futuros — base real para projeção (inclui remarcados: seguem tendo consulta futura)
  const agendados = cards.filter(c => c.date && c.date >= (today ?? from) && (c.stepType === 'scheduled' || c.stepType === 'rescheduled'))

  // Só soma valores reais — nulo é ignorado
  const sumReal = (arr) => arr.filter(c => c.value > 0).reduce((s, c) => s + c.value, 0)

  const fechada          = sumReal(fechados)
  const emNegociacao     = sumReal(negociacao)             // pipeline quente, a fechar
  const perdidaNaoFechou = sumReal(naoFechou)
  const perdidaFaltas    = ticket ? faltas.length * ticket : 0
  // Taxa de fechamento só entre os que já decidiram (em aberto fora)
  const rate             = (fechados.length + naoFechou.length) > 0
    ? fechados.length / (fechados.length + naoFechou.length)
    : 0
  const projetada = ticket ? Math.round(agendados.length * rate * ticket) : 0
  const totalPerdida  = perdidaNaoFechou + perdidaFaltas
  const oportunidade  = fechada + perdidaNaoFechou + perdidaFaltas

  // Cards sem valor preenchido em etapas que deveriam ter valor (receita/pipeline).
  const semValorCards = inRange.filter(
    c => ['converted', 'negotiating', 'attended'].includes(c.stepType) && !(c.value > 0)
  )
  const semValor = semValorCards.map(withContact)

  // Agrupado por etapa — "4 sem valor na etapa X, 5 na etapa Y"
  const byStep = {}
  for (const c of semValorCards) {
    const label = c.stepLabel ?? c.stepKey ?? '—'
    byStep[label] = (byStep[label] ?? 0) + 1
  }
  const semValorPorEtapa = Object.entries(byStep)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  return {
    fechada,
    emNegociacao,
    negociacaoCount: negociacao.length,
    projetada,
    agendadosFuturos: agendados.length,
    perdidaNaoFechou,
    perdidaFaltas,
    totalPerdida,
    oportunidade,
    semValor,
    semValorPorEtapa,
    semValorTotal: semValorCards.length,
  }
}

/** Receita do período imediatamente anterior de mesma duração (para deltas). */
export function computePreviousRevenue(cards, from, to, ticket, today) {
  const duration = new Date(to) - new Date(from)
  const prevTo   = new Date(new Date(from) - 86_400_000)
  const prevFrom = new Date(prevTo - duration)
  return computeRevenue(
    cards,
    prevFrom.toISOString().slice(0, 10),
    prevTo.toISOString().slice(0, 10),
    ticket,
    today,
  )
}

/**
 * Composição padrão do funil — soma explícita de stepTypes por estágio (não
 * subtração). Usada quando a clínica não tem `_funnel` configurado no /setup.
 * Cards em steps não mapeados/ignorados (stepType null) não entram em nenhum
 * estágio, então não inflam mais os números (bug antigo do `entrou - lead`).
 */
export const DEFAULT_FUNNEL_CFG = {
  stages: {
    naoAgendou: ['lead', 'notScheduled'],
    agendou:    ['scheduled', 'rescheduled', 'attended', 'negotiating', 'converted', 'missed', 'cancelled'],
    compareceu: ['attended', 'negotiating', 'converted'],
    fechou:     ['converted'],
  },
  mergeCancelledRescheduled: false,
}

/**
 * Funil de pipeline a partir de um conjunto de cards (estado atual de cada card).
 * Na Helena o card está em uma única etapa por vez, então isto é a foto da coorte:
 * de quem entrou, quantos hoje estão em cada estágio.
 *
 * `funnelCfg` (opcional, vem de clinics.steps._funnel) define quais stepTypes somam
 * em cada estágio — cada clínica pode ter particularidades no seu painel Helena.
 */
export function funnelOf(cards, funnelCfg, opts = {}) {
  const stages = funnelCfg?.stages ?? DEFAULT_FUNNEL_CFG.stages
  const mergeCancelledRescheduled = funnelCfg?.mergeCancelledRescheduled ?? DEFAULT_FUNNEL_CFG.mergeCancelledRescheduled

  const n = (t) => cards.filter(c => c.stepType === t).length
  const sumTypes = (types) => cards.filter(c => (types ?? []).includes(c.stepType)).length

  // Contagens brutas por tipo — mantidas para compatibilidade com quem já lê
  // funil.attended/negotiating/converted diretamente (ex: DimensionBreakdown).
  const lead        = n('lead')
  const notScheduled = n('notScheduled')
  const scheduled   = n('scheduled')
  const rescheduled = n('rescheduled')
  const attended    = n('attended')        // compareceu, não fechou
  const negotiating = n('negotiating')     // orçamento em aberto
  const converted   = n('converted')
  const missed      = n('missed')
  const cancelled   = n('cancelled')

  // "Entraram" pode vir de fora (contagem por data de CRIAÇÃO — ver computeFunnel);
  // os demais estágios contam pela data efetiva (última movimentação no CRM).
  const entrou      = opts.entrou ?? cards.length
  const naoAgendou  = sumTypes(stages.naoAgendou)
  // "Agendaram" conta pela data "Agendado em" (opts.agendouCards, ver computeFunnel)
  // quando disponível — cai para a data efetiva quando não vier de fora (ex:
  // breakdownByDimension, que ainda soma por movimentação no período).
  const agendou     = opts.agendouCards
    ? opts.agendouCards.filter(c => (stages.agendou ?? []).includes(c.stepType)).length
    : sumTypes(stages.agendou)
  const compareceu  = sumTypes(stages.compareceu)
  const fechou      = sumTypes(stages.fechou)
  const decididos   = compareceu - negotiating   // compareceram E decidiram (em aberto fora)

  const extraStats = [
    { key: 'missed', label: 'Faltaram', value: missed, color: 'text-orange-500' },
  ]
  if (mergeCancelledRescheduled) {
    extraStats.push({ key: 'cancelledRescheduled', label: 'Cancel./Remarc.', value: cancelled + rescheduled, color: 'text-red-500' })
  } else {
    extraStats.push({ key: 'cancelled', label: 'Cancelaram', value: cancelled, color: 'text-red-500' })
    if (rescheduled > 0) extraStats.push({ key: 'rescheduled', label: 'Remarcaram', value: rescheduled, color: 'text-violet-500' })
  }

  return {
    entrou, lead, notScheduled, scheduled, rescheduled, attended, negotiating, converted, missed, cancelled,
    naoAgendou, agendou, compareceu, decididos, fechou, extraStats,
    taxaAgendamento: entrou > 0 ? (agendou / entrou) * 100 : null,
    // comparecimento entre os que tiveram desfecho de consulta (compareceu ou faltou)
    taxaComparecimento: (compareceu + missed) > 0 ? (compareceu / (compareceu + missed)) * 100 : null,
    // fechamento só entre os que já decidiram — em negociação não derruba a taxa
    taxaFechamento: decididos > 0 ? (fechou / decididos) * 100 : null,
  }
}

/**
 * Funil do período [from, to]:
 *   - "Entraram" (topo) = cards CRIADOS no período — quando o lead chegou.
 *   - "Agendaram" = cards cuja data "Agendado em" caiu no período — quando a
 *     CRC/IA/sync marcou o agendamento (distinto da data da consulta em si).
 *   - Demais estágios = data efetiva (última movimentação), como os KPIs.
 * São coortes diferentes de propósito: "entraram X leads; no período, Y
 * agendaram / Z compareceram / W fecharam" — inclusive leads antigos que
 * andaram no funil agora.
 */
export function computeFunnel(cards, from, to, funnelCfg) {
  if (!cards?.length) return null
  const inRange      = cards.filter(c => inPeriod(c, from, to))
  const entrou       = cards.filter(c => createdInPeriod(c, from, to)).length
  const agendouCards = cards.filter(c => scheduledInPeriod(c, from, to))
  return funnelOf(inRange, funnelCfg, { entrou, agendouCards })
}

/**
 * Quebra o funil por uma dimensão (origem, agendador, …).
 * Retorna [{ value, funnel }] em ordem de volume de entrada, com uma linha
 * `value: null` ("Sem <dimensão>") sempre por último quando houver volume —
 * indica etiqueta faltando no card ou nome faltando no mapa (ex: crcMap).
 */
export function breakdownByDimension(cards, dimKey, values, from, to, funnelCfg) {
  if (!cards?.length || !dimKey) return []
  // Uma linha por etiqueta, com contas que o cliente confere de cabeça:
  //   AGENDOU → desses, NÃO FECHOU / EM ABERTO / FECHOU. Taxas na própria
  //   linha: comparecimento = compareceu ÷ agendou; fechamento = fechou ÷
  //   compareceu (mesma régua do funil de pipeline).
  // "Agendou" usa a mesma janela do funil geral (data do Agendado em, não
  // movimentação) — senão a tabela por dimensão diverge do funil geral no
  // mesmo período (REGRAS_DASHBOARD.md §7.1).
  const inRange = cards.filter(c => inPeriod(c, from, to))
  const agendouCards = cards.filter(c => scheduledInPeriod(c, from, to))
  const labels = [...(values ?? []), null] // null = "sem" essa dimensão
  return labels
    .map(v => ({
      value: v,
      funnel: funnelOf(
        inRange.filter(c => (c.dims?.[dimKey] ?? null) === v),
        funnelCfg,
        { agendouCards: agendouCards.filter(c => (c.dims?.[dimKey] ?? null) === v) },
      ),
    }))
    .filter(r => r.funnel.agendou > 0 || r.funnel.compareceu > 0 || r.funnel.fechou > 0)
    .sort((a, b) => {
      if (a.value === null) return 1
      if (b.value === null) return -1
      return b.funnel.agendou - a.funnel.agendou
    })
}

/**
 * Receita FECHADA (R$) por valor de uma dimensão (agendador, origem, …) no período.
 * Mesmo critério da "Receita fechada" do herói: cards 'converted' com valor real,
 * pela data efetiva. Retorna [{ value, fechada, count }] em ordem decrescente de R$,
 * só com entradas que fecharam algum valor.
 */
export function revenueByDimension(cards, dimKey, values, from, to) {
  if (!cards?.length || !dimKey) return []
  const fechados = cards.filter(
    c => c.stepType === 'converted' && c.value > 0 && inPeriod(c, from, to)
  )
  const labels = [...(values ?? []), null] // null = "sem" valor
  return labels
    .map(v => {
      const arr = fechados.filter(c => (c.dims?.[dimKey] ?? null) === v)
      return {
        value: v,
        fechada: arr.reduce((s, c) => s + c.value, 0),
        count: arr.length,
      }
    })
    .filter(r => r.fechada > 0)
    .sort((a, b) => b.fechada - a.fechada)
}

/**
 * Quebra por Campanha (PLANO_AGENDADOR_CAMPANHA.md FASE 3.2) — reusa
 * funnelOf/inPeriod/scheduledInPeriod/createdInPeriod, nenhuma régua nova:
 *   Leads = criados no período (todos os steps — aqui createdAt é o correto,
 *     por definição: mede quem ENTROU pela campanha, não quem já avançou).
 *   Agendados = régua cumulativa `agendou` do funil (mesma da tabela de CRC).
 *   Compareceram = régua `compareceu` · Fecharam = converted.
 *   Faltaram = missed da campanha; No-show% = faltaram ÷ (compareceram+faltaram)
 *     — mede qualidade do lead da campanha, não desempenho da CRC.
 *   Valor fechado = soma value dos converted · Ticket médio = valor ÷ nº
 *     converted COM valor preenchido.
 * Retorna [{ value, leads, funnel, faltaram, noShowPct, valorFechado, ticketMedio }],
 * com "Sem campanha" (value: null) sempre por último.
 */
export function campaignBreakdown(cards, dimKey, values, from, to, funnelCfg) {
  if (!cards?.length || !dimKey) return []
  const inRange      = cards.filter(c => inPeriod(c, from, to))
  const agendouCards = cards.filter(c => scheduledInPeriod(c, from, to))
  const leadsCards    = cards.filter(c => createdInPeriod(c, from, to))
  const labels = [...(values ?? []), null]

  return labels
    .map(v => {
      const ofValue = (arr) => arr.filter(c => (c.dims?.[dimKey] ?? null) === v)
      const leads   = ofValue(leadsCards).length
      const funnel  = funnelOf(ofValue(inRange), funnelCfg, { agendouCards: ofValue(agendouCards) })
      const faltaram = ofValue(inRange).filter(c => c.stepType === 'missed').length
      const noShowPct = (funnel.compareceu + faltaram) > 0
        ? (faltaram / (funnel.compareceu + faltaram)) * 100
        : null
      const fechados = ofValue(inRange).filter(c => c.stepType === 'converted')
      const valorFechado = fechados.reduce((s, c) => s + (c.value > 0 ? c.value : 0), 0)
      const fechadosComValor = fechados.filter(c => c.value > 0).length
      const ticketMedio = fechadosComValor > 0 ? valorFechado / fechadosComValor : null
      return { value: v, leads, funnel, faltaram, noShowPct, valorFechado, ticketMedio }
    })
    .filter(r => r.leads > 0 || r.funnel.agendou > 0 || r.funnel.compareceu > 0 || r.funnel.fechou > 0)
    .sort((a, b) => {
      if (a.value === null) return 1
      if (b.value === null) return -1
      return b.leads - a.leads
    })
}

/** Cards de "compareceu mas não fechou" dentro do período, com nome/telefone */
export function getLost(cards, from, to) {
  if (!cards?.length) return []
  return cards
    .filter(c => c.stepType === 'attended' && inPeriod(c, from, to))
    .sort((a, b) => (effectiveDate(b) ?? '').localeCompare(effectiveDate(a) ?? ''))
    .map(withContact)
}

/** Cards com orçamento em aberto (em negociação) no período, com nome/telefone/valor */
export function getNegotiating(cards, from, to) {
  if (!cards?.length) return []
  return cards
    .filter(c => c.stepType === 'negotiating' && inPeriod(c, from, to))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .map(withContact)
}

/**
 * Leads parados (PLANO_AGENDADOR_CAMPANHA.md FASE 6): cards em lead/
 * notScheduled cuja última movimentação (updatedAt) passou de N dias —
 * fila de trabalho pronta para a CRC, ordenada do mais antigo parado.
 */
export function getStuckLeads(cards, today, minDays = 7) {
  if (!cards?.length) return []
  const todayMs = new Date(today).getTime()
  return cards
    .filter(c => c.stepType === 'lead' || c.stepType === 'notScheduled')
    .map(c => {
      const last = c.updatedAt?.slice(0, 10) ?? c.createdAt?.slice(0, 10) ?? null
      const daysStuck = last ? Math.floor((todayMs - new Date(last).getTime()) / 86_400_000) : null
      return { ...c, daysStuck }
    })
    .filter(c => c.daysStuck != null && c.daysStuck >= minDays)
    .sort((a, b) => b.daysStuck - a.daysStuck)
    .map(withContact)
}

/** Cards futuros agendados, com nome/telefone */
export function getUpcoming(cards, today) {
  if (!cards?.length) return []
  return cards
    .filter(c => c.date && c.date >= today && (c.stepType === 'scheduled' || c.stepType === 'rescheduled'))
    .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : (a.time ?? '').localeCompare(b.time ?? ''))
    .map(withContact)
}
