// Cache id->telefone de contatos da Helena (tabela dashboards.contact_phone).
//
// Por que existe: GET /crm/v1/panel/card?IncludeDetails=Contacts devolve o
// contato só como {id,name} — SEM telefone. O sync precisa do telefone para o
// dedup (sem ele o dedup fica cego e cria card duplicado, incidente de 16/07),
// então fazia um GET /core/v1/contact/{id} por card: ~4.000 requests por rodada
// só na IBS, contra o teto de ~5.000/5min da Helena. Telefone de contato não
// muda na prática, então busca-se uma vez e reusa.
//
// Vive em módulo próprio (e não dentro do endpoint) porque a montagem da query
// do PostgREST já introduziu um bug silencioso uma vez e precisa de teste.
import { sbHeaders } from './supabase.js'

const LOTE_LEITURA = 200
const LOTE_ESCRITA = 500

export function makePhoneCache({ supabaseUrl, fetchImpl = fetch } = {}) {
  const base = supabaseUrl ?? process.env.SUPABASE_URL

  return {
    async get(ids) {
      const out = {}
      for (let i = 0; i < ids.length; i += LOTE_LEITURA) {
        // A lista do `in.(...)` NÃO pode passar por encodeURIComponent: isso
        // escapa as vírgulas separadoras (`,` → `%2C`), o PostgREST passa a ler
        // tudo como um id único, não acha nada e devolve [] com HTTP 200 —
        // falha SILENCIOSA (real: gravava 7.702 linhas e lia 0). Os ids são
        // UUID (hex + hífen), então não há caractere a escapar dentro deles.
        const inList = ids.slice(i, i + LOTE_LEITURA).join(',')
        const res = await fetchImpl(
          `${base}/rest/v1/contact_phone?contact_id=in.(${inList})&select=contact_id,phone`,
          { headers: sbHeaders() }
        )
        if (!res.ok) throw new Error(`GET ${res.status}`)
        for (const row of await res.json()) out[row.contact_id] = row.phone
      }
      return out
    },

    async put(map) {
      const rows = Object.entries(map).map(([contact_id, phone]) => ({ contact_id, phone }))
      for (let i = 0; i < rows.length; i += LOTE_ESCRITA) {
        const res = await fetchImpl(`${base}/rest/v1/contact_phone`, {
          method: 'POST',
          headers: sbHeaders({
            'Content-Type': 'application/json',
            Prefer: 'return=minimal,resolution=merge-duplicates',
          }),
          body: JSON.stringify(rows.slice(i, i + LOTE_ESCRITA)),
        })
        if (!res.ok) throw new Error(`POST ${res.status}`)
      }
    },
  }
}
