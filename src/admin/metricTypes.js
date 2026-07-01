// Tipos de métrica que o dashboard entende (ver utils/parseCards.js)
export const METRIC_TYPES = [
  { value: 'lead',       label: 'Lead (topo do funil)',   hint: 'Entrou, ainda em aberto',     color: '#0EA5E9' },
  { value: 'notScheduled', label: 'Não agendou',          hint: 'CRC/IA falou, mas não converteu em agendamento', color: '#EC4899' },
  { value: 'scheduled',  label: 'Agendamento',            hint: 'Agendou',                     color: '#6366F1' },
  { value: 'rescheduled', label: 'Reagendamento',         hint: 'Remarcou a consulta',          color: '#A855F7' },
  { value: 'attended',   label: 'Compareceu, não fechou', hint: 'Oportunidade recuperável',    color: '#F59E0B' },
  { value: 'negotiating', label: 'Orçamento em aberto',   hint: 'Compareceu, em negociação',   color: '#8B5CF6' },
  { value: 'converted',  label: 'Fechou contrato',        hint: 'Conta como receita',          color: '#10B981' },
  { value: 'missed',     label: 'Faltou',                 hint: 'Entra na taxa de faltas',     color: '#F97316' },
  { value: 'cancelled',  label: 'Cancelou',               hint: 'Cancelamentos do período',    color: '#EF4444' },
  { value: 'ignore',     label: 'Ignorar',                hint: 'Step fora das métricas',      color: '#94A3B8' },
]

export const typeColor = (type) =>
  METRIC_TYPES.find(t => t.value === type)?.color ?? '#94A3B8'

export const typeLabel = (type) =>
  METRIC_TYPES.find(t => t.value === type)?.label ?? type

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

// Sugere o tipo de métrica a partir do título do step (ordem importa:
// "não fechou" precisa ser testado antes de "fechou")
export function guessType(title) {
  const t = stripAccents(String(title).toLowerCase())
  if (t.includes('lead') || t.includes('novo contato') || t.includes('prospec')) return 'lead'
  if (t.includes('orcamento') || t.includes('em aberto') || t.includes('negocia') || t.includes('proposta')) return 'negotiating'
  if (t.includes('nao fechou') || t.includes('sem fechar')) return 'attended'
  if (t.includes('fechou') || t.includes('fechamento') || t.includes('converte')) return 'converted'
  if (t.includes('falt')) return 'missed'
  if (t.includes('cancel')) return 'cancelled'
  if (t.includes('reagend') || t.includes('remarc')) return 'rescheduled'
  if ((t.includes('nao') && t.includes('agend')) || t.includes('sem interesse') || t.includes('nao converteu')) return 'notScheduled'
  if (t.includes('agend')) return 'scheduled'
  if (t.includes('comparec')) return 'attended'
  return 'ignore'
}

// "OBClinic São Paulo" → "obclinic-sao-paulo" (slug de URL da clínica)
export function kebabify(name) {
  return stripAccents(String(name))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// "Compareceu e NÃO Fechou" → "compareceuENaoFechou"
export function slugify(title) {
  const words = stripAccents(String(title))
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
  if (!words.length) return 'step'
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
}

// Monta o JSONB `steps` no formato que o dashboard consome:
// { slug: { id, label, color, type } } — steps "ignore" ficam de fora.
// extract/dims/funnel (opcionais) entram como chaves reservadas _extract/_dims/_funnel.
export function buildStepsConfig(mappedSteps, extract, dims, funnel) {
  const config = {}
  for (const s of mappedSteps) {
    if (s.type === 'ignore') continue
    let slug = slugify(s.title)
    while (config[slug]) slug += '2'
    config[slug] = { id: s.id, label: s.title, color: s.color, type: s.type }
  }
  if (extract && Object.values(extract).some(rules => rules?.length)) config._extract = extract
  if (funnel) config._funnel = funnel
  if (dims && Object.keys(dims).length) config._dims = dims
  return config
}
