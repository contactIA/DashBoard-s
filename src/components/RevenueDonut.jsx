import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { fmtBRL } from '../utils/parseCards.js'

// Paleta consistente com o restante do painel
const PALETTE = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#14B8A6']

const DonutTooltip = ({ active, payload, total }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const pct = total > 0 ? (d.value / total) * 100 : 0
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[150px]">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-2 h-2 rounded-full inline-block" style={{ background: d.color }} />
        <span className="font-semibold text-slate-700">{d.name}</span>
      </div>
      <div className="flex justify-between gap-4 text-slate-500">
        <span>{fmtBRL(d.value)}</span>
        <span className="font-semibold text-slate-800 font-mono">{pct.toFixed(1).replace('.', ',')}%</span>
      </div>
      <div className="text-slate-400 mt-0.5">{d.count} contrato{d.count === 1 ? '' : 's'}</div>
    </div>
  )
}

/**
 * Rosca de receita FECHADA (R$) por valor de uma dimensão (ex: agendador).
 * rows: [{ value, fechada, count }] vindo de revenueByDimension().
 * Responde "de onde vem o faturamento fechado?" de relance — não volume, dinheiro.
 */
export default function RevenueDonut({ title, rows }) {
  if (!rows?.length) return null
  const total = rows.reduce((s, r) => s + r.fechada, 0)
  if (total <= 0) return null

  const data = rows.map((r, i) => ({
    name:  r.value ?? `sem ${title.toLowerCase()}`,
    value: r.fechada,
    count: r.count,
    color: PALETTE[i % PALETTE.length],
  }))

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800 mb-0.5">Receita fechada por {title.toLowerCase()}</h3>
      <p className="text-xs text-slate-400 mb-4">Contratos fechados no período · só valor real preenchido</p>

      <div className="flex items-center gap-5">
        <div className="relative shrink-0" style={{ width: 148, height: 148 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={70}
                paddingAngle={2}
                stroke="none"
                startAngle={90}
                endAngle={-270}
              >
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip content={<DonutTooltip total={total} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] text-slate-400">Total</span>
            <span className="text-sm font-bold font-mono text-slate-800">{fmtBRL(total, { short: true })}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-slate-600 truncate flex-1">
                {d.name}
                <span className="text-slate-400"> · {d.count}</span>
              </span>
              <span className="font-mono font-semibold text-slate-800">{fmtBRL(d.value, { short: true })}</span>
              <span className="font-mono text-slate-400 w-9 text-right">{((d.value / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
