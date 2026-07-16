import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { fmtBRL } from '../utils/parseCards.js'

/**
 * Contratos: resultado (em R$ e contagem) de quem COMPARECEU no período.
 * "Contratos potenciais" = não fechou + em aberto + fechou — desses, quanto
 * virou dinheiro (ganho), quanto escapou (perdido) e quanto ainda está na mesa.
 * Substitui a antiga dimensão por etiqueta "fechou tratamento" (redundante).
 */
export default function ContractsCard({ funnel, revenue }) {
  const [active, setActive] = useState(null)
  if (!funnel || !revenue) return null

  const slices = [
    { key: 'ganho',   label: 'Ganho (fechou)',       count: funnel.converted,   money: revenue.fechada,          color: '#10B981' },
    { key: 'perdido', label: 'Perdido (não fechou)', count: funnel.attended,    money: revenue.perdidaNaoFechou, color: '#F59E0B' },
    { key: 'aberto',  label: 'Em aberto',            count: funnel.negotiating, money: revenue.emNegociacao,     color: '#8B5CF6' },
  ].filter(s => s.count > 0 || s.money > 0)

  const contratos = funnel.attended + funnel.negotiating + funnel.converted
  if (!contratos) return null

  const totalMoney = slices.reduce((s, x) => s + x.money, 0)
  // fechou ÷ compareceram (em aberto no denominador) — mesma régua da
  // Conversão do topo; o rodapé "X compareceram → Y fecharam" confere direto.
  const taxa       = contratos > 0 ? Math.round((funnel.converted / contratos) * 100) : null
  const pct = (v) => (totalMoney > 0 ? ((v / totalMoney) * 100).toFixed(0) + '%' : '—')

  const pieData = slices.filter(s => s.money > 0)
  const sel = active != null ? pieData[active] : null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800 mb-0.5">Contratos · ganho × perdido</h3>
      <p className="text-xs text-slate-400 mb-4">
        {contratos} compareceram no período (contratos potenciais) · só valor real preenchido
      </p>

      <div className="flex items-center gap-5">
        {pieData.length > 0 && (
          <div className="relative shrink-0" style={{ width: 148, height: 148 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData} dataKey="money" nameKey="label"
                  innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none"
                  startAngle={90} endAngle={-270}
                  onMouseEnter={(_, i) => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                >
                  {pieData.map((s, i) => (
                    <Cell
                      key={s.key} fill={s.color}
                      fillOpacity={active == null || active === i ? 1 : 0.3}
                      style={{ cursor: 'pointer', transition: 'fill-opacity 120ms' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-5 text-center">
              {sel ? (
                <>
                  <span className="text-[10px] text-slate-400 truncate max-w-full leading-tight">{sel.label}</span>
                  <span className="text-lg font-bold font-mono leading-none mt-0.5" style={{ color: sel.color }}>{pct(sel.money)}</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">{fmtBRL(sel.money, { short: true })}</span>
                </>
              ) : (
                <>
                  <span className="text-[10px] text-slate-400">Total</span>
                  <span className="text-sm font-bold font-mono text-slate-800">{fmtBRL(totalMoney, { short: true })}</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {slices.map((s) => {
            const i = pieData.indexOf(s)
            return (
              <div
                key={s.key}
                className={`flex items-center gap-2 text-xs rounded-md px-1 -mx-1 transition-colors ${active != null && active === i ? 'bg-slate-50' : ''}`}
                onMouseEnter={() => i >= 0 && setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-slate-600 truncate flex-1">
                  {s.label}
                  <span className="text-slate-400"> · {s.count}</span>
                </span>
                <span className="font-mono font-semibold text-slate-800">{fmtBRL(s.money, { short: true })}</span>
                <span className="font-mono text-slate-400 w-9 text-right">{pct(s.money)}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
        {contratos} compareceram → <span className="font-semibold text-emerald-600">{funnel.converted} fecharam</span>
        {taxa != null && <> · taxa de fechamento <span className="font-mono font-semibold">{taxa}%</span></>}
        {funnel.negotiating > 0 && <> · {funnel.negotiating} ainda em aberto</>}
      </div>
    </div>
  )
}
