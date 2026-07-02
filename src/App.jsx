import { Fragment, useState, useEffect, useMemo } from 'react'
import { fetchDashboard } from './api'
import {
  computeKpis, computePreviousKpis, computeRevenue, computePreviousRevenue, delta,
  getLost, getNegotiating, getUpcoming, computeFunnel, breakdownByDimension,
  revenueByDimension,
} from './utils/parseCards'
import { groupCardsByTime, getGranularity } from './utils/groupByTime'
import { todayBR, daysAgoBR } from './utils/dates'
import DateRangePicker  from './components/DateRangePicker.jsx'
import HeroStrip       from './components/HeroStrip.jsx'
import KpiStrip        from './components/KpiStrip.jsx'
import RevenueRow      from './components/RevenueRow.jsx'
import TrendChart      from './components/TrendChart.jsx'
import LostTable       from './components/LostTable.jsx'
import BudgetTable     from './components/BudgetTable.jsx'
import StepDistribution from './components/StepDistribution.jsx'
import UpcomingTable   from './components/UpcomingTable.jsx'
import FunnelChart     from './components/FunnelChart.jsx'
import ContractsCard   from './components/ContractsCard.jsx'
import DimensionBreakdown from './components/DimensionBreakdown.jsx'
import RevenueDonut     from './components/RevenueDonut.jsx'
import NotConfigured   from './components/NotConfigured.jsx'

const todayStr = todayBR
const daysAgo  = daysAgoBR

const QUICK = [
  { label: '7d',   days: 7 },
  { label: '30d',  days: 30 },
  { label: '90d',  days: 90 },
  { label: '180d', days: 180 },
]

// SVG tooth logo (inline, no deps)
const ToothIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path
      d="M7 3c-2.2 0-3.5 1.8-3.5 4 0 1.7.5 3 .9 4.5.3 1.2.4 2.3.5 3.5.2 2.1.3 4 1.6 5.5.6.7 1.5 1.2 2.3.5.7-.6.7-1.8.8-2.9.1-1.3.4-2.7 1.4-2.7s1.3 1.4 1.4 2.7c.1 1.1.1 2.3.8 2.9.8.7 1.7.2 2.3-.5 1.3-1.5 1.4-3.4 1.6-5.5.1-1.2.2-2.3.5-3.5.4-1.5.9-2.8.9-4.5 0-2.2-1.3-4-3.5-4-1.6 0-2.6.9-3.5 1.5-.4.3-.7.5-1 .5s-.6-.2-1-.5C9.6 3.9 8.6 3 7 3z"
      stroke="white" strokeWidth="1.5" fill="white" fillOpacity="0.2"
    />
  </svg>
)

const RefreshIcon = ({ spin }) => (
  <svg className={`w-3.5 h-3.5 ${spin ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
)

export default function App() {
  const params     = new URLSearchParams(window.location.search)
  const clinicSlug = params.get('clinic') ?? params.get('accountId')

  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [notFound,  setNotFound]  = useState(false)
  const [dateFrom,  setDateFrom]  = useState(daysAgo(30))
  const [dateTo,    setDateTo]    = useState(todayStr())
  const [ticket,    setTicket]    = useState(10000)
  const [lastFetch, setLastFetch] = useState(null)
  const [unit,      setUnit]      = useState(null)  // unidade selecionada (null = todas)

  const today = todayStr()

  // Dimensão marcada como unidade (isUnit) — vira filtro global do dashboard
  const unitDim = useMemo(() => {
    const found = Object.entries(data?.dimensions ?? {}).find(([, d]) => d.isUnit)
    return found ? { key: found[0], ...found[1] } : null
  }, [data])

  // Cards do escopo atual: todos, ou só os da unidade selecionada
  const cards = useMemo(() => {
    const all = data?.cards ?? []
    if (!unit || !unitDim) return all
    return all.filter(c => (c.dims?.[unitDim.key] ?? null) === unit)
  }, [data, unit, unitDim])

  const load = () => {
    if (!clinicSlug) return
    setLoading(true); setError(null); setNotFound(false)
    fetchDashboard(clinicSlug)
      .then(d => {
        setData(d)
        setTicket(d.ticket ?? 10000)
        setLastFetch(new Date())
      })
      .catch(err => {
        if (err.status === 404) setNotFound(true)
        else setError(err.message)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [clinicSlug])
  useEffect(() => setUnit(null), [clinicSlug])  // troca de clínica zera o filtro de unidade

  // ── Derived state (all client-side, no re-fetch on date change) ────────────
  // Todas as derivações usam `cards` (já escopado pela unidade selecionada).
  const kpis = useMemo(
    () => computeKpis(cards, dateFrom, dateTo),
    [cards, dateFrom, dateTo],
  )
  const prevKpis = useMemo(
    () => computePreviousKpis(cards, dateFrom, dateTo),
    [cards, dateFrom, dateTo],
  )
  const deltas = useMemo(() => {
    if (!kpis || !prevKpis) return {}
    return {
      total:          delta(kpis.total,          prevKpis.total),
      attendanceRate: delta(kpis.attendanceRate,  prevKpis.attendanceRate),
      conversionRate: delta(kpis.conversionRate,  prevKpis.conversionRate),
      missRate:       delta(kpis.missRate,        prevKpis.missRate),
      cancelled:      delta(kpis.cancelled,       prevKpis.cancelled),
    }
  }, [kpis, prevKpis])

  const revenue = useMemo(
    () => computeRevenue(cards, dateFrom, dateTo, ticket, today),
    [cards, dateFrom, dateTo, ticket, today],
  )
  const prevRevenue = useMemo(
    () => computePreviousRevenue(cards, dateFrom, dateTo, ticket, today),
    [cards, dateFrom, dateTo, ticket, today],
  )
  const revenueDelta = useMemo(
    () => delta(revenue?.fechada, prevRevenue?.fechada),
    [revenue, prevRevenue],
  )
  const lostDelta = useMemo(
    () => delta(revenue?.perdidaNaoFechou, prevRevenue?.perdidaNaoFechou),
    [revenue, prevRevenue],
  )

  // Rótulo EXATO dos steps da clínica por tipo de métrica (ex: cancelled →
  // "DESMARCOU" na Lumine) — o dashboard fala o vocabulário do painel dela.
  const typeLabels = useMemo(() => {
    const by = {}
    for (const s of Object.values(data?.steps ?? {})) {
      if (s?.type && s?.label) (by[s.type] ??= []).push(s.label)
    }
    return Object.fromEntries(Object.entries(by).map(([t, ls]) => [t, ls.join(' / ')]))
  }, [data])

  const { data: chartData, granularity } = useMemo(
    () => data ? groupCardsByTime(cards, dateFrom, dateTo, data.steps) : { data: [], granularity: 'day' },
    [data, cards, dateFrom, dateTo],
  )

  const lost       = useMemo(() => getLost(cards, dateFrom, dateTo), [cards, dateFrom, dateTo])
  const negotiating = useMemo(() => getNegotiating(cards, dateFrom, dateTo), [cards, dateFrom, dateTo])
  const upcoming   = useMemo(() => getUpcoming(cards, today), [cards, today])

  const funnel = useMemo(
    () => computeFunnel(cards, dateFrom, dateTo, data?.funnelConfig),
    [cards, dateFrom, dateTo, data],
  )
  // Quebras do funil por cada dimensão configurada (origem, agendador, …).
  // Ao filtrar por uma unidade, a própria dimensão-unidade some (seria 1 só valor).
  const breakdowns = useMemo(() => {
    const dims = data?.dimensions ?? {}
    return Object.entries(dims)
      .filter(([key]) => !(unit && key === unitDim?.key))
      .map(([key, def]) => ({
        key,
        label: def.label,
        rows: breakdownByDimension(cards, key, def.values, dateFrom, dateTo, data?.funnelConfig),
      })).filter(b => b.rows.length > 0)
  }, [data, cards, unit, unitDim, dateFrom, dateTo])
  // Receita fechada (R$) por dimensão — base das roscas
  const revenueBreakdowns = useMemo(() => {
    const dims = data?.dimensions ?? {}
    return Object.fromEntries(
      Object.entries(dims).map(([key, def]) => [
        key,
        revenueByDimension(cards, key, def.values, dateFrom, dateTo),
      ])
    )
  }, [data, cards, dateFrom, dateTo])

  const applyRange = (days) => { setDateFrom(daysAgo(days)); setDateTo(todayStr()) }
  const isRange = (days) => dateFrom === daysAgo(days) && dateTo === todayStr()

  // ── Sem slug ou clínica não cadastrada → tela "contate o administrador" ──────
  if (!clinicSlug || notFound) {
    return <NotConfigured slug={clinicSlug} />
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-red-500 flex items-center justify-center">
              <ToothIcon />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 leading-tight">
                {data?.clinic
                  ? <>{data.clinic} <span className="text-slate-400 font-normal text-sm">· Dashboard</span></>
                  : <span className="text-slate-300 font-normal">Carregando...</span>
                }
              </div>
              {lastFetch && (
                <div className="text-[10px] text-slate-400">
                  {(() => {
                    const d = Math.round((new Date(dateTo) - new Date(dateFrom)) / 86_400_000)
                    return d === 0 ? '1 dia' : `Últimos ${d} dias`
                  })()}
                  · {dateFrom.split('-').reverse().join('/')} — {dateTo.split('-').reverse().join('/')}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* Filtro de unidade — só quando há dimensão-unidade com 2+ valores */}
            {unitDim && unitDim.values?.length > 1 && (
              <>
                <select
                  value={unit ?? ''}
                  onChange={e => setUnit(e.target.value || null)}
                  title={unitDim.label}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:border-slate-400 cursor-pointer max-w-[170px]"
                >
                  <option value="">Todas as unidades</option>
                  {unitDim.values.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <div className="w-px h-4 bg-slate-200 mx-1 hidden sm:block" />
              </>
            )}
            {QUICK.map(r => (
              <button
                key={r.label}
                onClick={() => applyRange(r.days)}
                className={`text-xs px-2.5 py-1.5 rounded-md font-mono font-medium transition-colors border ${
                  isRange(r.days)
                    ? 'border-purple-600 bg-gradient-to-r from-purple-600 to-red-500 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            ))}

            <div className="w-px h-4 bg-slate-200 mx-1 hidden sm:block" />

            <DateRangePicker
              from={dateFrom}
              to={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
            />

            <button
              onClick={load} disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              title="Atualizar dados"
            >
              <RefreshIcon spin={loading} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-5 mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex gap-2">
          <span>⚠</span><span>{error}</span>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && !data && (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">Carregando dados da clínica...</p>
          </div>
        </div>
      )}

      {/* ── Aviso de cards não mapeados (drift de steps) ──────────────────── */}
      {data?.diagnostics?.unmappedCount > 0 && (
        <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex gap-2">
          <span>⚠</span>
          <span>
            {data.diagnostics.unmappedCount} card(s) estão em etapas não mapeadas e ficam fora das métricas
            {data.diagnostics.unmapped?.length > 0 && (
              <>: {data.diagnostics.unmapped.map(u => `${u.label ?? u.stepId} (${u.count})`).join(', ')}</>
            )}. Ajuste o mapeamento em <code className="font-mono">/setup</code>.
          </span>
        </div>
      )}

      {/* ── Aviso de datas não extraídas — sem isso o filtro de período vira loteria ── */}
      {data?.diagnostics?.noDate > 0 && (
        <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex gap-2">
          <span>⚠</span>
          <span>
            {data.diagnostics.noDate} de {data.diagnostics.total} card(s) não têm data de agendamento extraída —
            esses caem no filtro de período pela última movimentação no CRM, não pela data real do atendimento.
            Ajuste a extração em <code className="font-mono">/setup</code>.
          </span>
        </div>
      )}

      {data && (
        <>
          {/* ── 1. Faixa-herói: os 4 números que importam ────────────────── */}
          <HeroStrip revenue={revenue} kpis={kpis} deltas={deltas} revenueDelta={revenueDelta} lostDelta={lostDelta} />

          {/* ── 2. KPIs secundários (saúde operacional) ──────────────────── */}
          <KpiStrip
            kpis={kpis}
            prevKpis={prevKpis}
            delta={deltas}
            chartData={{ data: chartData }}
            ticket={ticket}
            onTicketChange={setTicket}
          />

          {/* ── 3. Funil (herói visual) + quebras por dimensão ───────────────
               Masonry via CSS columns: os cards fluem preenchendo as colunas
               por altura — sem "buraco" à esquerda quando a direita é longa. */}
          <div className="p-5 pb-0 border-b border-slate-200 columns-1 lg:columns-2 gap-5">
            <div className="break-inside-avoid mb-5">
              <FunnelChart funnel={funnel} revenue={revenue} typeLabels={typeLabels} />
            </div>
            {funnel && (funnel.attended + funnel.negotiating + funnel.converted) > 0 && (
              <div className="break-inside-avoid mb-5">
                <ContractsCard funnel={funnel} revenue={revenue} />
              </div>
            )}
            {breakdowns.length > 0 ? (
              breakdowns.map(b => (
                <Fragment key={b.key}>
                  {revenueBreakdowns[b.key]?.length > 0 && (
                    <div className="break-inside-avoid mb-5">
                      <RevenueDonut title={b.label} rows={revenueBreakdowns[b.key]} />
                    </div>
                  )}
                  <div className="break-inside-avoid mb-5">
                    <DimensionBreakdown title={b.label} rows={b.rows} typeLabels={typeLabels} />
                  </div>
                </Fragment>
              ))
            ) : (
              <div className="break-inside-avoid mb-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-center">
                <p className="text-sm text-slate-400 text-center max-w-xs">
                  {Object.keys(data?.dimensions ?? {}).length === 0
                    ? <>Esta clínica não tem dimensões configuradas (ex: origem, agendador). Configure as tags de card em <code className="font-mono">/setup</code>.</>
                    : <>Nenhum card com dimensão preenchida nesse período — tente outra data ou confira as etiquetas em <code className="font-mono">/setup</code>.</>}
                </p>
              </div>
            )}
          </div>

          {/* ── 4. Receita (detalhe) + cards sem valor por etapa ─────────── */}
          <RevenueRow revenue={revenue} kpis={kpis} />

          {/* ── 5. Tendência no tempo + distribuição por etapa ───────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] border-b border-slate-200">
            <div className="p-5 border-b lg:border-b-0 lg:border-r border-slate-200">
              <TrendChart data={chartData} granularity={granularity} />
            </div>
            <div className="p-5">
              <StepDistribution
                cards={cards}
                steps={data.steps}
                from={dateFrom}
                to={dateTo}
              />
            </div>
          </div>

          {/* ── 6. Acionáveis: próximos, a fechar, recuperáveis ──────────── */}
          <div className="p-5 border-b border-slate-200">
            <UpcomingTable cards={upcoming} ticket={ticket} />
          </div>
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <LostTable cards={lost} ticket={ticket} />
            <BudgetTable cards={negotiating} ticket={ticket} />
          </div>

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div className="px-5 py-3 border-t border-slate-200 bg-white flex justify-between text-[11px] text-slate-400">
            <span>
              {lastFetch
                ? `Atualizado às ${lastFetch.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${cards.length} cards${unit ? ` · ${unit}` : ''}`
                : 'Carregando...'}
            </span>
            <span>{data?.clinic} Performance v2</span>
          </div>
        </>
      )}
    </div>
  )
}
