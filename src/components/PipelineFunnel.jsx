const fmtPct = (v) => v == null ? '—' : v.toFixed(1).replace('.', ',') + '%'

function Stage({ label, value, base, color, rate }) {
  const pct = base > 0 ? (value / base) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-mono text-slate-500">
          {value}
          {rate != null && <span className="text-slate-400"> · {fmtPct(rate)}</span>}
        </span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export default function PipelineFunnel({ funnel }) {
  if (!funnel || funnel.entrou === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full flex items-center justify-center">
        <p className="text-sm text-slate-400">Sem cards no período.</p>
      </div>
    )
  }

  const f = funnel
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full">
      <h3 className="text-sm font-semibold text-slate-800">Funil de pipeline</h3>
      <p className="text-xs text-slate-400 mt-0.5 mb-5">Coorte que entrou no período (por data de entrada)</p>

      <div className="flex flex-col gap-4">
        <Stage label="Leads (entraram)" value={f.entrou}     base={f.entrou} color="#0EA5E9" />
        <Stage label="Agendou"          value={f.agendou}    base={f.entrou} color="#6366F1" rate={f.taxaAgendamento} />
        <Stage label="Compareceu"       value={f.compareceu} base={f.entrou} color="#F59E0B" rate={f.taxaComparecimento} />
        <Stage label="Fechou"           value={f.fechou}     base={f.entrou} color="#10B981" rate={f.taxaFechamento} />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-100 text-center">
        {[
          { label: 'Não agendaram', value: f.lead,      color: 'text-sky-600' },
          { label: 'Faltou',        value: f.missed,    color: 'text-orange-500' },
          { label: 'Cancelou',      value: f.cancelled, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label}>
            <div className={`text-lg font-semibold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
