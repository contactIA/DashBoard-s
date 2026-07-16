// Widget de saúde do sync (PLANO_AGENDADOR_CAMPANHA.md FASE 7): lê a
// tabela sync_log (gravada por api/cron/sync-clinicorp.js a cada rodada) e
// devolve, por clínica: última rodada + agregados das últimas 24h +
// unmatchedCrc pendentes (nomes de CRC ainda sem etiqueta correspondente).
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`)
  return body ? JSON.parse(body) : null
}

export default async function handler(req, res) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return res.status(500).json({ error: 'ADMIN_SECRET não configurado no servidor.' })
  if (req.headers['x-admin-secret'] !== secret) return res.status(401).json({ error: 'Não autorizado.' })
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Variáveis de ambiente do Supabase não configuradas.' })
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    // PostgREST não faz DISTINCT ON facilmente — busca as últimas 24h e agrupa em JS.
    // Ordenado por executed_at desc: a primeira linha vista por account_id é a última rodada.
    const rows = await sb(
      `/sync_log?executed_at=gte.${encodeURIComponent(since)}&order=executed_at.desc&select=account_id,clinic_name,executed_at,moved,created,failed,errors,unmatched_crc,duration_ms`
    )

    const byClinic = new Map()
    for (const r of rows ?? []) {
      const key = r.account_id
      let entry = byClinic.get(key)
      if (!entry) {
        entry = {
          accountId: r.account_id,
          clinicName: r.clinic_name,
          lastRun: null,
          last24h: { moved: 0, created: 0, failed: 0, runs: 0 },
          unmatchedCrc: new Set(),
        }
        byClinic.set(key, entry)
      }
      if (!entry.lastRun) {
        entry.lastRun = {
          executedAt: r.executed_at,
          moved: r.moved,
          created: r.created,
          failed: r.failed,
          errors: r.errors ?? null,
          durationMs: r.duration_ms ?? null,
        }
      }
      entry.last24h.moved   += r.moved ?? 0
      entry.last24h.created += r.created ?? 0
      entry.last24h.failed  += r.failed ?? 0
      entry.last24h.runs    += 1
      for (const nome of r.unmatched_crc ?? []) entry.unmatchedCrc.add(nome)
    }

    const nowMs = Date.now()
    const clinics = [...byClinic.values()].map((c) => {
      const lastRunMs = c.lastRun ? new Date(c.lastRun.executedAt).getTime() : null
      const hoursSinceLastRun = lastRunMs != null ? (nowMs - lastRunMs) / 3_600_000 : null
      const unmatchedCrc = [...c.unmatchedCrc]

      // vermelho: falha na última rodada OU sem rodada há 2h+
      // amarelo: unmatchedCrc pendente (nome de CRC sem etiqueta mapeada)
      // verde: última rodada ok, sem pendências
      let status = 'green'
      if ((c.lastRun?.failed ?? 0) > 0 || hoursSinceLastRun == null || hoursSinceLastRun >= 2) status = 'red'
      else if (unmatchedCrc.length > 0) status = 'yellow'

      return {
        accountId: c.accountId,
        clinicName: c.clinicName,
        status,
        lastRun: c.lastRun,
        hoursSinceLastRun,
        last24h: c.last24h,
        unmatchedCrc,
      }
    })

    return res.status(200).json({ clinics })
  } catch (err) {
    console.error('[admin/sync-status]', err)
    return res.status(500).json({ error: err.message })
  }
}
