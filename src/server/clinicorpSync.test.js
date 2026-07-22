// Testes do motor de sync Clinicorp — protegem a correção de 20/07: o
// fechamento do orçamento (e.Date/LastChange_Date) NUNCA mais reescreve
// "Agendado Para" (a consulta real). As 3 datas (Agendado em/Agendado Para/
// Fechado em) são independentes; um orçamento pode fechar meses depois da
// consulta (visto na prática: agendado 28/05, consulta 03/06, fechou 20/07).
//
// Estratégia: mocka fetch (Helena + Clinicorp) e roda em modo DRY_RUN — o
// motor monta o PUT/POST mas não escreve; inspecionamos summary.moves[].dryBody.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { syncClinicClinicorp } from './clinicorpSync.js'

const PANEL_ID = 'panel-1'
const clinic = (overrides = {}) => ({
  accountId: 'acc-1', name: 'Clínica Teste', panelId: PANEL_ID, token: 'tok',
  steps: {
    agendado: { id: 'step-agendado', label: 'Agendado', type: 'scheduled', color: null },
    fechou:   { id: 'step-fechou',   label: 'Fechou',    type: 'converted', color: null },
    _dates: { scheduledFor: { key: 'agendado-para' }, createdAt: { key: 'agendado-em' }, closedAt: { key: 'fechado-em' } },
    _clinicorp: { units: [{ label: 'Matriz', tagId: null, user: 'u1', token: 't1', syncSince: '2025-01-01' }] },
    ...overrides.stepsExtra,
  },
  ...overrides,
})

// Card já em "Agendado" com data de consulta em 2026-06-03, patientId vinculado.
const CARD_AGENDADO = {
  id: 'card-1', stepId: 'step-agendado', title: 'Paciente X', tagIds: [], monetaryAmount: null,
  metadata: { clinicorp_patient_id: '999' },
  customFields: { 'agendado-para': ['2026-06-03T10:00:00.0000000'], 'agendado-em': ['2026-05-28'] },
}

function mockFetchSequence({ appointments = [], estimates = [], statusList = [] } = {}) {
  return vi.fn(async (url) => {
    const u = String(url)
    const json = (body) => ({ ok: true, text: async () => JSON.stringify(body) })
    if (u.includes('/crm/v1/panel/panel-1?')) {
      return json({ id: PANEL_ID, steps: [{ id: 'step-agendado', title: 'Agendado' }, { id: 'step-fechou', title: 'Fechou' }], tags: [] })
    }
    if (u.includes('/crm/v1/panel/card?PanelId=')) {
      return json({ items: [CARD_AGENDADO], hasMorePages: false })
    }
    if (u.includes('/crm/v1/panel/card/card-1')) {
      return json(CARD_AGENDADO)
    }
    if (u.includes('/appointment/status_list')) return json({ list: statusList })
    if (u.includes('/appointment/list')) return json(appointments)
    if (u.includes('/estimates/list')) return json(estimates)
    if (u.includes('/core/v1/contact/')) return json({ id: 'contact-1', phoneNumber: '5562999999999' })
    return json({})
  })
}

beforeEach(() => {
  process.env.CLINICORP_SYNC_DRY_RUN = '1'
})
afterEach(() => {
  delete process.env.CLINICORP_SYNC_DRY_RUN
  vi.unstubAllGlobals()
})

describe('syncClinicClinicorp — regra das 3 datas independentes (20/07)', () => {
  it('orçamento aprovado NÃO reescreve "Agendado Para" — só grava "Fechado em"', async () => {
    // Orçamento criado em dezembro, aprovado (Date/LastChange) só em julho —
    // cenário real observado na IBS (gap de 204 dias).
    const estimates = [{
      PatientId: '999', PatientName: 'Paciente X', PatientMobilePhone: '5562999999999',
      Status: 'APPROVED', Amount: 5000, Date: '2026-07-20T14:00:00.000Z',
    }]
    vi.stubGlobal('fetch', mockFetchSequence({ estimates }))

    const summary = await syncClinicClinicorp(clinic())
    expect(summary.errors).toEqual([])
    expect(summary.moves.length).toBeGreaterThan(0)

    const move = summary.moves.find(m => m.dryBody?.customFields || m.stepAlvo === 'Fechou')
    expect(move).toBeTruthy()
    const cf = move.dryBody.customFields ?? {}
    // "Agendado Para" (chave agendado-para) NÃO pode aparecer no PUT do fechamento
    expect(cf['agendado-para']).toBeUndefined()
    // "Fechado em" recebe a data de aprovação
    expect(cf['fechado-em']).toContain('2026-07-20')
    // clinicorp_event_date usa a data do FECHAMENTO, não a da consulta
    expect(move.dryBody.metadata.clinicorp_event_date).toBe('2026-07-20')
  })

  it('card avança para o step FECHOU mesmo com o gap de meses', async () => {
    const estimates = [{
      PatientId: '999', PatientName: 'Paciente X', PatientMobilePhone: '5562999999999',
      Status: 'APPROVED', Amount: 5000, Date: '2026-07-20T14:00:00.000Z',
    }]
    vi.stubGlobal('fetch', mockFetchSequence({ estimates }))
    const summary = await syncClinicClinicorp(clinic())
    const move = summary.moves.find(m => m.stepAlvo === 'Fechou')
    expect(move).toBeTruthy()
    expect(move.dryBody.stepId).toBe('step-fechou')
    expect(move.dryBody.monetaryAmount).toBe(5000)
  })

  it('sem dateCfg.closedAt configurado (clínica legada): não grava customField, mas o card ainda fecha', async () => {
    const estimates = [{
      PatientId: '999', PatientName: 'Paciente X', PatientMobilePhone: '5562999999999',
      Status: 'APPROVED', Amount: 5000, Date: '2026-07-20T14:00:00.000Z',
    }]
    vi.stubGlobal('fetch', mockFetchSequence({ estimates }))
    const legacyClinic = clinic()
    delete legacyClinic.steps._dates.closedAt
    const summary = await syncClinicClinicorp(legacyClinic)
    const move = summary.moves.find(m => m.stepAlvo === 'Fechou')
    expect(move).toBeTruthy()
    expect(move.dryBody.customFields?.['agendado-para']).toBeUndefined()
    expect(move.dryBody.customFields?.['fechado-em']).toBeUndefined()
    // event_date ainda é gravado (usa fechadoEm mesmo sem key de customField)
    expect(move.dryBody.metadata.clinicorp_event_date).toBe('2026-07-20')
  })
})
