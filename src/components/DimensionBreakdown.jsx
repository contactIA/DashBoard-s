const fmtPct = (v) => v == null ? '—' : v.toFixed(0) + '%'

/**
 * Quebra por dimensão (agendador, origem, …) com contas conferíveis de cabeça:
 *   AGENDOU → desses, NÃO FECHOU / EM ABERTO / FECHOU
 *   COMPAR. = compareceram ÷ agendou   ·   FECH. = fechou ÷ compareceram
 * rows: [{ value, funnel }] vindo de breakdownByDimension().
 * typeLabels: rótulo exato dos steps da clínica por tipo (fala o vocabulário dela).
 */
export default function DimensionBreakdown({ title, rows, typeLabels }) {
  if (!rows?.length) return null

  // "Em aberto" só aparece se alguma linha tiver orçamento em negociação
  const hasNegotiating = rows.some(r => r.funnel.negotiating > 0)

  const cols = [
    { key: 'agendou',   label: 'Agendou' },
    { key: 'attended',  label: typeLabels?.attended ?? 'Não fechou' },
    ...(hasNegotiating ? [{ key: 'negotiating', label: typeLabels?.negotiating ?? 'Em aberto' }] : []),
    { key: 'converted', label: typeLabels?.converted ?? 'Fechou' },
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800 mb-0.5">{title}</h3>
      <p className="text-xs text-slate-400 mb-4">
        Agendou → compareceu → fechou no período, por {title.toLowerCase()}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-200">
              <th className="text-left font-semibold py-2 pr-2">{title}</th>
              {cols.map(c => (
                <th key={c.key} className="text-right font-semibold py-2 px-2">{c.label}</th>
              ))}
              <th className="text-right font-semibold py-2 pl-2">Compar.</th>
              <th className="text-right font-semibold py-2 pl-2">Fech.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ value, funnel: f }) => {
              // compareceram = não fechou + em aberto + fechou (estágio "compareceu")
              const compar = f.agendou > 0 ? (f.compareceu / f.agendou) * 100 : null
              const fech   = f.compareceu > 0 ? (f.fechou / f.compareceu) * 100 : null
              return (
                <tr key={value ?? '_sem'} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-2 font-medium text-slate-700">
                    {value ?? <span className="text-slate-400 italic">sem {title.toLowerCase()}</span>}
                  </td>
                  {cols.map(c => (
                    <td key={c.key} className="text-right py-2.5 px-2 font-mono tabular-nums text-slate-600">
                      {f[c.key]}
                    </td>
                  ))}
                  <td className="text-right py-2.5 pl-2 font-mono tabular-nums text-amber-600">
                    {fmtPct(compar)}
                  </td>
                  <td className="text-right py-2.5 pl-2 font-mono tabular-nums text-emerald-600">
                    {fmtPct(fech)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
