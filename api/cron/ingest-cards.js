// Cron de ingestão de cards Helena → tabela `cards` do Supabase
// (PLANO_INGESTAO_E_PROCESSO.md, FASE A2). Mesmo padrão do sync-clinicorp:
// disparado pelo GitHub Actions (.github/workflows/ingest-cards.yml),
// ?list=1 lista as clínicas, ?accountId=X ingesta uma por chamada.
// Diferença: aqui entram TODAS as clínicas (qualquer uma com painel+token),
// não só as com Clinicorp vinculado.
import { ingestClinicCards } from '../../src/server/cardsIngest.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

function isAuthorizedCronRequest(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers['authorization'] === `Bearer ${secret}`
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Auditoria persistente em `ingest_log` (supabase/ingest_log.sql) —
// best-effort: sem a tabela, a ingestão segue e só loga no console.
async function logIngestRun(summary) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ingest_log`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        account_id:  summary.accountId,
        clinic_name: summary.clinic,
        fetched:     summary.fetched,
        upserted:    summary.upserted,
        frozen:      summary.frozen,
        errors:      summary.errors?.length ? summary.errors : null,
        duration_ms: summary.durationMs ?? null,
      }),
    })
    if (!res.ok) console.error('[ingest_log] insert falhou:', res.status, (await res.text()).slice(0, 200))
  } catch (err) {
    console.error('[ingest_log] insert falhou:', err.message)
  }
}

export default async function handler(req, res) {
  if (!isAuthorizedCronRequest(req)) {
    return res.status(401).json({ error: 'Não autorizado.' })
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Variáveis de ambiente do Supabase não configuradas.' })
  }

  const accountId = req.query?.accountId ?? null
  const filter = accountId ? `&account_id=eq.${encodeURIComponent(accountId)}` : ''
  const res_ = await fetch(`${SUPABASE_URL}/rest/v1/clinics?select=account_id,name,panel_id,token,steps${filter}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res_.ok) {
    return res.status(502).json({ error: `Supabase ${res_.status}: ${(await res_.text()).slice(0, 300)}` })
  }
  const rows = await res_.json()

  const clinics = rows
    .filter((r) => r.panel_id && r.token)
    .map((r) => ({ accountId: r.account_id, name: r.name, panelId: r.panel_id, token: r.token, steps: r.steps }))

  if (req.query?.list === '1') {
    return res.status(200).json({ accountIds: clinics.map((c) => c.accountId) })
  }

  if (accountId && !clinics.length) {
    return res.status(404).json({ error: `Clínica "${accountId}" não encontrada ou sem painel/token.` })
  }

  const results = []
  for (const clinic of clinics) {
    const summary = await ingestClinicCards(clinic, { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY })
    results.push(summary)
    await logIngestRun(summary)
    await sleep(500)
  }

  const totals = results.reduce((acc, r) => ({
    fetched: acc.fetched + r.fetched, upserted: acc.upserted + r.upserted,
    failed: acc.failed + (r.errors.length ? 1 : 0),
  }), { fetched: 0, upserted: 0, failed: 0 })

  console.log('[cron/ingest-cards]', JSON.stringify({ clinicsProcessed: clinics.length, ...totals }))
  for (const r of results) {
    if (r.errors?.length) console.error(`[cron/ingest-cards] ${r.clinic}:`, r.errors)
  }

  return res.status(200).json({ clinicsProcessed: clinics.length, totals, results })
}
