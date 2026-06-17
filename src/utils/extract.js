// Lógica de extração configurável — compartilhada entre o backend (api/dashboard.js)
// e o preview do wizard (/setup). Mantenha sem dependências de browser ou de Node.
//
// Config (vive em clinics.steps._extract e ._dims):
//   _extract: { date:[rule], time:[rule], name:[rule], phone:[rule] }
//     rule = { from, regex?, format? }
//       from   : 'title' | 'description' | 'metadata.<campo>'
//       regex  : captura grupo 1 (ou match inteiro); ausente = campo inteiro
//       format : 'DMY' (DD/MM/AAAA) | 'YMD' (AAAA-MM-DD) — só para datas
//   _dims: { <chave>: { label, source, values?, rules? } }
//       source 'tag'          → values: { <tagId>: 'Rótulo' }
//       source 'metadata.<x>' → rules:  [ { match, value } ]

export function readField(card, from) {
  if (from === 'title')       return card.title ?? ''
  if (from === 'description') return card.description ?? ''
  if (from?.startsWith('metadata.')) return card.metadata?.[from.slice(9)] ?? ''
  return ''
}

export function normalizeDate(raw, format) {
  if (!raw) return null
  if (format === 'DMY') {
    const m = String(raw).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (!m) return null
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  const m = String(raw).match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

/** Aplica uma lista de regras em ordem até a primeira casar. kind 'date' normaliza. */
export function extractWith(rules, card, kind) {
  if (!Array.isArray(rules)) return null
  for (const rule of rules) {
    const src = String(readField(card, rule.from) ?? '')
    if (!src) continue
    let value
    if (rule.regex) {
      let m
      try { m = src.match(new RegExp(rule.regex)) }
      catch { continue } // regex inválida (digitando no wizard) — ignora a regra
      if (!m) continue
      value = m[1] ?? m[0]
    } else {
      value = src.trim()
      if (!value) continue
    }
    if (kind === 'date') {
      const d = normalizeDate(value, rule.format)
      if (d) return d
      continue
    }
    return value.trim()
  }
  return null
}

// Padrões candidatos por campo — testados contra cards de amostra no /setup.
// Cobrem os formatos vistos em produção (OBClinic "Nome:X - Telefone:Y" +
// "Data de agendamento: AAAA-MM-DD"; Yamar "Nome, ..., HH:MM, AAAA-MM-DD").
const EXTRACT_CANDIDATES = {
  date: [
    [{ from: 'description', regex: '(\\d{4}-\\d{2}-\\d{2})', format: 'YMD' }],
    [{ from: 'title',       regex: '(\\d{4}-\\d{2}-\\d{2})', format: 'YMD' }],
    [{ from: 'description', regex: '(\\d{2}/\\d{2}/\\d{4})', format: 'DMY' }],
    [{ from: 'title',       regex: '(\\d{2}/\\d{2}/\\d{4})', format: 'DMY' }],
  ],
  time: [
    [{ from: 'description', regex: '(\\d{1,2}:\\d{2})' }],
    [{ from: 'title',       regex: '(\\d{1,2}:\\d{2})' }],
  ],
  name: [
    [{ from: 'title', regex: 'Nome:?\\s*(.+?)\\s*-\\s*Telefone' }],
    [{ from: 'title', regex: '^\\s*([^,\\n]+?)\\s*,' }],
    [{ from: 'title', regex: 'Nome:?\\s*(.+)' }],
  ],
  phone: [
    [{ from: 'title',       regex: 'Telefone:?\\s*(\\d{8,})' }],
    [{ from: 'description', regex: 'Telefone:?\\s*(\\d{8,})' }],
    [{ from: 'title',       regex: '(\\d{10,11})' }],
    [{ from: 'description', regex: '(\\d{10,11})' }],
  ],
}

const EXTRACT_FALLBACK = {
  date:  [{ from: 'description', regex: '', format: 'YMD' }],
  time:  [{ from: 'description', regex: '' }],
  name:  [{ from: 'title', regex: '' }],
  phone: [{ from: 'description', regex: '' }],
}

/** Conta em quantos cards uma lista de regras extrai algo (para o preview/auto-detecção). */
export function countExtractHits(rules, cards, kind) {
  if (!Array.isArray(cards) || !cards.length) return 0
  return cards.reduce((n, c) => n + (extractWith(rules, c, kind) ? 1 : 0), 0)
}

/**
 * Tenta descobrir as regras de extração a partir dos cards de amostra: para cada
 * campo escolhe o padrão candidato que mais acerta. Sem acerto → regra vazia
 * (o admin ajusta no modo avançado). Base do "modo rápido" do wizard.
 */
export function autoDetectExtract(sampleCards = []) {
  const pick = (field, kind) => {
    let best = null, bestHits = 0
    for (const rules of EXTRACT_CANDIDATES[field]) {
      const hits = countExtractHits(rules, sampleCards, kind)
      if (hits > bestHits) { bestHits = hits; best = rules }
    }
    return best
  }
  return {
    date:  pick('date',  'date') ?? EXTRACT_FALLBACK.date,
    time:  pick('time',  'text') ?? EXTRACT_FALLBACK.time,
    name:  pick('name',  'text') ?? EXTRACT_FALLBACK.name,
    phone: pick('phone', 'text') ?? EXTRACT_FALLBACK.phone,
  }
}

/** Extrai os 4 campos de um card segundo a config _extract. */
export function extractCard(card, extractCfg) {
  if (!extractCfg) return { date: null, time: null, name: null, phone: null }
  return {
    date:  extractWith(extractCfg.date,  card, 'date'),
    time:  extractWith(extractCfg.time,  card, 'text'),
    name:  extractWith(extractCfg.name,  card, 'text'),
    phone: extractWith(extractCfg.phone, card, 'text'),
  }
}

/** Resolve o valor de uma dimensão para um card. */
export function dimValue(card, def) {
  if (def.source === 'tag') {
    for (const tid of card.tagIds ?? []) {
      if (def.values?.[tid]) return def.values[tid]
    }
    return null
  }
  if (def.source?.startsWith('metadata.')) {
    const raw = String(card.metadata?.[def.source.slice(9)] ?? '')
    for (const r of def.rules ?? []) {
      if (raw.includes(r.match)) return r.value
    }
    return null
  }
  return null
}

/** Computa todas as dimensões de um card. */
export function computeDims(card, dimsCfg) {
  const dims = {}
  if (dimsCfg) for (const [k, def] of Object.entries(dimsCfg)) dims[k] = dimValue(card, def)
  return dims
}
