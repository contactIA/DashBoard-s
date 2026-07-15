import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// Séries por tipo de métrica (chaves emitidas por groupCardsByTime) — agnóstico de clínica
const SERIES = [
  { key: 'missed',    label: 'Faltou',               color: '#F97316', fill: true },
  { key: 'attended',  label: 'Compareceu s/ Fechar', color: '#F59E0B', fill: false },
  { key: 'converted', label: 'Fechou',               color: '#10B981', fill: false },
  { key: 'cancelled', label: 'Cancelou',             color: '#EF4444', fill: false },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            <span className="text-slate-500">{p.name}</span>
          </div>
          <span className="font-semibold text-slate-800 font-mono">{p.value}</span>
        </div>
      ))}
      {total > 0 && (
        <div className="border-t border-slate-100 mt-2 pt-2 flex justify-between text-slate-500">
          <span>Total</span>
          <span className="font-semibold text-slate-800 font-mono">{total}</span>
        </div>
      )}
    </div>
  )
}

export default function TrendChart({ data, granularity }) {
  if (!data?.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-center h-80 text-slate-400 text-sm shadow-sm">
        Nenhum dado no período selecionado
      </div>
    )
  }

  const unit = granularity === 'day' ? 'dia' : granularity === 'week' ? 'semana' : 'mês'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Tendência de Atendimentos</h3>
          <p className="text-xs text-slate-400 mt-0.5">Resultado por {unit}</p>
        </div>
        {/* Legend inline */}
        <div className="flex flex-wrap gap-3 justify-end">
          {SERIES.map(s => (
            <div key={s.key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            {SERIES.filter(s => s.fill).map(s => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={s.color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 4" stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          {SERIES.map(s => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={s.fill ? `url(#grad-${s.key})` : 'transparent'}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
