import { effectiveDate } from './parseCards.js'

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Retorna a segunda-feira da semana da data informada (YYYY-MM-DD). */
function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function getMonthStart(dateStr) {
  return dateStr.slice(0, 7) + '-01'
}

function formatBucketLabel(dateStr, granularity) {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (granularity === 'day') return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  if (granularity === 'week') return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  return `${MONTHS_PT[m - 1]}/${String(y).slice(2)}`
}

/**
 * Decide a granularidade ideal com base no intervalo de datas.
 *   ≤ 7 dias  → por dia
 *   ≤ 60 dias → por semana
 *   > 60 dias → por mês
 */
export function getGranularity(from, to) {
  const diff = (new Date(to) - new Date(from)) / 86_400_000
  if (diff <= 7) return 'day'
  if (diff <= 60) return 'week'
  return 'month'
}

/**
 * Agrupa os cards do período em buckets temporais e conta por stepKey.
 * Retorna { data: [...], granularity }.
 *
 * Cada item de `data` tem a forma:
 *   { label: '14/05', agendou: 3, reagendou: 1, compareceuFechou: 2, ... }
 */
export function groupCardsByTime(cards, from, to, steps) {
  if (!cards?.length || !from || !to || !steps) return { data: [], granularity: 'day' }

  const granularity = getGranularity(from, to)
  const inRange = cards.filter(c => {
    const d = effectiveDate(c)
    return d && d >= from && d <= to
  })

  // Agrupa cards nos seus buckets (pela data efetiva)
  const cardsByBucket = {}
  for (const card of inRange) {
    const date = effectiveDate(card)
    const bucket =
      granularity === 'day'
        ? date
        : granularity === 'week'
        ? getWeekStart(date)
        : getMonthStart(date)

    if (!cardsByBucket[bucket]) cardsByBucket[bucket] = []
    cardsByBucket[bucket].push(card)
  }

  // Gera todos os buckets do intervalo (mesmo os vazios, para o gráfico não ter lacunas)
  const allBuckets = new Set(Object.keys(cardsByBucket))

  if (granularity === 'day') {
    let cur = from
    while (cur <= to) { allBuckets.add(cur); cur = addDays(cur, 1) }
  } else if (granularity === 'week') {
    let cur = getWeekStart(from)
    while (cur <= to) { allBuckets.add(cur); cur = addDays(cur, 7) }
  } else {
    let cur = getMonthStart(from)
    while (cur <= to) {
      allBuckets.add(cur)
      const [y, m] = cur.split('-').map(Number)
      cur = m === 12
        ? `${y + 1}-01-01`
        : `${y}-${String(m + 1).padStart(2, '0')}-01`
    }
  }

  // Séries por TIPO de métrica (normalizado) — independente dos slugs de cada clínica
  const TYPE_KEYS = ['lead', 'scheduled', 'attended', 'converted', 'missed', 'cancelled']

  const data = [...allBuckets].sort().map(bucket => {
    const row = { label: formatBucketLabel(bucket, granularity) }
    const bucketCards = cardsByBucket[bucket] ?? []
    for (const t of TYPE_KEYS) {
      row[t] = bucketCards.filter(c => c.stepType === t).length
    }
    // Reagendamento não é um tipo — é identificado pelo nome do step
    row.rescheduled = bucketCards.filter(c => /reagend/i.test(c.stepLabel ?? c.stepKey ?? '')).length
    return row
  })

  return { data, granularity }
}
