// Lógica de extração configurável — compartilhada entre o backend (api/dashboard.js)
// e o preview do wizard (/setup). Mantenha sem dependências de browser ou de Node.
//
// Config (vive em clinics.steps._extract e ._dims):
//   _extract: { date:[rule], time:[rule], name:[rule], phone:[rule], scheduledAt:[rule] }
//     scheduledAt = "Agendado em" (dia em que a CRC/IA/sync agendou o lead) —
//     independente de `date` ("Agendado Para", dia da consulta). Sem regra
//     configurada, extractCard devolve null (clínica legada, sem esse campo).
//     rule = { from, regex?, format? }
//       from   : 'title' | 'description' | 'dueDate' | 'contactName' | 'contactPhone'
//                | 'metadata.<campo>' | 'customFields.<campo>'
//       regex  : captura grupo 1 (ou match inteiro); ausente = campo inteiro
//       format : 'DMY' (DD/MM/AAAA) | 'YMD' (AAAA-MM-DD) — só para datas
//   _dims: { <chave>: { label, source, values?, rules? } }
//       source 'tag'          → values: { <tagId>: 'Rótulo' }
//       source 'metadata.<x>' → rules:  [ { match, value } ]

export function readField(card, from) {
  if (from === 'title')       return card.title ?? ''
  if (from === 'description') return card.description ?? ''
  // Contato vinculado ao card na Helena — nome vem de graça na listagem
  // (IncludeDetails=Contacts); telefone é anexado pelo backend antes da extração
  // (ver api/dashboard.js), pois exige uma chamada separada à API.
  if (from === 'contactName')  return card.contacts?.[0]?.name ?? ''
  if (from === 'contactPhone') return card.contactPhone ?? ''
  if (from?.startsWith('metadata.')) return card.metadata?.[from.slice(9)] ?? ''
  // customFields — diferente de metadata na API da Helena (campos personalizados
  // configurados pelo usuário no painel, vs. metadados livres).
  if (from?.startsWith('customFields.')) return card.customFields?.[from.slice(13)] ?? ''
  return ''
}

const BR_OFFSET_MS = 3 * 60 * 60 * 1000 // UTC-3 fixo (Brasil não observa horário de verão desde 2019)

/** Data/hora reais do agendamento a partir de card.dueDate (ISO, UTC), já em horário de Brasília. */
export function dueDateParts(iso) {
  if (!iso) return null
  const utcMs = Date.parse(iso)
  if (Number.isNaN(utcMs)) return null
  const local = new Date(utcMs - BR_OFFSET_MS)
  return { date: local.toISOString().slice(0, 10), time: local.toISOString().slice(11, 16) }
}

/**
 * Um telefone BR plausível tem 10-13 dígitos (com/sem DDI e 9º dígito) e o texto
 * é só telefone — dígitos e separadores usuais. Sem a checagem de forma, uma
 * descrição inteira com datas ("Entrada: 29/06/2026 às 20:05" = 12 dígitos)
 * passava como telefone e vazava texto livre para a coluna de telefone.
 */
export function isPlausiblePhone(raw) {
  const s = String(raw ?? '').trim()
  if (!/^\+?[\d\s().\/-]+$/.test(s)) return false
  const digits = s.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 13
}

export function normalizeDate(raw, format) {
  if (!raw) return null
  if (format === 'DMY') {
    // Ano opcional: chatbots costumam preencher só "02/07" (e às vezes "24/06/26").
    const m = String(raw).match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
    if (!m) return null
    const dd = m[1].padStart(2, '0')
    const mm = m[2].padStart(2, '0')
    let year = m[3]
    if (year && year.length === 2) year = `20${year}`
    if (!year) {
      // Sem ano → assume o corrente (BR); se cair a mais de ~6 meses no passado,
      // é agendamento logo após a virada do ano (ex: "05/01" preenchido em dezembro).
      const today = new Date(Date.now() - BR_OFFSET_MS).toISOString().slice(0, 10)
      let y = Number(today.slice(0, 4))
      if (Date.parse(today) - Date.parse(`${y}-${mm}-${dd}`) > 183 * 86_400_000) y += 1
      year = String(y)
    }
    return `${year}-${mm}-${dd}`
  }
  // Separador '-' ou '/': a Helena reformata alguns customFields tipo data
  // com barras na gravação (confirmado: "agendado-em-" volta como "2026/07/13"
  // mesmo escrito em ISO com hífen — "agendado-para" preserva o hífen. Sem
  // aceitar os dois, a extração falha silenciosamente nesses campos).
  const m = String(raw).match(/(\d{4})[-/](\d{2})[-/](\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

/** Aplica uma lista de regras em ordem até a primeira casar. kind 'date' normaliza. */
export function extractWith(rules, card, kind) {
  if (!Array.isArray(rules)) return null
  for (const rule of rules) {
    if (rule.from === 'dueDate') {
      const parts = dueDateParts(card.dueDate)
      if (!parts) continue
      return kind === 'date' ? parts.date : parts.time
    }
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
    if (kind === 'phone') {
      if (!isPlausiblePhone(value)) continue // ex: descrição inteira sem regex — não é telefone
      return value.trim()
    }
    return value.trim()
  }
  return null
}

// Padrões candidatos por campo — testados contra cards de amostra no /setup.
// dueDate/contato (campos reais da Helena) vêm primeiro: são mais confiáveis que
// regex em texto livre quando os cards de amostra os têm preenchidos.
// Os demais cobrem os formatos vistos em produção (OBClinic "Nome:X - Telefone:Y" +
// "Data de agendamento: AAAA-MM-DD"; Yamar "Nome, ..., HH:MM, AAAA-MM-DD").
const EXTRACT_CANDIDATES = {
  date: [
    [{ from: 'dueDate' }],
    [{ from: 'description', regex: '(\\d{4}-\\d{2}-\\d{2})', format: 'YMD' }],
    [{ from: 'title',       regex: '(\\d{4}-\\d{2}-\\d{2})', format: 'YMD' }],
    // "Entrada: DD/MM/AAAA" é a data de entrada do lead (cabeçalho padrão dos
    // chatbots Helena), nunca a do agendamento — o lookbehind a pula.
    [{ from: 'description', regex: '(?<!Entrada:\\s*)(\\d{2}/\\d{2}/\\d{4})', format: 'DMY' }],
    [{ from: 'title',       regex: '(\\d{2}/\\d{2}/\\d{4})', format: 'DMY' }],
  ],
  time: [
    [{ from: 'dueDate' }],
    [{ from: 'description', regex: '(\\d{1,2}:\\d{2})' }],
    [{ from: 'title',       regex: '(\\d{1,2}:\\d{2})' }],
  ],
  name: [
    [{ from: 'contactName' }],
    [{ from: 'title', regex: 'Nome:?\\s*(.+?)\\s*-\\s*Telefone' }],
    [{ from: 'title', regex: '^\\s*([^,\\n]+?)\\s*,' }],
    [{ from: 'title', regex: 'Nome:?\\s*(.+)' }],
  ],
  phone: [
    [{ from: 'contactPhone' }],
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
 *
 * Campos personalizados dos cards ("data", "hor-rio", …) viram candidatos
 * dinâmicos com prioridade sobre regex em texto livre: em empate de acertos,
 * vence quem aparece primeiro na lista.
 */
export function autoDetectExtract(sampleCards = []) {
  const cfKeys = new Set()
  for (const c of sampleCards) {
    for (const k of Object.keys(c.customFields ?? {})) cfKeys.add(k)
  }
  const dynDate = [], dynTime = [], dynPhone = []
  for (const k of cfKeys) {
    dynDate.push(
      [{ from: `customFields.${k}`, format: 'DMY' }],
      [{ from: `customFields.${k}`, format: 'YMD' }],
    )
    // regex exige forma de horário — evita um campo de data "ganhar" como horário
    dynTime.push([{ from: `customFields.${k}`, regex: '(\\d{1,2}:\\d{2})' }])
    dynPhone.push([{ from: `customFields.${k}` }])
  }

  const candidates = {
    date:  [EXTRACT_CANDIDATES.date[0],  ...dynDate,  ...EXTRACT_CANDIDATES.date.slice(1)],
    time:  [EXTRACT_CANDIDATES.time[0],  ...dynTime,  ...EXTRACT_CANDIDATES.time.slice(1)],
    name:  EXTRACT_CANDIDATES.name,
    phone: [EXTRACT_CANDIDATES.phone[0], ...dynPhone, ...EXTRACT_CANDIDATES.phone.slice(1)],
  }

  const pick = (field, kind) => {
    let best = null, bestHits = 0
    for (const rules of candidates[field]) {
      const hits = countExtractHits(rules, sampleCards, kind)
      if (hits > bestHits) { bestHits = hits; best = rules }
    }
    return best
  }
  return {
    date:  pick('date',  'date') ?? EXTRACT_FALLBACK.date,
    time:  pick('time',  'text') ?? EXTRACT_FALLBACK.time,
    name:  pick('name',  'text') ?? EXTRACT_FALLBACK.name,
    phone: pick('phone', 'phone') ?? EXTRACT_FALLBACK.phone,
  }
}

/** Extrai os campos de um card segundo a config _extract.
 *  scheduledAt ("Agendado em") só é calculado quando a clínica configurou a
 *  regra — ausente vira null, sem afetar clínicas legadas. */
export function extractCard(card, extractCfg) {
  if (!extractCfg) return { date: null, time: null, name: null, phone: null, scheduledAt: null }
  return {
    date:        extractWith(extractCfg.date,        card, 'date'),
    time:        extractWith(extractCfg.time,        card, 'text'),
    name:        extractWith(extractCfg.name,        card, 'text'),
    phone:       extractWith(extractCfg.phone,       card, 'phone'),
    scheduledAt: extractCfg.scheduledAt ? extractWith(extractCfg.scheduledAt, card, 'date') : null,
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
  // Campo personalizado de valor livre (ex: Campanhas) — sem `values`/`rules`
  // fixos: o valor é o próprio texto do customField (array → primeiro item).
  if (def.source?.startsWith('customFields.')) {
    const raw = card.customFields?.[def.source.slice(13)]
    const v = String(Array.isArray(raw) ? raw[0] ?? '' : raw ?? '').trim()
    return v || null
  }
  return null
}

/** Computa todas as dimensões de um card. */
export function computeDims(card, dimsCfg) {
  const dims = {}
  if (dimsCfg) for (const [k, def] of Object.entries(dimsCfg)) dims[k] = dimValue(card, def)
  return dims
}
