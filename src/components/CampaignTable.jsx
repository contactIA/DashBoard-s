import { fmtBRL } from '../utils/parseCards.js'

const fmtPct = (v) => v == null ? '—' : v.toFixed(0) + '%'

/**
 * Tabela de Campanhas (PLANO_AGENDADOR_CAMPANHA.md FASE 3.2) — colunas fixas:
 * Campanha · Leads · Agendados · Compareceram · Fecharam · Faltaram ·
 * No-show% · Valor fechado · Ticket médio · Fech.%
 * rows: [{ value, leads, funnel, faltaram, noShowPct, valorFechado, ticketMedio }]
 * vindo de campaignBreakdown(); value === null vira "Sem campanha", por último.
 */
export default function CampaignTable({ rows }) {
  if (!rows?.length) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800 mb-0.5">Campanhas</h3>
      <p className="text-xs text-slate-400 mb-4">Desempenho por campanha no período</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-200">
              <th className="text-left font-semibold py-2 pr-2">Campanha</th>
              <th className="text-right font-semibold py-2 px-2">Leads</th>
              <th className="text-right font-semibold py-2 px-2">Agendados</th>
              <th className="text-right font-semibold py-2 px-2">Compareceram</th>
              <th className="text-right font-semibold py-2 px-2">Fecharam</th>
              <th className="text-right font-semibold py-2 px-2">Faltaram</th>
              <th className="text-right font-semibold py-2 px-2">No-show%</th>
              <th className="text-right font-semibold py-2 px-2">Valor fechado</th>
              <th className="text-right font-semibold py-2 px-2">Ticket médio</th>
              <th className="text-right font-semibold py-2 pl-2">Fech.%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ value, leads, funnel: f, faltaram, noShowPct, valorFechado, ticketMedio }) => {
              const fech = f.compareceu > 0 ? (f.fechou / f.compareceu) * 100 : null
              return (
                <tr key={value ?? '_sem'} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-2 font-medium text-slate-700">
                    {value ?? <span className="text-slate-400 italic">Sem campanha</span>}
                  </td>
                  <td className="text-right py-2.5 px-2 font-mono tabular-nums text-slate-600">{leads}</td>
                  <td className="text-right py-2.5 px-2 font-mono tabular-nums text-slate-600">{f.agendou}</td>
                  <td className="text-right py-2.5 px-2 font-mono tabular-nums text-slate-600">{f.compareceu}</td>
                  <td className="text-right py-2.5 px-2 font-mono tabular-nums text-slate-600">{f.fechou}</td>
                  <td className="text-right py-2.5 px-2 font-mono tabular-nums text-orange-500">{faltaram}</td>
                  <td className="text-right py-2.5 px-2 font-mono tabular-nums text-orange-500">{fmtPct(noShowPct)}</td>
                  <td className="text-right py-2.5 px-2 font-mono tabular-nums text-slate-700">
                    {valorFechado > 0 ? fmtBRL(valorFechado, { short: true }) : '—'}
                  </td>
                  <td className="text-right py-2.5 px-2 font-mono tabular-nums text-slate-600">
                    {ticketMedio != null ? fmtBRL(Math.round(ticketMedio), { short: true }) : '—'}
                  </td>
                  <td className="text-right py-2.5 pl-2 font-mono tabular-nums text-emerald-600">{fmtPct(fech)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
