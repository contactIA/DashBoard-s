export default function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
          style={{ backgroundColor: color + '1A' }}
        >
          {icon}
        </div>
      </div>
      <div>
        <span className="text-3xl font-bold text-slate-900 leading-none tabular-nums">{value}</span>
      </div>
      {sub && <span className="text-xs text-slate-400 leading-snug">{sub}</span>}
    </div>
  )
}
