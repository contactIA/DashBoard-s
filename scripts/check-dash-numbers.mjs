// READ-ONLY: valida os números do dashboard contra o painel Helena, usando as
// MESMAS funções do código (src/utils/parseCards.js) — KPI, funil, quebras por
// unidade/agendador e campanhas — e imprime as contagens cruas por etapa para
// conferência com as colunas do painel. Período: mês corrente.
import { readFileSync } from 'node:fs'
import { computeKpis, computeFunnel, breakdownByDimension, campaignBreakdown } from '../src/utils/parseCards.js'

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const IBS_ACCOUNT_ID = '58e1700e-84e1-4d41-aaa9-2918925a3cef'
const HELENA = 'https://api.wts.chat'
const pct = (v) => v == null ? '—' : v.toFixed(1).replace('.', ',') + '%'

async function main() {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/clinics?account_id=eq.${IBS_ACCOUNT_ID}&select=panel_id,token,steps`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
  })
  const [row] = await res.json()
  const steps = row.steps ?? {}
  const rawToken = String(row.token ?? '').trim()
  const auth = { Authorization: /^bearer /i.test(rawToken) ? rawToken : `Bearer ${rawToken}` }

  const typeByStepId = {}, labelByStepId = {}
  for (const [k, s] of Object.entries(steps)) {
    if (k.startsWith('_') || !s?.type || !s?.id) continue
    typeByStepId[s.id] = s.type
    labelByStepId[s.id] = s.label ?? k
  }
  const dims = steps._dims ?? {}

  let raw = []
  for (let pg = 1; pg <= 20; pg++) {
    const r = await fetch(`${HELENA}/crm/v1/panel/card?PanelId=${row.panel_id}&PageSize=100&PageNumber=${pg}&IncludeDetails=CustomFields`, { headers: auth })
    const page = await r.json()
    raw = raw.concat(page.items ?? [])
    if (!page.hasMorePages) break
  }
  raw = raw.filter((c) => !c.archived)

  // Enriquecimento espelhando api/dashboard.js (stepType, dims, datas)
  const fieldValue = (cf, key) => { const v = cf?.[key]; return Array.isArray(v) ? v[0] ?? null : v ?? null }
  const norm = (s) => { const t = String(s ?? '').replace(/\//g, '-'); return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null }
  const cards = raw.map((c) => {
    const cardDims = {}
    for (const [k, d] of Object.entries(dims)) {
      if ((d.source ?? 'tag') === 'tag') {
        cardDims[k] = (c.tagIds ?? []).map((t) => d.values?.[t]).find(Boolean) ?? null
      } else if (d.source?.startsWith('customFields.')) {
        const v = fieldValue(c.customFields, d.source.slice('customFields.'.length))
        cardDims[k] = v ? String(v).trim() || null : null
      }
    }
    return {
      ...c,
      stepType: typeByStepId[c.stepId] ?? null,
      stepLabel: labelByStepId[c.stepId] ?? null,
      eventDate: c.metadata?.clinicorp_event_date ?? null,
      scheduledAt: norm(fieldValue(c.customFields, 'agendado-em-')),
      date: norm(fieldValue(c.customFields, 'agendado-para')),
      value: c.monetaryAmount ?? null,
      dims: cardDims,
    }
  })

  const FROM = '2026-07-01', TO = '2026-07-16'
  console.log(`Período ${FROM}..${TO} · ${cards.length} cards ativos\n`)

  // Contagens CRUAS por coluna do painel (estado atual, sem janela) — para
  // conferir com o que se vê abrindo o painel Helena agora.
  const byStep = {}
  for (const c of cards) byStep[c.stepLabel ?? '(sem mapeamento)'] = (byStep[c.stepLabel ?? '(sem mapeamento)'] ?? 0) + 1
  console.log('── COLUNAS DO PAINEL (contagem atual, sem filtro de período) ──')
  for (const [l, n] of Object.entries(byStep).sort((a, b) => b[1] - a[1])) console.log(`  ${l}: ${n}`)

  // KPI (mesma função do dash)
  const kpis = computeKpis(cards, FROM, TO)
  console.log('\n── KPI (computeKpis) ──')
  console.log(`  Compareceram = ${kpis.notClosed} não fechou + ${kpis.negotiating} em aberto + ${kpis.converted} fechou = ${kpis.attended}`)
  console.log(`  CONVERSÃO = ${kpis.converted}/${kpis.attended} = ${pct(kpis.conversionRate)}`)
  console.log(`  Comparecimento = ${kpis.attended}/(${kpis.attended}+${kpis.missed}) = ${pct(kpis.attendanceRate)}`)

  // Funil (mesma função do dash)
  const funnel = computeFunnel(cards, FROM, TO, steps._funnel ?? null)
  console.log('\n── FUNIL (computeFunnel) ──')
  console.log(`  entraram=${funnel.entrou} agendou=${funnel.agendou} compareceu=${funnel.compareceu} fechou=${funnel.fechou}`)
  console.log(`  taxaFechamento = ${funnel.fechou}/${funnel.compareceu} = ${pct(funnel.taxaFechamento)}`)

  // Quebras por dimensão (mesma função do dash)
  for (const key of Object.keys(dims)) {
    if ((dims[key].source ?? 'tag').startsWith('customFields.')) continue
    const values = [...new Set(Object.values(dims[key].values ?? {}))]
    const rows = breakdownByDimension(cards, key, values, FROM, TO, steps._funnel ?? null)
    console.log(`\n── ${dims[key].label.toUpperCase()} (breakdownByDimension) ──`)
    for (const { value, funnel: f } of rows) {
      console.log(`  ${value ?? 'Sem ' + key}: agendados=${f.agendou} compareceram=${f.compareceu} (aberto=${f.negotiating} + nfechou=${f.attended} + fechou=${f.converted}) · Fech.%=${pct(f.taxaFechamento)}`)
    }
  }

  // Campanhas (mesma função do dash)
  const campDef = dims.campanha
  if (campDef) {
    const counts = new Map()
    for (const c of cards) { const v = c.dims?.campanha; if (v) counts.set(v, (counts.get(v) ?? 0) + 1) }
    const values = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v)
    const rows = campaignBreakdown(cards, 'campanha', values, FROM, TO, steps._funnel ?? null)
    console.log('\n── CAMPANHAS (campaignBreakdown) ──')
    for (const r of rows) {
      console.log(`  ${r.value ?? 'Sem campanha'}: leads=${r.leads} agendados=${r.funnel.agendou} compareceram=${r.funnel.compareceu} fechou=${r.funnel.fechou} · Fech.%=${pct(r.funnel.taxaFechamento)}`)
    }
  }

  // Consistência: soma das unidades = geral
  const unitKey = Object.keys(dims).find((k) => (dims[k].source ?? 'tag') === 'tag' && dims[k].label?.toLowerCase() === 'unidade') ?? 'unidade'
  const uRows = breakdownByDimension(cards, unitKey, [...new Set(Object.values(dims[unitKey]?.values ?? {}))], FROM, TO, steps._funnel ?? null)
  const soma = uRows.reduce((s, r) => ({ comp: s.comp + r.funnel.compareceu, fec: s.fec + r.funnel.fechou }), { comp: 0, fec: 0 })
  console.log('\n── CONSISTÊNCIA ──')
  console.log(`  Σ unidades: compareceram=${soma.comp} fechou=${soma.fec} · KPI geral: compareceram=${kpis.attended} fechou=${kpis.converted}`)
  console.log(`  ${soma.comp === kpis.attended && soma.fec === kpis.converted ? '✅ soma das unidades BATE com o geral' : '⚠️ diferença entre soma das unidades e o geral (cards sem tag de unidade contam só no geral)'}`)
}

main().catch((err) => { console.error('ERRO FATAL:', err.message); process.exit(1) })
