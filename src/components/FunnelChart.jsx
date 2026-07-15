import { fmtBRL } from '../utils/parseCards.js'

const fmtPct = (v) => (v == null ? '—' : v.toFixed(0) + '%')

/**
 * Funil de pipeline em trapézio: barras centralizadas que estreitam de cima
 * para baixo, com a taxa de passagem entre etapas. Mesmo período (data efetiva) dos KPIs.
 */
// stat do rodapé → tipo de métrica, para renomear com o step exato da clínica
const STAT_TYPE = { missed: 'missed', cancelled: 'cancelled', rescheduled: 'rescheduled', naoAgendou: 'notScheduled' }

export default function FunnelChart({ funnel, revenue, typeLabels }) {
  const hasActivity = funnel && (funnel.entrou > 0 || funnel.agendou > 0 || funnel.compareceu > 0 || funnel.fechou > 0)
  if (!hasActivity) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-center">
        <p className="text-sm text-slate-400">Sem cards no período.</p>
      </div>
    )
  }

  const f = funnel
  // "Entraram" (criação) e os demais estágios (movimentação) são coortes
  // distintas — qualquer barra pode ser a maior, a largura normaliza pelo pico.
  const max = Math.max(f.entrou, f.agendou, f.compareceu, f.fechou, 1)
  const widthOf = (v) => `${Math.max(5, (v / max) * 100)}%`

  const stages = [
    { label: 'Leads (entraram)', value: f.entrou,     color: '#0EA5E9', passage: null },
    { label: 'Agendaram',        value: f.agendou,    color: '#6366F1', passage: f.entrou     ? (f.agendou / f.entrou) * 100     : null },
    { label: 'Compareceram',     value: f.compareceu, color: '#F59E0B', passage: f.agendou    ? (f.compareceu / f.agendou) * 100 : null },
    { label: 'Fecharam',         value: f.fechou,     color: '#10B981', passage: f.compareceu ? (f.fechou / f.compareceu) * 100  : null },
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">Funil de pipeline</h3>
      <p className="text-xs text-slate-400 mt-0.5 mb-5">Período selecionado · % = passagem de uma etapa à seguinte</p>

      <div className="flex flex-col">
        {stages.map((s, i) => (
          <div key={s.label}>
            {s.passage != null && (
              <div className="text-center text-[11px] text-slate-400 py-1">↓ {fmtPct(s.passage)}</div>
            )}
            <div className="text-center">
              <div className="text-xs font-medium text-slate-600 mb-1.5">
                {s.label} · <span className="font-mono font-semibold text-slate-800">{s.value}</span>
              </div>
              <div
                className="mx-auto rounded-lg h-10 flex items-center justify-center transition-all"
                style={{ width: widthOf(s.value), background: s.color }}
              >
                {(s.value / max) > 0.12 && (
                  <span className="text-white text-xs font-semibold font-mono">{s.value}</span>
                )}
              </div>
            </div>

            {/* Faltaram = vazamento entre "Agendaram" e "Compareceram" */}
            {i === 1 && f.missed > 0 && (
              <div className="text-center pt-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                  ✕ {f.missed} faltaram
                  {(f.compareceu + f.missed) > 0 && (
                    <span className="font-semibold">· {fmtPct((f.missed / (f.compareceu + f.missed)) * 100)} de não comparecimento</span>
                  )}
                </span>
              </div>
            )}

            {/* Em negociação aparece como ramo logo após "Compareceram" */}
            {i === 2 && f.negotiating > 0 && (
              <div className="text-center pt-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-violet-50 text-violet-600 border border-violet-100">
                  ↳ {f.negotiating} em negociação
                  {revenue?.emNegociacao > 0 && <span className="font-semibold">· {fmtBRL(revenue.emNegociacao, { short: true })} a fechar</span>}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-2 mt-6 pt-4 border-t border-slate-100 text-center" style={{ gridTemplateColumns: `repeat(${1 + f.extraStats.length}, minmax(0, 1fr))` }}>
        {[
          { key: 'naoAgendou', label: 'Não agendou', value: f.naoAgendou, color: 'text-sky-600' },
          ...f.extraStats,
        ].map(s => (
          <div key={s.key}>
            <div className={`text-lg font-semibold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-slate-400">
              {typeLabels?.[STAT_TYPE[s.key]] ?? s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
