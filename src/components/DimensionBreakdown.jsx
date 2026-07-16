const fmtPct = (v) => v == null ? '—' : v.toFixed(0) + '%'

/**
 * Quebra por dimensão (agendador, origem, …) — colunas e nomenclatura FIXAS
 * em toda clínica (PLANO_AGENDADOR_CAMPANHA.md decisão 3, revisada 16/07):
 *   Agendados · Compareceram · Em aberto · Não fecharam · Fecharam · Compar.% · Fech.%
 * Compareceram = régua `compareceu` do funil (attended+negotiating+converted).
 * "Em aberto" (negotiating) tem coluna própria para a soma fechar aos olhos:
 * Compareceram = Em aberto + Não fecharam + Fecharam.
 * Fech.% = Fecharam ÷ Compareceram [regra do usuário 16/07] — em aberto no
 * denominador, MESMA régua do KPI Conversão do topo (via funnel.taxaFechamento).
 * rows: [{ value, funnel }] vindo de breakdownByDimension(); value === null
 * vira a linha "Sem <dimensão>", sempre por último.
 * typeLabels: vocabulário da clínica vira tooltip nas colunas, não o título.
 */
export default function DimensionBreakdown({ title, rows, typeLabels }) {
  if (!rows?.length) return null

  const cols = [
    { key: 'agendou',     label: 'Agendados' },
    { key: 'compareceu',  label: 'Compareceram' },
    { key: 'negotiating', label: 'Em aberto', tooltip: typeLabels?.negotiating },
    { key: 'attended',    label: 'Não fecharam', tooltip: typeLabels?.attended },
    { key: 'converted',   label: 'Fecharam', tooltip: typeLabels?.converted },
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
                <th key={c.key} className="text-right font-semibold py-2 px-2" title={c.tooltip}>{c.label}</th>
              ))}
              <th className="text-right font-semibold py-2 pl-2">Compar.%</th>
              <th className="text-right font-semibold py-2 pl-2">Fech.%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ value, funnel: f }) => {
              const compar = f.agendou > 0 ? (f.compareceu / f.agendou) * 100 : null
              // Fecharam ÷ Compareceram — igual ao KPI Conversão do topo
              const fech   = f.taxaFechamento
              return (
                <tr key={value ?? '_sem'} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-2 font-medium text-slate-700">
                    {value ?? <span className="text-slate-400 italic">Sem {title.toLowerCase()}</span>}
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
