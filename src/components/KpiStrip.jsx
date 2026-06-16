import Sparkline from './Sparkline.jsx'

const MONO = 'font-mono tabular-nums'

function KpiCell({ label, value, sub, spark, sparkColor, last }) {
  return (
    <div className={`flex-1 min-w-0 px-4 py-3.5 ${last ? '' : 'border-r border-slate-200'}`}>
      <div className="text-[11px] text-slate-400 font-medium mb-1.5 truncate">{label}</div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-[22px] font-semibold text-slate-900 leading-none ${MONO} tracking-tight`}>
          {value}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400 truncate">{sub}</span>
        {spark && <Sparkline values={spark} color={sparkColor} />}
      </div>
    </div>
  )
}

export default function KpiStrip({ kpis, prevKpis, delta: d, chartData, ticket, onTicketChange }) {
  // Séries por TIPO de métrica (emitidas por groupCardsByTime) — agnóstico de clínica
  const rows = chartData?.data ?? []
  const sparkFor = (key) => rows.map(row => row[key] ?? 0)

  const spark = {
    total:       rows.map(r => (r.attended ?? 0) + (r.negotiating ?? 0) + (r.converted ?? 0) + (r.missed ?? 0) + (r.cancelled ?? 0)),
    attended:    rows.map(r => (r.attended ?? 0) + (r.negotiating ?? 0) + (r.converted ?? 0)),
    converted:   sparkFor('converted'),
    missed:      sparkFor('missed'),
    cancelled:   sparkFor('cancelled'),
    rescheduled: sparkFor('rescheduled'),
  }

  return (
    <div className="bg-white border-b border-slate-200 flex overflow-x-auto">
      <KpiCell
        label="Total no período"
        value={kpis?.total ?? '—'}
        sub={`${kpis?.scheduled ?? 0} aguardando`}
        spark={spark.total}
        sparkColor="#6366F1"
      />
      <KpiCell
        label="Comparecimento"
        value={kpis?.attendanceRate != null ? kpis.attendanceRate.toFixed(1).replace('.', ',') + '%' : '—'}
        sub={`${kpis?.attended ?? 0}/${kpis?.shouldAttend ?? 0}`}
        spark={spark.attended}
        sparkColor="#10B981"
      />
      <KpiCell
        label="Conversão"
        value={kpis?.conversionRate != null ? kpis.conversionRate.toFixed(1).replace('.', ',') + '%' : '—'}
        sub={`${kpis?.converted ?? 0} fechamentos`}
        spark={spark.converted}
        sparkColor="#0EA5E9"
      />
      <KpiCell
        label="Faltas"
        value={kpis?.missRate != null ? kpis.missRate.toFixed(1).replace('.', ',') + '%' : '—'}
        sub={`${kpis?.missed ?? 0} no período`}
        spark={spark.missed}
        sparkColor="#EF4444"
      />
      <KpiCell
        label="Cancelamentos"
        value={kpis?.cancelled ?? '—'}
        sub="no período"
        spark={spark.cancelled}
        sparkColor="#F59E0B"
      />
      <KpiCell
        label="Reagendamentos"
        value={kpis?.rescheduled ?? '—'}
        sub="no período"
        spark={spark.rescheduled}
        sparkColor="#8B5CF6"
      />
      {/* Ticket médio — editável */}
      <div className="flex-1 min-w-0 px-4 py-3.5">
        <div className="text-[11px] text-slate-400 font-medium mb-1.5">Ticket médio</div>
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-[13px] text-slate-400 font-medium">R$</span>
          <input
            type="number"
            value={ticket ?? ''}
            onChange={e => onTicketChange(Number(e.target.value))}
            className={`text-[22px] font-semibold text-slate-900 leading-none ${MONO} tracking-tight w-28 bg-transparent border-0 focus:outline-none focus:border-b focus:border-indigo-400 p-0`}
            placeholder="0"
            min={0}
          />
        </div>
        <span className="text-[11px] text-slate-400">referência editável</span>
      </div>
    </div>
  )
}
