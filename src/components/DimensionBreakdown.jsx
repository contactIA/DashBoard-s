const fmtPct = (v) => v == null ? '—' : v.toFixed(0) + '%'

/**
 * Quebra do funil por uma dimensão (origem, agendador, …).
 * rows: [{ value, funnel }] vindo de breakdownByDimension().
 * untagged: funil dos cards SEM etiqueta da dimensão — nota de reconciliação
 * para os números baterem com o funil principal.
 * typeLabels: rótulo exato dos steps da clínica por tipo (fala o vocabulário dela).
 */
export default function DimensionBreakdown({ title, rows, untagged, typeLabels }) {
  if (!rows?.length) return null

  // "Em aberto" só aparece se alguma linha tiver orçamento em negociação
  const hasNegotiating = rows.some(r => r.funnel.negotiating > 0)

  const cols = [
    { key: 'entrou',    label: 'Entrou' },
    { key: 'agendou',   label: 'Agendou' },
    { key: 'attended',  label: typeLabels?.attended ?? 'Não fechou' },
    ...(hasNegotiating ? [{ key: 'negotiating', label: typeLabels?.negotiating ?? 'Em aberto' }] : []),
    { key: 'converted', label: typeLabels?.converted ?? 'Fechou' },
  ]

  const restos = untagged
    ? [
        { label: 'entraram', v: untagged.entrou },
        { label: 'agendaram', v: untagged.agendou },
        { label: (typeLabels?.converted ?? 'fecharam').toLowerCase(), v: untagged.converted },
      ].filter(x => x.v > 0)
    : []

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800 mb-0.5">{title}</h3>
      <p className="text-xs text-slate-400 mb-4">
        Leads que entraram no período, por {title.toLowerCase()} · e até onde chegaram
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
            {rows.map(({ value, funnel: f }) => (
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
                  {fmtPct(f.taxaComparecimento)}
                </td>
                <td className="text-right py-2.5 pl-2 font-mono tabular-nums text-emerald-600">
                  {fmtPct(f.taxaFechamento)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {restos.length > 0 && (
        <p className="text-[11px] text-slate-400 italic mt-3">
          Sem etiqueta de {title.toLowerCase()} no período: {restos.map(x => `${x.v} ${x.label}`).join(' · ')}
          {' '}— é a diferença para o funil de pipeline.
        </p>
      )}
    </div>
  )
}
