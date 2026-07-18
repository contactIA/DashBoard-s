// FASE A0 do PLANO_INGESTAO_E_PROCESSO.md — descoberta do que a API Helena
// suporta em GET /crm/v1/panel/card. O resultado define a estratégia do
// ingestor (incremental de verdade vs varredura).
//
// Uso (token NUNCA vai para arquivo — só env de processo):
//   HELENA_TOKEN="Bearer xxx" PANEL_ID="uuid-do-painel" node scripts/discover-helena-api.mjs
//
// Cada parâmetro é testado ISOLADAMENTE, com 1s entre chamadas — lição do
// commit 4b5805f: a Helena VALIDA parâmetros e devolve 500 em valor
// desconhecido; nunca testar dois parâmetros novos na mesma chamada.
// Saída: imprime a tabela no console E grava supabase/INGESTAO_API.md.

import { writeFileSync } from 'node:fs'

const HELENA_BASE = 'https://api.wts.chat'
const token = process.env.HELENA_TOKEN?.startsWith('Bearer ')
  ? process.env.HELENA_TOKEN
  : process.env.HELENA_TOKEN ? `Bearer ${process.env.HELENA_TOKEN}` : null
const panelId = process.env.PANEL_ID

if (!token || !panelId) {
  console.error('Defina HELENA_TOKEN e PANEL_ID no ambiente. Ex:')
  console.error('  HELENA_TOKEN="Bearer xxx" PANEL_ID="uuid" node scripts/discover-helena-api.mjs')
  process.exit(1)
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function tryCall(label, params) {
  const qs = new URLSearchParams({ PanelId: panelId, PageSize: '5', PageNumber: '1', ...params })
  const started = Date.now()
  try {
    const res = await fetch(`${HELENA_BASE}/crm/v1/panel/card?${qs}`, { headers: { Authorization: token } })
    const ms = Date.now() - started
    const body = await res.text()
    if (!res.ok) {
      const snippet = body.slice(0, 140).replace(/\s+/g, ' ')
      return { label, ok: false, status: res.status, ms, note: snippet }
    }
    const json = JSON.parse(body)
    const n = json.items?.length ?? 0
    const first = json.items?.[0]
    return {
      label, ok: true, status: res.status, ms,
      note: `${n} itens · totalPages=${json.totalPages ?? '?'} · 1º updatedAt=${first?.updatedAt ?? '—'}`,
      items: json.items ?? [],
    }
  } catch (err) {
    return { label, ok: false, status: 'ERR', ms: Date.now() - started, note: err.message }
  }
}

const results = []
const run = async (label, params) => {
  const r = await tryCall(label, params)
  results.push(r)
  console.log(`${r.ok ? '✓' : '✗'} ${label.padEnd(46)} HTTP ${String(r.status).padEnd(4)} ${String(r.ms).padStart(5)}ms  ${r.note}`)
  await sleep(1000)
  return r
}

console.log(`Painel ${panelId} — testando parâmetros isoladamente:\n`)

// Baseline (sanidade do token/painel)
const base = await run('baseline (sem parâmetro extra)', {})
if (!base.ok) {
  console.error('\nBaseline falhou — token/painel inválidos. Abortando (nada a descobrir).')
  process.exit(1)
}

// 1) Filtro por data de atualização — cada grafia testada separadamente
await run('UpdatedAfter=2026-01-01', { UpdatedAfter: '2026-01-01' })
await run('UpdatedAtAfter=2026-01-01', { UpdatedAtAfter: '2026-01-01' })
await run('MinUpdatedAt=2026-01-01', { MinUpdatedAt: '2026-01-01' })

// 2) Ordenação
const ordered = await run('OrderBy=UpdatedAt&OrderDirection=desc', { OrderBy: 'UpdatedAt', OrderDirection: 'desc' })
await run('SortBy=UpdatedAt', { SortBy: 'UpdatedAt' })

// Ordenação "aceita" só vale se mudou a ordem de fato (200 pode ser no-op)
if (ordered.ok && base.ok) {
  const changedOrder = ordered.items[0]?.id !== base.items[0]?.id
  results.push({ label: '→ OrderBy mudou a ordem de verdade?', ok: changedOrder, status: '-', ms: 0,
    note: changedOrder ? 'sim (ordenação real)' : 'NÃO — 200 mas mesma ordem (no-op silencioso, ver lição 16/07)' })
}

// 3) Filtro por etapa (usa o stepId do 1º card do baseline)
const stepId = base.items[0]?.stepId
if (stepId) {
  const byStep = await run(`StepId=<do 1º card>`, { StepId: stepId })
  if (byStep.ok) {
    const allSame = byStep.items.every(c => c.stepId === stepId)
    results.push({ label: '→ StepId filtrou de verdade?', ok: allSame, status: '-', ms: 0,
      note: allSame ? 'sim (todos os itens do step pedido)' : 'NÃO — 200 mas itens de outros steps (ignorado)' })
  }
}

// 4) Rate limit: 20 chamadas seguidas sem pausa
console.log('\nTestando rate limit (20 chamadas seguidas)...')
let hit429 = null
for (let i = 1; i <= 20; i++) {
  const r = await tryCall(`burst ${i}`, {})
  if (r.status === 429) { hit429 = i; break }
}
results.push({ label: 'rate limit (burst de 20)', ok: !hit429, status: hit429 ? 429 : 200, ms: 0,
  note: hit429 ? `429 na chamada #${hit429} — espaçar chamadas do ingestor` : 'sem 429 em 20 seguidas' })
console.log(hit429 ? `✗ 429 na chamada #${hit429}` : '✓ sem 429 em 20 chamadas')

// ── Relatório ────────────────────────────────────────────────────────────────
const md = `# Descoberta da API Helena — GET /crm/v1/panel/card

> Gerado por \`scripts/discover-helena-api.mjs\` em ${new Date().toISOString().slice(0, 10)}
> contra o painel \`${panelId}\`. Base da estratégia do ingestor (FASE A2).

| Teste | Resultado | HTTP | Observação |
|---|---|---|---|
${results.map(r => `| ${r.label} | ${r.ok ? '✅' : '❌'} | ${r.status} | ${r.note} |`).join('\n')}

## Estratégia escolhida (preencher após analisar a tabela)

- [ ] 1. \`UpdatedAfter\` (ou variante) funciona → **incremental de verdade**
- [ ] 2. Só ordenação real por UpdatedAt → **paginar desc e parar cedo**
- [ ] 3. Só \`StepId\` real → **varredura horária das etapas ativas + full diária**
- [ ] 4. Nada → **varredura completa por clínica no cron (pior caso aceito)**
`
writeFileSync(new URL('../supabase/INGESTAO_API.md', import.meta.url), md)
console.log('\nRelatório gravado em supabase/INGESTAO_API.md — marcar a estratégia escolhida no arquivo.')
