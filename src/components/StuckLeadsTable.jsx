import { fmtPhone } from '../utils/parseCards.js'

const OPTIONS = [3, 7, 14]

/**
 * Leads parados (PLANO_AGENDADOR_CAMPANHA.md FASE 6) — cards em lead/
 * notScheduled sem movimentação há N dias. Seletor 3/7/14 no próprio card
 * (default 7, controlado pelo pai). Fila de trabalho pronta para a CRC.
 */
export default function StuckLeadsTable({ leads, minDays, onMinDaysChange }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Leads parados</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {leads.length} lead{leads.length !== 1 ? 's' : ''} sem movimentação há {minDays}+ dias
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {OPTIONS.map(n => (
            <button key={n} type="button" onClick={() => onMinDaysChange(n)}
              className={`text-xs px-2.5 py-1.5 rounded-md border font-medium transition-colors ${
                minDays === n
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}>
              {n}d+
            </button>
          ))}
        </div>
      </div>

      {leads.length === 0 ? (
        <p className="text-xs text-slate-400 px-5 py-6 text-center">Nenhum lead parado há {minDays}+ dias.</p>
      ) : (
        <>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Paciente</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 hidden sm:table-cell">Telefone</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Etapa</th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Dias parado</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 10).map(c => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-2.5">
                    <div className="font-medium text-slate-800">{c.name}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-500 hidden sm:table-cell">
                    {fmtPhone(c.phone) ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{c.stepLabel ?? '—'}</td>
                  <td className="px-5 py-2.5 text-right font-semibold font-mono text-orange-500">
                    {c.daysStuck}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {leads.length > 10 && (
            <div className="px-5 py-2.5 border-t border-slate-100 text-xs text-slate-400 text-center">
              +{leads.length - 10} leads não exibidos
            </div>
          )}
        </>
      )}
    </div>
  )
}
