// Ingestor de cards Helena → Supabase (PLANO_INGESTAO_E_PROCESSO.md, FASE A2).
//
// Estratégia (supabase/INGESTAO_API.md, descoberta de 18/07/2026 na Salutar):
// a API NÃO tem filtro por data de atualização (parâmetros são ignorados em
// silêncio) nem ordenação utilizável (OrderBy → 500) — então cada rodada é uma
// VARREDURA COMPLETA do painel com PageSize=100 (máximo aceito; 200 → 500).
// Custo real: ~10 chamadas/hora para 1.000 cards — quem paga é o cron, nunca
// a function na frente do cliente. `StepId` filtra de verdade e fica como
// alavanca de otimização quando algum painel passar de ~5k cards.
//
// Extração reusa as MESMAS funções do dashboard (src/utils/extract.js) — a
// regra vive num lugar só. `raw` guarda o card inteiro: mudou regra no /setup,
// dá para reprocessar do banco sem re-buscar a Helena.
import { extractCard, computeDims } from '../utils/extract.js'

const HELENA_BASE = 'https://api.wts.chat'
const PAGE_SIZE = 100          // máximo aceito pela Helena (testado: 200 → 500)
const FROZEN_AFTER_DAYS = 30   // etapa terminal parada há 30d+ = congela

const TERMINAL_TYPES = new Set(['converted', 'attended', 'missed', 'cancelled'])

function normalizeToken(raw) {
  if (!raw) return null
  const t = String(raw).trim()
  if (!t) return null
  return /^bearer /i.test(t) ? t : `Bearer ${t}`
}

async function fetchPage(panelId, token, pageNumber) {
  const qs = new URLSearchParams({
    PanelId: panelId, PageSize: String(PAGE_SIZE), PageNumber: String(pageNumber),
  })
  qs.append('IncludeDetails', 'Contacts')
  qs.append('IncludeDetails', 'CustomFields')
  const res = await fetch(`${HELENA_BASE}/crm/v1/panel/card?${qs}`, {
    headers: { Authorization: token },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Helena API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

/** Card da Helena → linha da tabela `cards`. Exportada para teste unitário. */
export function mapCardRow(card, { accountId, stepLookup, extractCfg, dimsCfg, now = new Date() }) {
  // Telefone: a fonte contactPhone exigiria 1 chamada por contato (como o
  // dashboard faz para cards recentes) — o ingestor NÃO busca; o valor fica
  // null e a leitura cai no fallback de parse do título (withContact).
  const appt = extractCard(card, extractCfg)
  const step = stepLookup[card.stepId] ?? null
  const stepType = step?.type ?? null

  const updatedMs = card.updatedAt ? Date.parse(card.updatedAt) : NaN
  const frozen = Boolean(
    stepType && TERMINAL_TYPES.has(stepType) &&
    Number.isFinite(updatedMs) &&
    (now.getTime() - updatedMs) > FROZEN_AFTER_DAYS * 86_400_000
  )

  return {
    account_id:   accountId,
    card_id:      card.id,
    step_id:      card.stepId,
    step_type:    stepType,
    title:        card.title ?? null,
    name:         appt?.name ?? null,
    phone:        appt?.phone ?? null,
    date:         appt?.date ?? null,
    time:         appt?.time ?? null,
    scheduled_at: appt?.scheduledAt ?? null,
    event_date:   card.metadata?.clinicorp_event_date ?? null,
    value:        card.monetaryAmount ?? null,
    dims:         computeDims(card, dimsCfg),
    created_at:   card.createdAt ?? null,
    updated_at:   card.updatedAt ?? null,
    raw:          card,
    frozen,
    synced_at:    new Date().toISOString(),
  }
}

async function upsertBatch(rows, { supabaseUrl, supabaseKey }) {
  const res = await fetch(`${supabaseUrl}/rest/v1/cards?on_conflict=account_id,card_id`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase upsert ${res.status}: ${body.slice(0, 200)}`)
  }
}

/**
 * Ingesta os cards de UMA clínica: varredura completa do painel + upsert.
 * clinic: { accountId, name, panelId, token, steps } (linha de `clinics`).
 * Retorna resumo para o ingest_log. Nunca lança — erros vão no resumo.
 */
export async function ingestClinicCards(clinic, { supabaseUrl, supabaseKey } = {}) {
  const startedAt = Date.now()
  const summary = {
    accountId: clinic.accountId, clinic: clinic.name,
    fetched: 0, upserted: 0, frozen: 0, errors: [],
  }
  try {
    const token = normalizeToken(clinic.token)
    if (!token) throw new Error('Clínica sem token Helena.')
    if (!clinic.panelId) throw new Error('Clínica sem panel_id.')

    const rawSteps = clinic.steps ?? {}
    const extractCfg = rawSteps._extract ?? null
    const dimsCfg = rawSteps._dims ?? null
    const stepLookup = Object.fromEntries(
      Object.entries(rawSteps)
        .filter(([k]) => !k.startsWith('_'))
        .map(([, s]) => [s.id, { type: s.type }])
    )

    // Varredura completa: página 1 dá o total; demais em paralelo (a API não
    // devolveu 429 em 20 chamadas seguidas — e rate limit é por conta).
    const first = await fetchPage(clinic.panelId, token, 1)
    let items = [...(first.items ?? [])]
    const totalPages = first.totalPages ?? 1
    if (totalPages > 1) {
      const pages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(clinic.panelId, token, i + 2))
      )
      for (const p of pages) items = items.concat(p.items ?? [])
    }
    summary.fetched = items.length

    const now = new Date()
    const rows = items.map(c => mapCardRow(c, {
      accountId: clinic.accountId, stepLookup, extractCfg, dimsCfg, now,
    }))
    summary.frozen = rows.filter(r => r.frozen).length

    // Upsert em lotes de 500 — 908 cards = 2 POSTs.
    for (let i = 0; i < rows.length; i += 500) {
      await upsertBatch(rows.slice(i, i + 500), { supabaseUrl, supabaseKey })
      summary.upserted += Math.min(500, rows.length - i)
    }
  } catch (err) {
    summary.errors.push(err.message)
  }
  summary.durationMs = Date.now() - startedAt
  return summary
}
