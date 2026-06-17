import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { fmtBRL } from '../utils/parseCards.js'

// Paleta consistente com o restante do painel
const PALETTE = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#14B8A6']

/**
 * Rosca de receita FECHADA (R$) por valor de uma dimensão (ex: agendador).
 * rows: [{ value, fechada, count }] vindo de revenueByDimension().
 * Responde "de onde vem o faturamento fechado?" de relance — não volume, dinheiro.
 * No hover (fatia ou legenda), o centro sobrescreve o total com a fatia ativa.
 */
export default function RevenueDonut({ title, rows }) {
  const [active, setActive] = useState(null)
  if (!rows?.length) return null
  const total = rows.reduce((s, r) => s + r.fechada, 0)
  if (total <= 0) return null

  const data = rows.map((r, i) => ({
    name:  r.value ?? `sem ${title.toLowerCase()}`,
    value: r.fechada,
    count: r.count,
    color: PALETTE[i % PALETTE.length],
  }))

  const sel = active != null ? data[active] : null
  const pct = (v) => ((v / total) * 100).toFixed(0)

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
                onMouseEnter={(_, i) => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.color}
                    fillOpacity={active == null || active === i ? 1 : 0.3}
                    style={{ cursor: 'pointer', transition: 'fill-opacity 120ms' }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Centro: total por padrão; sobrescreve com a fatia ativa no hover */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-5 text-center">
            {sel ? (
              <>
                <span className="text-[10px] text-slate-400 truncate max-w-full leading-tight">{sel.name}</span>
                <span className="text-lg font-bold font-mono leading-none mt-0.5" style={{ color: sel.color }}>{pct(sel.value)}%</span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">{fmtBRL(sel.value, { short: true })}</span>
              </>
            ) : (
              <>
                <span className="text-[10px] text-slate-400">Total</span>
                <span className="text-sm font-bold font-mono text-slate-800">{fmtBRL(total, { short: true })}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {data.map((d, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs cursor-default rounded-md px-1 -mx-1 transition-colors ${active === i ? 'bg-slate-50' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-slate-600 truncate flex-1">
                {d.name}
                <span className="text-slate-400"> · {d.count}</span>
              </span>
              <span className="font-mono font-semibold text-slate-800">{fmtBRL(d.value, { short: true })}</span>
              <span className="font-mono text-slate-400 w-9 text-right">{pct(d.value)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
