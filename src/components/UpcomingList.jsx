function fmtDate(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().slice(0, 10)
}

function isTomorrow(dateStr) {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return dateStr === d.toISOString().slice(0, 10)
}

function getDayLabel(dateStr) {
  if (isToday(dateStr)) return 'Hoje'
  if (isTomorrow(dateStr)) return 'Amanhã'
  return null
}

export default function UpcomingList({ cards }) {
  if (!cards?.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="text-3xl mb-2">📅</div>
        <p className="text-sm text-slate-400">Nenhum atendimento futuro encontrado</p>
      </div>
    )
  }

  // Agrupa por data para exibir separadores visuais
  const groups = cards.slice(0, 60).reduce((acc, card) => {
    const key = card.date ?? 'sem-data'
    if (!acc[key]) acc[key] = []
    acc[key].push(card)
    return acc
  }, {})

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          Próximos Atendimentos
        </h3>
        <span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full">
          {cards.length} agendado{cards.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div>
        {Object.entries(groups).map(([date, group]) => (
          <div key={date}>
            {/* Separador de data */}
            <div className="px-6 py-2 bg-slate-50 border-y border-slate-100 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">
                {fmtDate(date)}
              </span>
              {getDayLabel(date) && (
                <span className="text-xs bg-indigo-100 text-indigo-700 font-medium px-2 py-0.5 rounded-full">
                  {getDayLabel(date)}
                </span>
              )}
            </div>

            {/* Cards do dia */}
            {group.map(card => (
              <div
                key={card.id}
                className="px-6 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
              >
                <div className="text-center min-w-[44px]">
                  <div className="text-sm font-bold text-slate-800 tabular-nums leading-none">
                    {card.time ?? '--:--'}
                  </div>
                </div>

                <div className="w-px h-7 bg-slate-100 shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">
                    {card.title ?? 'Sem nome'}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{card.stepLabel}</div>
                </div>

                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{
                    backgroundColor: card.stepColor + '1A',
                    color: card.stepColor,
                  }}
                >
                  {card.stepKey === 'reagendou' ? 'Reagendado' : 'Agendado'}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {cards.length > 60 && (
        <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400 text-center">
          Exibindo os 60 primeiros de {cards.length}
        </div>
      )}
    </div>
  )
}
