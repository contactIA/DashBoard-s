import { useState } from 'react'

export default function StepDistribution({ cards, steps, from, to }) {
  const [mode, setMode] = useState('period') // 'period' | 'all'
  if (!cards?.length || !steps) return null

  const filtered = mode === 'period' && from && to
    ? cards.filter(c => c.date && c.date >= from && c.date <= to)
    : cards

  const counts = Object.entries(steps).map(([key, step]) => ({
    label: step.label,
    color: step.color,
    count: filtered.filter(c => c.stepKey === key).length,
  })).sort((a, b) => b.count - a.count)

  const max   = Math.max(...counts.map(c => c.count), 1)
  const total = counts.reduce((s, c) => s + c.count, 0)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-800">Distribuição por etapa</h3>
        {/* Toggle período vs geral */}
        <div className="flex text-[10px] font-semibold rounded-md overflow-hidden border border-slate-200">
          <button
            onClick={() => setMode('period')}
            className={`px-2 py-1 transition-colors ${mode === 'period' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Período
          </button>
          <button
            onClick={() => setMode('all')}
            className={`px-2 py-1 transition-colors ${mode === 'all' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Geral
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        {mode === 'all'
          ? `Todos os ${total} cards no painel`
          : `${total} cards no período selecionado`}
      </p>

      <div className="flex flex-col gap-3">
        {counts.map(s => (
          <div key={s.label} className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-slate-500 truncate">{s.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(s.count / max) * 100}%`, background: s.color }}
                />
              </div>
              <span className="font-semibold font-mono text-slate-700 w-4 text-right">{s.count}</span>
            </div>
          </div>
        ))}
      </div>

      {mode === 'all' && (
        <p className="text-[10px] text-slate-400 mt-4 leading-snug">
          * Modo Geral bate com os contadores da Helena — sem filtro por data de agendamento.
        </p>
      )}
    </div>
  )
}
