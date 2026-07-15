import { fmtBRL } from '../utils/parseCards.js'

function RevenueCard({ label, value, sub, icon, gradient, textColor }) {
  return (
    <div className="flex-1 min-w-[180px] rounded-2xl border border-slate-100 bg-white p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
          style={{ background: gradient }}>
          {icon}
        </div>
      </div>
      <div className={`text-[32px] font-bold leading-none font-mono tracking-tight ${textColor}`}>
        {value}
      </div>
      <div className="text-[11px] text-slate-400">{sub}</div>
    </div>
  )
}

export default function RevenueRow({ revenue, kpis }) {
  if (!revenue) return null

  const porEtapa = revenue.semValorPorEtapa ?? []

  return (
    <div className="border-b border-slate-200 bg-[#F4F6FA]">
      <div className="px-5 py-5">

        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full shrink-0"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#ef4444)' }} />
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Receita</span>
          <span className="text-[11px] text-slate-400">· baseado nos valores reais dos cards</span>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RevenueCard
            label="Receita fechada"
            value={fmtBRL(revenue.fechada)}
            sub={`${kpis?.converted ?? 0} contratos fechados no período`}
            icon="✓"
            gradient="rgba(16,185,129,0.12)"
            textColor="text-emerald-600"
          />
          <RevenueCard
            label="Oportunidade perdida"
            value={fmtBRL(revenue.perdidaNaoFechou)}
            sub={`${kpis?.notClosed ?? 0} pacientes compareceram mas não fecharam`}
            icon="↗"
            gradient="rgba(245,158,11,0.12)"
            textColor="text-amber-500"
          />
        </div>

        {/* Alerta sem valor — agrupado por etapa */}
        {porEtapa.length > 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <div className="flex items-start gap-2">
              <span className="text-amber-500 text-sm shrink-0 mt-0.5">⚠</span>
              <div className="text-xs text-amber-800">
                <span className="font-semibold">
                  {revenue.semValorTotal} card{revenue.semValorTotal > 1 ? 's' : ''} sem valor preenchido
                </span>
                <span className="text-amber-600"> — preencha para a receita ficar precisa</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {porEtapa.map(s => (
                    <span key={s.label}
                      className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md bg-white border border-amber-200 text-amber-700">
                      {s.label} <span className="font-semibold font-mono">{s.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
