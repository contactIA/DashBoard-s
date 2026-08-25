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

describe('syncClinicClinicorp — janela de busca dinâmica (23/07)', () => {
  it('sem lastSyncAt (1ª sincronização): busca desde unit.syncSince', async () => {
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      calls.push(String(url))
      return mockFetchSequence({})(url)
    }))
    await syncClinicClinicorp(clinic())
    const estimateCalls = calls.filter(u => u.includes('/estimates/list'))
    expect(estimateCalls.length).toBeGreaterThan(0)
    // syncSince da fixture é 2025-01-01 — a 1ª janela deve começar ali, não 12 meses atrás de hoje
    expect(estimateCalls[0]).toContain('from=2025-01-01')
  })

  it('com lastSyncAt: busca só a partir da última execução, não desde syncSince', async () => {
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      calls.push(String(url))
      return mockFetchSequence({})(url)
    }))
    const clinicComLastSync = clinic()
    clinicComLastSync.steps._clinicorp.units[0].lastSyncAt = '2026-07-20T10:00:00.000Z'
    await syncClinicClinicorp(clinicComLastSync)
    const estimateCalls = calls.filter(u => u.includes('/estimates/list'))
    expect(estimateCalls.length).toBeGreaterThan(0)
    expect(estimateCalls[0]).toContain('from=2026-07-20')
  })

  it('retorna unitsLastSync no summary para o chamador persistir', async () => {
    vi.stubGlobal('fetch', mockFetchSequence({}))
    const summary = await syncClinicClinicorp(clinic())
    expect(summary.unitsLastSync).toBeTruthy()
    expect(summary.unitsLastSync['Matriz']).toBeTruthy()
  })
})

describe('syncClinicClinicorp — fatiamento por unidade (21/08)', () => {
  // Clínica com 2 contas Clinicorp sob o mesmo painel (caso real: 2 filiais).
  const clinicDuasUnidades = () => {
    const c = clinic()
    c.steps._clinicorp = {
      units: [
        { label: 'Unidade A', tagId: 'tag-a', user: 'ua', token: 'ta', syncSince: '2026-07-01', crcMap: [{ clinicorpName: 'ANA', tagId: 'tag-crc-a' }] },
        { label: 'Unidade B', tagId: 'tag-b', user: 'ub', token: 'tb', syncSince: '2026-07-01', crcMap: [{ clinicorpName: 'BIA', tagId: 'tag-crc-b' }] },
      ],
    }
    return c
  }

  it('sem onlyUnit: processa TODAS as unidades (comportamento antigo preservado)', async () => {
    vi.stubGlobal('fetch', mockFetchSequence({}))
    const summary = await syncClinicClinicorp(clinicDuasUnidades())
    expect(Object.keys(summary.unitsLastSync).sort()).toEqual(['Unidade A', 'Unidade B'])
    expect(summary.unit).toBeNull()
  })

  it('com onlyUnit: processa SÓ a unidade pedida — metade do trabalho por execução', async () => {
    const calls = []
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      calls.push(String(url))
      return mockFetchSequence({})(url)
    }))
    const summary = await syncClinicClinicorp(clinicDuasUnidades(), { onlyUnit: 'Unidade B' })
    expect(Object.keys(summary.unitsLastSync)).toEqual(['Unidade B'])
    expect(summary.unit).toBe('Unidade B')
    // não deve ter tocado nas credenciais da unidade A
    expect(calls.some(u => u.includes('/estimates/list'))).toBe(true)
    expect(summary.errors).toEqual([])
  })

  it('onlyUnit inexistente: erro explícito, não silencia nem processa tudo', async () => {
    vi.stubGlobal('fetch', mockFetchSequence({}))
    const summary = await syncClinicClinicorp(clinicDuasUnidades(), { onlyUnit: 'Unidade Fantasma' })
    expect(summary.moved).toBe(0)
    expect(summary.created).toBe(0)
    expect(summary.errors.join(' ')).toContain('não encontrada')
  })
})

describe('syncClinicClinicorp — checkpoint do lastSyncAt (21/08)', () => {
  it('chama onUnitDone com o avanço da janela, para o chamador persistir antes do fim', async () => {
    vi.stubGlobal('fetch', mockFetchSequence({}))
    const recebido = []
    const summary = await syncClinicClinicorp(clinic(), {
      onUnitDone: (m) => { recebido.push(m) },
    })
    expect(recebido).toHaveLength(1)
    expect(recebido[0]['Matriz']).toBeTruthy()
    expect(summary.errors).toEqual([])
  })

  it('coleta com janela falhando NÃO avança o lastSyncAt — intervalo precisa ser relido', async () => {
    // estimates/list falha; appointments segue ok. Usa 500 (não 429) de
    // propósito: 429 aciona o backoff real do withRetry429 (2s+4s) e o teste
    // gastaria segundos esperando — o que importa aqui é a janela ter falhado.
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const u = String(url)
      if (u.includes('/estimates/list')) {
        return { ok: false, status: 500, text: async () => '{"error":"boom"}' }
      }
      return mockFetchSequence({})(url)
    }))
    const recebido = []
    const summary = await syncClinicClinicorp(clinic(), {
      onUnitDone: (m) => { recebido.push(m) },
    })
    // marcador NÃO avança e o callback não é chamado: nada a persistir
    expect(summary.unitsLastSync).toEqual({})
    expect(recebido).toHaveLength(0)
    expect(summary.errors.join(' ')).toMatch(/estimates/)
  })

  it('falha ao persistir o checkpoint é registrada, não derruba o sync', async () => {
    vi.stubGlobal('fetch', mockFetchSequence({}))
    const summary = await syncClinicClinicorp(clinic(), {
      onUnitDone: () => { throw new Error('supabase fora do ar') },
    })
    expect(summary.errors.join(' ')).toContain('checkpoint lastSyncAt')
    expect(summary.failed).toBe(0) // o sync em si não é penalizado
  })
})

describe('syncClinicClinicorp — cache de telefone de contato (21/08)', () => {
  // A listagem de cards da Helena traz o contato como {id,name}, SEM telefone.
  // Buscar um a um a cada rodada custava ~1 request por card (~4.000 na IBS)
  // contra o teto de 5.000/5min — origem dos 429 que derrubavam a Helena.
  const cardComContato = {
    ...CARD_AGENDADO,
    contacts: [{ id: 'contact-1', name: 'Paciente X' }],
  }

  function mockComCards(cards) {
    return vi.fn(async (url) => {
      const u = String(url)
      const json = (body) => ({ ok: true, text: async () => JSON.stringify(body) })
      if (u.includes('/crm/v1/panel/panel-1?')) {
        return json({ id: PANEL_ID, steps: [{ id: 'step-agendado', title: 'Agendado' }, { id: 'step-fechou', title: 'Fechou' }], tags: [] })
      }
      if (u.includes('/crm/v1/panel/card?PanelId=')) return json({ items: cards, hasMorePages: false })
      if (u.includes('/crm/v1/panel/card/card-1')) return json(cards[0])
      if (u.includes('/appointment/status_list')) return json({ list: [] })
      if (u.includes('/appointment/list')) return json([])
      if (u.includes('/estimates/list')) return json([])
      if (u.includes('/core/v1/contact/')) return json({ id: 'contact-1', phoneNumber: '5562999999999' })
      return json({})
    })
  }

  it('telefone em cache: NÃO faz request por contato', async () => {
    const fetchMock = mockComCards([cardComContato])
    vi.stubGlobal('fetch', fetchMock)
    const summary = await syncClinicClinicorp(clinic(), {
      phoneCache: {
        get: async () => ({ 'contact-1': '5562999999999' }),
        put: async () => {},
      },
    })
    const chamadasDeContato = fetchMock.mock.calls
      .map(c => String(c[0]))
      .filter(u => u.includes('/core/v1/contact/'))
    expect(chamadasDeContato).toHaveLength(0)
    expect(summary.contactsFromCache).toBe(1)
    expect(summary.contactsFetched).toBe(0)
  })

  it('contato novo: busca na Helena e grava no cache para a próxima rodada', async () => {
    vi.stubGlobal('fetch', mockComCards([cardComContato]))
    const gravados = []
    const summary = await syncClinicClinicorp(clinic(), {
      phoneCache: {
        get: async () => ({}),                       // cache vazio
        put: async (m) => { gravados.push(m) },
      },
    })
    expect(summary.contactsFetched).toBe(1)
    expect(gravados).toHaveLength(1)
    expect(gravados[0]['contact-1']).toBe('5562999999999')
  })

  it('cache fora do ar: registra o aviso e segue buscando na Helena', async () => {
    vi.stubGlobal('fetch', mockComCards([cardComContato]))
    const summary = await syncClinicClinicorp(clinic(), {
      phoneCache: {
        get: async () => { throw new Error('supabase off') },
        put: async () => {},
      },
    })
    expect(summary.errors.join(' ')).toContain('cache de telefones indisponível')
    expect(summary.contactsFetched).toBe(1)  // fallback: buscou mesmo assim
  })
})
