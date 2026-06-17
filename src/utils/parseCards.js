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
 * Data efetiva do card para "aconteceu no período":
 * data de agendamento quando existe; senão a data em que o card foi movido
 * (updatedAt); senão a criação. Resolve painéis cujos cards não trazem a data
 * de agendamento no texto (a maioria, fora do agendamento pela IA).
 */
export function effectiveDate(c) {
  return c?.date || c?.updatedAt?.slice(0, 10) || c?.createdAt?.slice(0, 10) || null
}

/** O card cai no período [from, to] pela data efetiva? */
export function inPeriod(c, from, to) {
  const d = effectiveDate(c)
  return Boolean(d && d >= from && d <= to)
}

/** Calcula KPIs para o período [from, to] */
export function computeKpis(cards, from, to) {
  if (!cards?.length || !from || !to) return null

  // Leads ficam fora dos KPIs de atendimento (vivem no funil, não na agenda)
  const inRange     = cards.filter(c => c.stepType !== 'lead' && inPeriod(c, from, to))
  const negotiating = inRange.filter(c => c.stepType === 'negotiating')   // orçamento em aberto
  const notClosed   = inRange.filter(c => c.stepType === 'attended')      // compareceu, não fechou
  const converted   = inRange.filter(c => c.stepType === 'converted')
  const missed      = inRange.filter(c => c.stepType === 'missed')
  const cancelled   = inRange.filter(c => c.stepType === 'cancelled')
  const scheduled   = inRange.filter(c => c.stepType === 'scheduled')
  const rescheduled = inRange.filter(c => /reagend/i.test(c.stepLabel ?? c.stepKey ?? ''))

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

  // Agendamentos futuros — base real para projeção
  const agendados = cards.filter(c => c.date && c.date >= (today ?? from) && c.stepType === 'scheduled')

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
  const semValor = semValorCards.map(c => ({ ...c, ...parseTitle(c.title) }))

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
 * Funil de pipeline a partir de um conjunto de cards (estado atual de cada card).
 * Na Helena o card está em uma única etapa por vez, então isto é a foto da coorte:
 * de quem entrou, quantos hoje estão em cada estágio.
 */
export function funnelOf(cards) {
  const n = (t) => cards.filter(c => c.stepType === t).length
  const lead        = n('lead')
  const scheduled   = n('scheduled')
  const attended    = n('attended')        // compareceu, não fechou
  const negotiating = n('negotiating')     // orçamento em aberto
  const converted   = n('converted')
  const missed      = n('missed')
  const cancelled   = n('cancelled')

  const entrou      = cards.length
  const agendou     = entrou - lead                       // saiu do topo do funil
  const compareceu  = attended + negotiating + converted  // todos que compareceram
  const decididos   = attended + converted                // compareceram E decidiram (em aberto fora)
  const fechou      = converted

  return {
    entrou, lead, scheduled, attended, negotiating, converted, missed, cancelled,
    agendou, compareceu, decididos, fechou,
    taxaAgendamento: entrou > 0 ? (agendou / entrou) * 100 : null,
    // comparecimento entre os que tiveram desfecho de consulta (compareceu ou faltou)
    taxaComparecimento: (compareceu + missed) > 0 ? (compareceu / (compareceu + missed)) * 100 : null,
    // fechamento só entre os que já decidiram — em negociação não derruba a taxa
    taxaFechamento: decididos > 0 ? (fechou / decididos) * 100 : null,
  }
}

/** Filtra cards pela data de ENTRADA (createdAt) no período — base do funil/coorte. */
export function byEntryDate(cards, from, to) {
  if (!cards?.length) return []
  if (!from || !to) return cards
  return cards.filter(c => {
    const d = (c.createdAt ?? '').slice(0, 10)
    return d && d >= from && d <= to
  })
}

/** Funil da coorte que entrou em [from, to]. */
export function computeFunnel(cards, from, to) {
  if (!cards?.length) return null
  return funnelOf(byEntryDate(cards, from, to))
}

/**
 * Quebra o funil por uma dimensão (origem, agendador, …).
 * Retorna [{ value, funnel }] em ordem de volume de entrada.
 */
export function breakdownByDimension(cards, dimKey, values, from, to) {
  if (!cards?.length || !dimKey) return []
  const inRange = byEntryDate(cards, from, to)
  const labels = [...(values ?? []), null] // null = "sem" valor
  return labels
    .map(v => ({
      value: v,
      funnel: funnelOf(inRange.filter(c => (c.dims?.[dimKey] ?? null) === v)),
    }))
    .filter(r => r.funnel.entrou > 0)
    .sort((a, b) => b.funnel.entrou - a.funnel.entrou)
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

/** Cards de "compareceu mas não fechou" dentro do período, com nome/telefone */
export function getLost(cards, from, to) {
  if (!cards?.length) return []
  return cards
    .filter(c => c.stepType === 'attended' && inPeriod(c, from, to))
    .sort((a, b) => (effectiveDate(b) ?? '').localeCompare(effectiveDate(a) ?? ''))
    .map(c => ({ ...c, ...parseTitle(c.title) }))
}

/** Cards com orçamento em aberto (em negociação) no período, com nome/telefone/valor */
export function getNegotiating(cards, from, to) {
  if (!cards?.length) return []
  return cards
    .filter(c => c.stepType === 'negotiating' && inPeriod(c, from, to))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .map(c => ({ ...c, ...parseTitle(c.title) }))
}

/** Cards futuros agendados, com nome/telefone */
export function getUpcoming(cards, today) {
  if (!cards?.length) return []
  return cards
    .filter(c => c.date && c.date >= today && c.stepType === 'scheduled')
    .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : (a.time ?? '').localeCompare(b.time ?? ''))
    .map(c => ({ ...c, ...parseTitle(c.title) }))
}
