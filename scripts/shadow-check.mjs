// Validação-sombra (PLANO_INGESTAO_E_PROCESSO.md, FASE A3): compara a resposta
// do dashboard pelos DOIS caminhos — Helena ao vivo (?source=helena) vs tabela
// `cards` (?source=db) — e aponta qualquer divergência que afete métrica.
//
// Uso:
//   node scripts/shadow-check.mjs <slug-ou-accountId> [token-de-acesso]
//   DASH_URL=https://outra-url.vercel.app node scripts/shadow-check.mjs salutar
//
// Critério da virada (ligar readFromDb): diff ZERO por 5 dias consecutivos.
// O diff esperado enquanto o cron ainda não rodou após uma mudança: cards
// alterados na última hora (a foto do banco tem até 1h de atraso — ok).
// Telefone NÃO é comparado (fonte contactPhone não é ingerida — fallback de
// título cobre; não afeta métrica nenhuma).

const DASH_URL = process.env.DASH_URL ?? 'https://dash-board-s-kappa.vercel.app'
const clinic = process.argv[2]
const accessToken = process.argv[3]
if (!clinic) {
  console.error('Uso: node scripts/shadow-check.mjs <slug-ou-accountId> [token-de-acesso]')
  process.exit(1)
}

async function fetchSource(source) {
  const t = accessToken ? `&t=${encodeURIComponent(accessToken)}` : ''
  const res = await fetch(`${DASH_URL}/api/dashboard?clinic=${encodeURIComponent(clinic)}&source=${source}${t}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${source}: HTTP ${res.status} — ${body.error ?? ''}`)
  return body
}

// Resumo de métricas de um payload — tudo que alimenta KPI/funil/campanhas.
function summarize(d) {
  const byType = {}
  for (const c of d.cards) {
    const t = c.stepType ?? '(sem tipo)'
    byType[t] = (byType[t] ?? 0) + 1
  }
  return {
    total:        d.cards.length,
    porTipo:      byType,
    comDate:      d.cards.filter(c => c.date).length,
    comScheduled: d.cards.filter(c => c.scheduledAt).length,
    comEventDate: d.cards.filter(c => c.eventDate).length,
    valorFechado: d.cards.filter(c => c.stepType === 'converted' && c.value > 0)
                    .reduce((s, c) => s + c.value, 0),
    comCampanha:  d.cards.filter(c => Object.values(c.dims ?? {}).some(Boolean)).length,
    ticket:       d.ticket,
    noDate:       d.diagnostics?.noDate,
    unmapped:     d.diagnostics?.unmappedCount,
  }
}

const [helena, db] = await Promise.all([fetchSource('helena'), fetchSource('db')])
const a = summarize(helena), b = summarize(db)

console.log(`Clínica: ${helena.clinic} — Helena ao vivo vs tabela cards\n`)
let diffs = 0
const compare = (label, va, vb) => {
  const eq = JSON.stringify(va) === JSON.stringify(vb)
  if (!eq) diffs++
  console.log(`${eq ? '✓' : '✗ DIFF'}  ${label.padEnd(22)} helena=${JSON.stringify(va)}  db=${JSON.stringify(vb)}`)
}
compare('total de cards', a.total, b.total)
for (const t of new Set([...Object.keys(a.porTipo), ...Object.keys(b.porTipo)])) {
  compare(`  tipo ${t}`, a.porTipo[t] ?? 0, b.porTipo[t] ?? 0)
}
compare('com "Agendado Para"', a.comDate, b.comDate)
compare('com "Agendado em"', a.comScheduled, b.comScheduled)
compare('com eventDate', a.comEventDate, b.comEventDate)
compare('valor fechado (R$)', a.valorFechado, b.valorFechado)
compare('com dimensão', a.comCampanha, b.comCampanha)
compare('ticket médio', a.ticket, b.ticket)
compare('diag. noDate', a.noDate, b.noDate)
compare('diag. unmapped', a.unmapped, b.unmapped)

console.log(diffs === 0
  ? '\n✅ SOMBRA LIMPA — os dois caminhos batem.'
  : `\n⚠ ${diffs} divergência(s). Se o cron rodou há menos de 1h, re-rode após a próxima ingestão (:22). Persistindo, investigar antes de ligar readFromDb.`)
process.exit(diffs === 0 ? 0 : 1)
