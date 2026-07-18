// Testes das réguas de métrica — cada bloco protege uma REGRA DE NEGÓCIO
// validada com o usuário (commits citados). Se um teste daqui quebrar,
// ou a mudança está errada ou a regra mudou de verdade — nesse caso,
// atualizar REGRAS_DASHBOARD.md no MESMO PR.
import { describe, it, expect } from 'vitest'
import {
  effectiveDate, inPeriod, createdInPeriod, scheduledInPeriod, agendouCardsOf,
  computeKpis, computeFunnel, campaignBreakdown, funnelOf, DEFAULT_FUNNEL_CFG,
} from './parseCards.js'

const card = (over = {}) => ({
  stepType: 'scheduled',
  date: null, scheduledAt: null, eventDate: null,
  createdAt: '2026-06-01T10:00:00Z', updatedAt: '2026-07-10T10:00:00Z',
  dims: {},
  ...over,
})

describe('effectiveDate — regra estrita (commit 79fa6d1, "regra é regra")', () => {
  it('etapa de desfecho SEM "Agendado Para" fica sem data efetiva (fora do período)', () => {
    const c = card({ stepType: 'attended', date: null })
    expect(effectiveDate(c)).toBeNull()
    expect(inPeriod(c, '2026-07-01', '2026-07-31')).toBe(false)
  })

  it('NUNCA usa updatedAt — editar o card não pode mudar o mês (commit f71f340)', () => {
    // Cenário Paulo Martins: consulta em junho, card editado em julho
    const c = card({ stepType: 'converted', date: '2026-06-15', updatedAt: '2026-07-17T09:00:00Z' })
    expect(effectiveDate(c)).toBe('2026-06-15')
    expect(inPeriod(c, '2026-06-01', '2026-06-30')).toBe(true)
    expect(inPeriod(c, '2026-07-01', '2026-07-31')).toBe(false)
  })

  it('lead e notScheduled contam pela CRIAÇÃO (estado natural sem data)', () => {
    expect(effectiveDate(card({ stepType: 'lead', createdAt: '2026-07-05T00:00:00Z' }))).toBe('2026-07-05')
    expect(effectiveDate(card({ stepType: 'notScheduled', createdAt: '2026-07-06T00:00:00Z' }))).toBe('2026-07-06')
  })

  it('eventDate do sync Clinicorp ganha de tudo (fato retroativo no mês certo)', () => {
    const c = card({ stepType: 'missed', date: '2026-06-20', eventDate: '2026-06-18' })
    expect(effectiveDate(c)).toBe('2026-06-18')
  })
})

describe('createdInPeriod — topo do funil', () => {
  it('card criado retroativamente pelo sync usa a MENOR data (evento < criação)', () => {
    const c = card({ createdAt: '2026-07-10T00:00:00Z', eventDate: '2026-06-20' })
    expect(createdInPeriod(c, '2026-06-01', '2026-06-30')).toBe(true)
    expect(createdInPeriod(c, '2026-07-01', '2026-07-31')).toBe(false)
  })
})

describe('Agendaram — estrito POR CLÍNICA (commit 79fa6d1)', () => {
  it('clínica COM "Agendado em": só conta card com o campo preenchido', () => {
    const cards = [
      card({ scheduledAt: '2026-07-03', date: '2026-07-15' }),
      card({ stepType: 'converted', scheduledAt: null, date: '2026-07-10' }),
    ]
    expect(agendouCardsOf(cards, '2026-07-01', '2026-07-31')).toHaveLength(1)
  })

  it('clínica SEM o campo em nenhum card (ex: IBS legada): cai na data efetiva, barra não zera', () => {
    const cards = [
      card({ scheduledAt: null, date: '2026-07-15' }),
      card({ stepType: 'converted', scheduledAt: null, date: '2026-07-10' }),
    ]
    expect(agendouCardsOf(cards, '2026-07-01', '2026-07-31')).toHaveLength(2)
  })

  it('scheduledInPeriod é estrito: sem o campo, não conta (sem fallback por card)', () => {
    expect(scheduledInPeriod(card({ scheduledAt: null, date: '2026-07-10' }), '2026-07-01', '2026-07-31')).toBe(false)
  })
})

describe('Conversão = Fecharam ÷ COMPARECERAM (commit ebff502 — em aberto FICA no denominador)', () => {
  it('28 de 81 que compareceram = 34,6% (exemplo numérico do usuário)', () => {
    const cards = [
      ...Array.from({ length: 28 }, () => card({ stepType: 'converted', date: '2026-07-10' })),
      ...Array.from({ length: 40 }, () => card({ stepType: 'attended', date: '2026-07-10' })),
      ...Array.from({ length: 13 }, () => card({ stepType: 'negotiating', date: '2026-07-10' })),
    ]
    const k = computeKpis(cards, '2026-07-01', '2026-07-31')
    expect(k.attended).toBe(81)
    expect(k.conversionRate).toBeCloseTo((28 / 81) * 100, 5)
  })

  it('noDate só acusa card que JÁ passou de lead', () => {
    const cards = [
      card({ stepType: 'lead', date: null }),          // natural — não acusa
      card({ stepType: 'notScheduled', date: null }),  // natural — não acusa
      card({ stepType: 'attended', date: '2026-07-10' }),
      card({ stepType: 'attended', date: null }),      // este sim
    ]
    expect(computeKpis(cards, '2026-07-01', '2026-07-31').noDate).toBe(1)
  })
})

describe('Funil fecha: Agendados ⊇ Compareceram ⊇ Fecharam', () => {
  it('estágio "agendou" default soma TODOS os desfechos', () => {
    expect(DEFAULT_FUNNEL_CFG.stages.agendou).toEqual(
      expect.arrayContaining(['scheduled', 'rescheduled', 'attended', 'negotiating', 'converted', 'missed', 'cancelled'])
    )
  })

  it('campaignBreakdown: card marcado antes do período mas com consulta dentro conta em TODAS as colunas (commit 185f291 — cenário 0/1/1 → 1/1/1)', () => {
    const c = card({
      stepType: 'converted', value: 4000,
      date: '2026-06-20', scheduledAt: '2026-05-10',
      createdAt: '2026-06-15T00:00:00Z',
      dims: { campanha: null },
    })
    const rows = campaignBreakdown([c], 'campanha', [], '2026-06-01', '2026-06-30', null)
    const sem = rows.find(r => r.value === null)
    expect(sem.funnel.agendou).toBe(1)
    expect(sem.funnel.compareceu).toBe(1)
    expect(sem.funnel.fechou).toBe(1)
  })

  it('invariante em conjunto misto: agendou >= compareceu >= fechou', () => {
    const cards = [
      card({ stepType: 'scheduled', date: '2026-07-05' }),
      card({ stepType: 'missed', date: '2026-07-06' }),
      card({ stepType: 'attended', date: '2026-07-07' }),
      card({ stepType: 'negotiating', date: '2026-07-08' }),
      card({ stepType: 'converted', date: '2026-07-09' }),
      card({ stepType: 'cancelled', date: '2026-07-10' }),
    ]
    const f = funnelOf(cards, null)
    expect(f.agendou).toBeGreaterThanOrEqual(f.compareceu)
    expect(f.compareceu).toBeGreaterThanOrEqual(f.fechou)
    expect(f.taxaFechamento).toBeCloseTo((1 / 3) * 100, 5) // 1 fechou ÷ 3 compareceram
  })
})

describe('computeFunnel — coortes distintas de propósito', () => {
  it('"entrou" conta por criação; card sem data fica fora dos estágios', () => {
    const cards = [
      card({ stepType: 'lead', createdAt: '2026-07-05T00:00:00Z' }),
      card({ stepType: 'scheduled', date: '2026-07-15', scheduledAt: '2026-07-03', createdAt: '2026-07-01T00:00:00Z' }),
      card({ stepType: 'attended', date: null, createdAt: '2026-06-01T00:00:00Z' }), // sem data → fora
    ]
    const f = computeFunnel(cards, '2026-07-01', '2026-07-31', null)
    expect(f.entrou).toBe(2)      // lead + scheduled criados em julho
    expect(f.agendou).toBe(1)     // só o scheduled (estrito por scheduledAt)
    expect(f.compareceu).toBe(0)  // attended sem data não computa
  })
})
