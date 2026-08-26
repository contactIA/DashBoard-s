// Protege o bug de 26/08: a lista do filtro `in.(...)` do PostgREST passava
// por encodeURIComponent, que escapava as vírgulas separadoras. O filtro
// deixava de casar e a API devolvia [] com HTTP 200 — falha SILENCIOSA: o
// cache gravou 7.702 linhas e leu 0, e o sync seguiu batendo na Helena.
import { describe, it, expect, vi } from 'vitest'
import { makePhoneCache } from './phoneCache.js'

const URL_BASE = 'https://projeto.supabase.co'

describe('phoneCache.get — montagem do filtro PostgREST', () => {
  it('mantém as vírgulas separadoras do in.(...) sem escapar', async () => {
    const urls = []
    const fetchImpl = vi.fn(async (url) => {
      urls.push(String(url))
      return { ok: true, json: async () => [] }
    })
    const cache = makePhoneCache({ supabaseUrl: URL_BASE, fetchImpl })
    await cache.get(['aaaaaaaa-1111-2222-3333-444444444444', 'bbbbbbbb-5555-6666-7777-888888888888'])

    expect(urls).toHaveLength(1)
    // vírgula literal separando os ids — %2C aqui quebraria o filtro
    expect(urls[0]).toContain('contact_id=in.(aaaaaaaa-1111-2222-3333-444444444444,bbbbbbbb-5555-6666-7777-888888888888)')
    expect(urls[0]).not.toContain('%2C')
  })

  it('devolve o mapa id->telefone do que a API retornou', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => [
        { contact_id: 'id-1', phone: '5562999990000' },
        { contact_id: 'id-2', phone: null },
      ],
    }))
    const cache = makePhoneCache({ supabaseUrl: URL_BASE, fetchImpl })
    const out = await cache.get(['id-1', 'id-2'])
    expect(out).toEqual({ 'id-1': '5562999990000', 'id-2': null })
  })

  it('quebra a leitura em lotes — não monta URL gigante', async () => {
    const urls = []
    const fetchImpl = vi.fn(async (url) => {
      urls.push(String(url))
      return { ok: true, json: async () => [] }
    })
    const cache = makePhoneCache({ supabaseUrl: URL_BASE, fetchImpl })
    await cache.get(Array.from({ length: 450 }, (_, i) => `id-${i}`))
    expect(urls).toHaveLength(3) // 200 + 200 + 50
  })

  it('erro HTTP na leitura vira exceção — não passa como cache vazio', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, json: async () => [] }))
    const cache = makePhoneCache({ supabaseUrl: URL_BASE, fetchImpl })
    await expect(cache.get(['id-1'])).rejects.toThrow('GET 500')
  })
})

describe('phoneCache.put', () => {
  it('faz upsert (merge-duplicates) para não estourar em id já existente', async () => {
    let opts
    const fetchImpl = vi.fn(async (_url, o) => { opts = o; return { ok: true, json: async () => [] } })
    const cache = makePhoneCache({ supabaseUrl: URL_BASE, fetchImpl })
    await cache.put({ 'id-1': '556299999' })

    expect(opts.method).toBe('POST')
    expect(opts.headers.Prefer).toContain('resolution=merge-duplicates')
    expect(JSON.parse(opts.body)).toEqual([{ contact_id: 'id-1', phone: '556299999' }])
  })

  it('grava em lotes', async () => {
    const chamadas = []
    const fetchImpl = vi.fn(async (_url, o) => { chamadas.push(JSON.parse(o.body).length); return { ok: true, json: async () => [] } })
    const cache = makePhoneCache({ supabaseUrl: URL_BASE, fetchImpl })
    const grande = {}
    for (let i = 0; i < 1100; i++) grande[`id-${i}`] = `fone-${i}`
    await cache.put(grande)
    expect(chamadas).toEqual([500, 500, 100])
  })

  it('mapa vazio não faz request', async () => {
    const fetchImpl = vi.fn()
    const cache = makePhoneCache({ supabaseUrl: URL_BASE, fetchImpl })
    await cache.put({})
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
