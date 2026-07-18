// Testes do mapeamento card Helena → linha da tabela `cards` (FASE A2).
import { describe, it, expect } from 'vitest'
import { mapCardRow } from './cardsIngest.js'

const ctx = {
  accountId: 'acc-1',
  stepLookup: {
    'step-lead': { type: 'lead' },
    'step-fechou': { type: 'converted' },
    'step-agendado': { type: 'scheduled' },
  },
  extractCfg: {
    date: [{ from: 'customFields.agendado-para', format: 'YMD' }],
    scheduledAt: [{ from: 'customFields.agendado-em-', format: 'YMD' }],
    name: [{ from: 'contactName' }],
    phone: [{ from: 'contactPhone' }],
    time: [{ from: 'customFields.agendado-para', regex: '(\\d{1,2}:\\d{2})' }],
  },
  dimsCfg: { campanha: { label: 'Campanha', source: 'customFields.campanha' } },
  now: new Date('2026-07-18T12:00:00Z'),
}

const helenaCard = (over = {}) => ({
  id: 'card-1', stepId: 'step-agendado',
  title: 'Maria', createdAt: '2026-07-01T10:00:00Z', updatedAt: '2026-07-10T10:00:00Z',
  monetaryAmount: 2500,
  customFields: { 'agendado-para': '2026-07-20T14:30:00.0000000', 'agendado-em-': '2026/07/03', campanha: 'CONVERSE CONOSCO' },
  contacts: [{ name: 'Maria da Silva' }],
  metadata: { clinicorp_event_date: null },
  ...over,
})

describe('mapCardRow', () => {
  it('extrai datas, dims e resolve stepType pelo mapeamento do setup', () => {
    const row = mapCardRow(helenaCard(), ctx)
    expect(row.account_id).toBe('acc-1')
    expect(row.card_id).toBe('card-1')
    expect(row.step_type).toBe('scheduled')
    expect(row.date).toBe('2026-07-20')
    expect(row.scheduled_at).toBe('2026-07-03')
    expect(row.time).toBe('14:30')
    expect(row.name).toBe('Maria da Silva')
    expect(row.value).toBe(2500)
    expect(row.dims).toEqual({ campanha: 'CONVERSE CONOSCO' })
    expect(row.raw.id).toBe('card-1')     // card cru preservado para reprocesso
  })

  it('step não mapeado → step_type null (aparece no diagnóstico, não some)', () => {
    const row = mapCardRow(helenaCard({ stepId: 'step-desconhecido' }), ctx)
    expect(row.step_type).toBeNull()
    expect(row.frozen).toBe(false)        // sem tipo, nunca congela
  })

  it('frozen: terminal parado há 30d+ congela; recente ou ativo não', () => {
    // converted parado desde maio (>30d antes de now=18/07) → congela
    expect(mapCardRow(helenaCard({ stepId: 'step-fechou', updatedAt: '2026-05-01T00:00:00Z' }), ctx).frozen).toBe(true)
    // converted mexido há 8 dias → ainda não
    expect(mapCardRow(helenaCard({ stepId: 'step-fechou', updatedAt: '2026-07-10T00:00:00Z' }), ctx).frozen).toBe(false)
    // etapa ativa antiga → nunca congela
    expect(mapCardRow(helenaCard({ stepId: 'step-agendado', updatedAt: '2026-01-01T00:00:00Z' }), ctx).frozen).toBe(false)
  })

  it('sem _extract configurado → campos extraídos nulos, card ainda entra', () => {
    const row = mapCardRow(helenaCard(), { ...ctx, extractCfg: null, dimsCfg: null })
    expect(row.date).toBeNull()
    expect(row.scheduled_at).toBeNull()
    expect(row.dims).toEqual({})
    expect(row.card_id).toBe('card-1')
  })
})
