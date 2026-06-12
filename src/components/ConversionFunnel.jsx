import { fmtBRL } from '../utils/parseCards.js'

export default function ConversionFunnel({ kpis, ticket }) {
  if (!kpis) return null

  const totalScheduled = (kpis.shouldAttend ?? 0) + (kpis.scheduled ?? 0)
  const attended  = kpis.attended ?? 0
  const converted = kpis.converted ?? 0
  const lost1     = (kpis.missed ?? 0) + (kpis.cancelled ?? 0)
  const lost2     = kpis.attended ?? 0

  const pct = (v) => totalScheduled > 0 ? (v / totalScheduled) * 100 : 0

  const steps = [
    { label: 'Agendou / Reagendou', value: totalScheduled, pct: 100, color: '#6366F1' },
    { label: 'Compareceu',          value: attended,       pct: pct(attended),  color: '#F59E0B', lost: lost1 },
    { label: 'Fechou',              value: converted,      pct: pct(converted), color: '#10B981', lost: lost2 },
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full">
      <h3 className="text-sm font-semibold text-slate-800">Funil de conversão</h3>
      <p className="text-xs text-slate-400 mt-0.5 mb-5">De agendado a fechado</p>

      <div className="flex flex-col gap-4">
        {steps.map((s, i) => (
          <div key={s.label}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-700">{s.label}</span>
              <span className="font-mono text-slate-500">
                {s.value}{' '}
                <span className="text-slate-400">· {s.pct.toFixed(1).replace('.', ',')}%</span>
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${s.pct}%`, background: s.color }}
              />
            </div>
            {s.lost != null && s.lost > 0 && (
              <div className="text-[10px] text-red-400 font-mono mt-1">
                −{s.lost}
                {ticket ? ` (${fmtBRL(s.lost * ticket, { short: true })})` : ''}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
