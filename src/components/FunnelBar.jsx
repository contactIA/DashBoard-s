import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer,
} from 'recharts'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { name, value, fill } = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: fill }} />
        <span className="text-slate-600">{name}</span>
        <span className="font-bold text-slate-900 ml-auto pl-4 tabular-nums">{value}</span>
      </div>
    </div>
  )
}

export default function FunnelBar({ cards, steps, from, to }) {
  if (!cards?.length || !steps) return null

  const filtered = from && to
    ? cards.filter(c => c.date && c.date >= from && c.date <= to)
    : cards

  const data = Object.entries(steps)
    .map(([key, step]) => ({
      name: step.label,
      count: filtered.filter(c => c.stepKey === key).length,
      color: step.color,
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-slate-800">Distribuição por Etapa</h3>
        <p className="text-xs text-slate-400 mt-0.5">Período selecionado</p>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
            width={148}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
          <Bar dataKey="count" radius={[0, 6, 6, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
