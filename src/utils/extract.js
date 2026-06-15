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
