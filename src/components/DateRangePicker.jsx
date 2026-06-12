import { useState, useRef, useEffect } from 'react'
import {
  format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isWithinInterval,
  isAfter, isBefore, isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

const WEEK_DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

function buildGrid(month) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const end   = endOfWeek(endOfMonth(month),     { weekStartsOn: 1 })
  const days  = []
  let d = start
  while (!isAfter(d, end)) { days.push(d); d = addDays(d, 1) }
  return days
}

function CalIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8"  y1="2" x2="8"  y2="6" />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  )
}

export default function DateRangePicker({ from, to, onFromChange, onToChange }) {
  const [open,    setOpen]    = useState(false)
  const [month,   setMonth]   = useState(() => from ? startOfMonth(parseISO(from)) : startOfMonth(new Date()))
  const [hovered, setHovered] = useState(null)

  // Seleção local — só vai para o pai ao clicar Aplicar
  const [draft, setDraft] = useState({ from: null, to: null })
  // true = aguardando segundo clique
  const [picking, setPicking] = useState(false)

  const ref = useRef(null)

  // Ao abrir, inicializa o draft com o valor atual das props
  function openCalendar() {
    setDraft({ from: from ? parseISO(from) : null, to: to ? parseISO(to) : null })
    setPicking(false)
    setHovered(null)
    setOpen(true)
  }

  function closeAndDiscard() {
    setOpen(false)
    setPicking(false)
    setDraft({ from: null, to: null })
    setHovered(null)
  }

  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) closeAndDiscard()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function handleDay(day) {
    const today = new Date(); today.setHours(23, 59, 59)
    if (isAfter(day, today)) return

    if (!picking) {
      // Primeiro clique — define início, aguarda fim
      setDraft({ from: day, to: null })
      setPicking(true)
    } else {
      // Segundo clique — define fim (inverte se necessário)
      const start = draft.from
      if (isBefore(day, start)) {
        setDraft({ from: day, to: start })
      } else {
        setDraft({ from: start, to: day })
      }
      setPicking(false)
      setHovered(null)
    }
  }

  function handleApply() {
    if (draft.from) onFromChange(format(draft.from, 'yyyy-MM-dd'))
    if (draft.to)   onToChange(format(draft.to,   'yyyy-MM-dd'))
    setOpen(false)
    setPicking(false)
  }

  function getDayState(day) {
    const today = new Date(); today.setHours(23, 59, 59)
    const disabled = isAfter(day, today)
    const outside  = !isSameMonth(day, month)

    const effectiveFrom = draft.from
    const effectiveTo   = picking ? hovered : draft.to

    const isStart    = effectiveFrom && isSameDay(day, effectiveFrom)
    const isEnd      = effectiveTo   && isSameDay(day, effectiveTo)
    const isSelected = isStart || isEnd

    const inRange = effectiveFrom && effectiveTo
      && !isSameDay(effectiveFrom, effectiveTo)
      && isWithinInterval(day, {
        start: isBefore(effectiveFrom, effectiveTo) ? effectiveFrom : effectiveTo,
        end:   isBefore(effectiveFrom, effectiveTo) ? effectiveTo   : effectiveFrom,
      })
      && !isSelected

    return { disabled, outside, isStart, isEnd, isSelected, inRange }
  }

  // Label no botão trigger — mostra valores confirmados (props)
  const fromDate = from ? parseISO(from) : null
  const toDate   = to   ? parseISO(to)   : null
  const label = fromDate && toDate && !isSameDay(fromDate, toDate)
    ? `${format(fromDate, 'dd/MM/yy')} → ${format(toDate, 'dd/MM/yy')}`
    : fromDate ? format(fromDate, 'dd/MM/yy') : 'Selecionar período'

  // Label no footer do calendário — mostra o draft em andamento
  const draftLabel = draft.from && draft.to && !isSameDay(draft.from, draft.to)
    ? `${format(draft.from, 'dd/MM/yy')} → ${format(draft.to, 'dd/MM/yy')}`
    : draft.from
    ? `${format(draft.from, 'dd/MM/yy')} → ?`
    : 'Selecione o início'

  const canApply = draft.from && draft.to && !isSameDay(draft.from, draft.to)

  const grid = buildGrid(month)

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => open ? closeAndDiscard() : openCalendar()}
        className="flex items-center gap-2 text-xs border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700 hover:bg-slate-50 transition-colors font-mono"
      >
        <CalIcon />
        {label}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 select-none"
          style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.45))' }}>
          <div className="rounded-2xl overflow-hidden bg-white border border-slate-200" style={{ width: 300 }}>
            {/* Top accent bar */}
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #7c3aed, #ef4444)' }} />

            {/* Month nav */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <button
                onClick={() => setMonth(m => subMonths(m, 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <span className="text-sm font-semibold text-slate-800 capitalize">
                {format(month, 'MMMM yyyy', { locale: ptBR })}
              </span>

              <button
                onClick={() => setMonth(m => addMonths(m, 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Week headers */}
            <div className="grid grid-cols-7 px-3 mb-1">
              {WEEK_DAYS.map(d => (
                <div key={d} className="text-center text-[9px] font-bold tracking-widest text-slate-400">
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 px-3 pb-3">
              {grid.map((day, i) => {
                const { disabled, outside, isStart, isEnd, isSelected, inRange } = getDayState(day)
                const todayDay = isToday(day)
                const isSingleDay = draft.from && draft.to && isSameDay(draft.from, draft.to)

                const bandRadius = isSingleDay && isSelected
                  ? '50%'
                  : isStart ? '50% 0 0 50%'
                  : isEnd   ? '0 50% 50% 0'
                  : '0'

                const textColor = isSelected
                  ? '#fff'
                  : inRange
                  ? '#6d28d9'
                  : outside || disabled
                  ? '#cbd5e1'
                  : todayDay ? '#7c3aed' : '#1e293b'

                return (
                  <div key={i} style={{
                    height: 34,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: inRange ? '#ede9fe' : 'transparent',
                    borderRadius: bandRadius,
                  }}>
                    <button
                      onMouseEnter={() => picking && !disabled && setHovered(day)}
                      onMouseLeave={() => picking && setHovered(null)}
                      onClick={() => !disabled && handleDay(day)}
                      style={{
                        width: 32, height: 32,
                        borderRadius: '50%',
                        background: isSelected
                          ? 'linear-gradient(135deg, #7c3aed, #ef4444)'
                          : 'transparent',
                        color: textColor,
                        fontWeight: isSelected || inRange || todayDay ? '600' : '400',
                        fontSize: 12,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        transition: 'background 0.1s',
                        border: todayDay && !isSelected ? '1.5px solid #c4b5fd' : '1.5px solid transparent',
                        flexShrink: 0,
                      }}
                      onMouseOver={e => {
                        if (!isSelected && !disabled && !outside)
                          e.currentTarget.style.background = 'rgba(124,58,237,0.12)'
                      }}
                      onMouseOut={e => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {format(day, 'd')}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-4 pb-4 pt-3 flex items-center justify-between border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-mono">
                {draftLabel}
              </span>
              <button
                onClick={handleApply}
                disabled={!canApply}
                className="text-[11px] px-4 py-1.5 rounded-lg font-semibold text-white transition-opacity"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #ef4444)',
                  opacity: canApply ? 1 : 0.3,
                  cursor: canApply ? 'pointer' : 'not-allowed',
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
