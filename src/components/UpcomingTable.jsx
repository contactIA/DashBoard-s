import { fmtBRL, fmtPhone } from '../utils/parseCards.js'
import { todayBR, daysAgoBR } from '../utils/dates.js'

function fmtDate(str) {
  if (!str) return '—'
  const [, m, d] = str.split('-')
  return `${d}/${m}`
}

function isToday(str) { return str === todayBR() }
function isTomorrow(str) { return str === daysAgoBR(-1) }

export default function UpcomingTable({ cards, ticket }) {
  if (!cards?.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="text-3xl mb-2">📅</div>
        <p className="text-sm text-slate-400">Nenhum atendimento futuro encontrado</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Próximos Atendimentos</h3>
          <p className="text-xs text-slate-400 mt-0.5">{cards.length} agendado{cards.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[90px]">Data</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[60px]">Hora</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Paciente</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 hidden md:table-cell">Telefone</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</th>
            <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Potencial</th>
          </tr>
        </thead>
        <tbody>
          {cards.slice(0, 30).map(c => (
            <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="px-5 py-2.5 font-mono text-slate-600">
                {fmtDate(c.date)}
                {isToday(c.date) && (
                  <span className="ml-1.5 text-[10px] font-semibold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">Hoje</span>
                )}
                {isTomorrow(c.date) && (
                  <span className="ml-1.5 text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Amanhã</span>
                )}
              </td>
              <td className="px-3 py-2.5 font-mono font-semibold text-slate-800">{c.time ?? '—'}</td>
              <td className="px-3 py-2.5 font-medium text-slate-800">{c.name}</td>
              <td className="px-3 py-2.5 font-mono text-slate-500 hidden md:table-cell">{fmtPhone(c.phone) ?? '—'}</td>
              <td className="px-3 py-2.5">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded"
                  style={{
                    background: c.stepColor + '1A',
                    color: c.stepColor,
                  }}
                >
                  {c.stepType === 'rescheduled' ? 'Reagendado' : 'Agendado'}
                </span>
              </td>
              <td className="px-5 py-2.5 text-right font-semibold font-mono text-slate-700">
                {c.value > 0
                  ? fmtBRL(c.value, { short: true })
                  : ticket ? <span className="text-slate-400" title="Estimativa pelo ticket médio">{fmtBRL(ticket, { short: true })}</span> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {cards.length > 30 && (
        <div className="px-5 py-2.5 border-t border-slate-100 text-xs text-slate-400 text-center">
          +{cards.length - 30} registros não exibidos
        </div>
      )}
    </div>
  )
}
