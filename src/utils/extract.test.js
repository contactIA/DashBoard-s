// Testes da extração — protegem as pegadinhas REAIS da Helena descobertas
// em produção (datas com barras, campos vazios, telefone plausível).
import { describe, it, expect } from 'vitest'
import {
  normalizeDate, isPlausiblePhone, extractCard, extractWith, dueDateParts,
} from './extract.js'

describe('normalizeDate — formatos vistos em produção', () => {
  it('YMD com hífen (ISO padrão)', () => {
    expect(normalizeDate('2026-07-08', 'YMD')).toBe('2026-07-08')
    expect(normalizeDate('2026-07-08T12:00:00.0000000', 'YMD')).toBe('2026-07-08')
  })

  it('YMD com BARRAS — a Helena reformata "agendado-em-" na gravação (commit f49339f)', () => {
    expect(normalizeDate('2026/07/13', 'YMD')).toBe('2026-07-13')
  })

  it('DMY completo e com ano de 2 dígitos', () => {
    expect(normalizeDate('08/07/2026', 'DMY')).toBe('2026-07-08')
    expect(normalizeDate('24/06/26', 'DMY')).toBe('2026-06-24')
  })

  it('lixo não vira data', () => {
    expect(normalizeDate('sem data', 'YMD')).toBeNull()
    expect(normalizeDate('', 'DMY')).toBeNull()
    expect(normalizeDate(null, 'YMD')).toBeNull()
  })
})

describe('isPlausiblePhone — texto livre não vaza como telefone', () => {
  it('aceita formatos BR reais', () => {
    expect(isPlausiblePhone('62996261364')).toBe(true)
    expect(isPlausiblePhone('(11) 96313-3306')).toBe(true)
    expect(isPlausiblePhone('+55 62 9626-1364')).toBe(true)
  })
  it('rejeita descrição com datas (12 dígitos somados ≠ telefone)', () => {
    expect(isPlausiblePhone('Entrada: 29/06/2026 às 20:05')).toBe(false)
    expect(isPlausiblePhone('Paulo Martins')).toBe(false)
  })
})

describe('extractWith — robustez', () => {
  it('regex inválida (digitação no wizard) é ignorada sem lançar erro', () => {
    const c = { description: 'Data: 2026-07-08' }
    expect(() => extractWith([{ from: 'description', regex: '([', format: 'YMD' }], c, 'date')).not.toThrow()
  })

  it('primeira regra que casa vence; demais são fallback', () => {
    const c = { title: '2026-01-01', description: '2026-02-02' }
    const rules = [
      { from: 'description', regex: '(\\d{4}-\\d{2}-\\d{2})', format: 'YMD' },
      { from: 'title', regex: '(\\d{4}-\\d{2}-\\d{2})', format: 'YMD' },
    ]
    expect(extractWith(rules, c, 'date')).toBe('2026-02-02')
  })

  it('customFields vazio no card → regra não casa (Helena omite campo sem valor)', () => {
    const c = { customFields: {} }
    expect(extractWith([{ from: 'customFields.agendado-para', format: 'YMD' }], c, 'date')).toBeNull()
  })
})

describe('extractCard — scheduledAt ("Agendado em") é opcional', () => {
  const cfg = {
    date: [{ from: 'customFields.agendado-para', format: 'YMD' }],
    time: [{ from: 'customFields.agendado-para', regex: '(\\d{1,2}:\\d{2})' }],
    name: [{ from: 'contactName' }],
    phone: [{ from: 'contactPhone' }],
  }
  const c = {
    customFields: { 'agendado-para': '2026-07-08T14:30:00.0000000', 'agendado-em-': '2026/07/03' },
    contacts: [{ name: 'Maria' }],
    contactPhone: '62996261364',
  }

  it('sem regra de scheduledAt → null (clínica legada, sem quebrar)', () => {
    expect(extractCard(c, cfg).scheduledAt).toBeNull()
  })

  it('com regra → extrai, inclusive no formato com barras da Helena', () => {
    const withSched = { ...cfg, scheduledAt: [{ from: 'customFields.agendado-em-', format: 'YMD' }] }
    const out = extractCard(c, withSched)
    expect(out.scheduledAt).toBe('2026-07-03')
    expect(out.date).toBe('2026-07-08')
    expect(out.time).toBe('14:30')
    expect(out.name).toBe('Maria')
  })
})

describe('dueDateParts — UTC → horário de Brasília', () => {
  it('converte com offset fixo de -3h', () => {
    expect(dueDateParts('2026-07-08T15:00:00Z')).toEqual({ date: '2026-07-08', time: '12:00' })
    // virada de dia: 01:30 UTC = 22:30 do dia anterior no BR
    expect(dueDateParts('2026-07-09T01:30:00Z')).toEqual({ date: '2026-07-08', time: '22:30' })
  })
  it('entrada inválida → null', () => {
    expect(dueDateParts(null)).toBeNull()
    expect(dueDateParts('não é data')).toBeNull()
  })
})
