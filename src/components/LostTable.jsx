import { fmtBRL, fmtPhone } from '../utils/parseCards.js'

function fmtDate(str) {
  if (!str) return '—'
  const [, m, d] = str.split('-')
  return `${d}/${m}`
}

export default function LostTable({ cards, ticket }) {
  if (!cards?.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800">Compareceu mas não fechou</h3>
        <p className="text-xs text-slate-400 mt-1">Nenhum paciente nesta etapa no período.</p>
      </div>
    )
  }

  const totalPotencial = cards.reduce((s, c) => s + (c.value > 0 ? c.value : 0), 0)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Compareceu mas não fechou</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {cards.length} paciente{cards.length !== 1 ? 's' : ''}
            {ticket ? ` · ${fmtBRL(totalPotencial, { short: true })} em risco` : ''}
          </p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 bg-amber-50 text-amber-600 rounded-md">
          RECUPERÁVEL
        </span>
      </div>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Paciente</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 hidden sm:table-cell">Telefone</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Data</th>
            <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Potencial</th>
          </tr>
        </thead>
        <tbody>
          {cards.slice(0, 10).map((c) => (
            <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="px-5 py-2.5">
                <div className="font-medium text-slate-800">{c.name}</div>
              </td>
              <td className="px-3 py-2.5 font-mono text-slate-500 hidden sm:table-cell">
                {fmtPhone(c.phone) ?? '—'}
              </td>
              <td className="px-3 py-2.5 font-mono text-slate-500">{fmtDate(c.date)}</td>
              <td className="px-5 py-2.5 text-right font-semibold font-mono text-slate-700">
                {c.value > 0
                  ? fmtBRL(c.value)
                  : <span className="text-amber-500 font-normal text-[11px]">sem valor ⚠</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {cards.length > 10 && (
        <div className="px-5 py-2.5 border-t border-slate-100 text-xs text-slate-400 text-center">
          +{cards.length - 10} pacientes não exibidos
        </div>
      )}
    </div>
  )
}
