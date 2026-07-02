import { fmtBRL } from '../utils/parseCards.js'

function DeltaBadge({ value, goodWhenUp = true }) {
  if (value == null) return null
  const up = value >= 0
  const good = goodWhenUp ? up : !up
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${good ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(0)}%
    </span>
  )
}

function HeroCard({ label, value, sub, delta, goodWhenUp = true, accent }) {
  return (
    <div className="flex-1 min-w-[170px] bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1" style={{ background: accent }} />
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">{label}</div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[30px] font-bold leading-none text-slate-900 font-mono tracking-tight">{value}</span>
        <DeltaBadge value={delta} goodWhenUp={goodWhenUp} />
      </div>
      <div className="text-xs text-slate-400 mt-2.5">{sub}</div>
    </div>
  )
}

/** Faixa-herói: os números que respondem "como está o negócio?" (ganho × perdido × em aberto). */
export default function HeroStrip({ revenue, kpis, deltas, revenueDelta, lostDelta }) {
  const pct = (v) => (v == null ? '—' : v.toFixed(1).replace('.', ',') + '%')
  const decididos = (kpis?.notClosed ?? 0) + (kpis?.converted ?? 0)

  return (
    <div className="px-5 py-5 border-b border-slate-200">
      <div className="flex flex-wrap gap-3">
        <HeroCard
          label="Ganho · receita fechada"
          value={fmtBRL(revenue?.fechada ?? 0, { short: true })}
          sub={`${kpis?.converted ?? 0} contrato${kpis?.converted === 1 ? '' : 's'} no período`}
          delta={revenueDelta} goodWhenUp accent="#10B981"
        />
        <HeroCard
          label="Perdido · não fechou"
          value={fmtBRL(revenue?.perdidaNaoFechou ?? 0, { short: true })}
          sub={`${kpis?.notClosed ?? 0} compareceram e não fecharam`}
          delta={lostDelta} goodWhenUp={false} accent="#F59E0B"
        />
        <HeroCard
          label="Em aberto · negociação"
          value={fmtBRL(revenue?.emNegociacao ?? 0, { short: true })}
          sub={`${revenue?.negociacaoCount ?? 0} orçamento${revenue?.negociacaoCount === 1 ? '' : 's'} a fechar`}
          accent="#8B5CF6"
        />
        <HeroCard
          label="Conversão"
          value={pct(kpis?.conversionRate)}
          sub={`${kpis?.converted ?? 0} de ${decididos} que decidiram`}
          delta={deltas?.conversionRate} goodWhenUp accent="#0EA5E9"
        />
        <HeroCard
          label="Comparecimento"
          value={pct(kpis?.attendanceRate)}
          sub={
            (kpis?.missed ?? 0) > 0
              ? `${kpis.missed} faltaram${revenue?.perdidaFaltas > 0 ? ` · ${fmtBRL(revenue.perdidaFaltas, { short: true })} perdidos` : ''}`
              : `${kpis?.attended ?? 0} de ${kpis?.shouldAttend ?? 0} agendados`
          }
          delta={deltas?.attendanceRate} goodWhenUp accent="#F59E0B"
        />
      </div>
    </div>
  )
}
