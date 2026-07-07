// Cron de produção: roda a cada hora (vercel.json) e sincroniza TODAS as
// clínicas que têm _clinicorp.units configurado — cada unidade é uma conta
// Clinicorp separada (ex: Bueno/Eldorado da IBS), casada pela etiqueta do
// painel. Motor em src/server/clinicorpSync.js (validado manualmente antes
// de entrar aqui — ver PROJETO CLINICORP + PAINEL/sync-prototype/).
import { syncClinicClinicorp } from '../../src/server/clinicorpSync.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

// Vercel injeta esse header automaticamente nas chamadas de Cron quando a
// env var CRON_SECRET existe no projeto — protege o endpoint de disparo por
// terceiros (ele escreve em CRM de produção de todas as clínicas vinculadas).
function isAuthorizedCronRequest(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers['authorization'] === `Bearer ${secret}`
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default async function handler(req, res) {
  if (!isAuthorizedCronRequest(req)) {
    return res.status(401).json({ error: 'Não autorizado.' })
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Variáveis de ambiente do Supabase não configuradas.' })
  }

  // Jitter pequeno: o orçamento de execução é curto (plano sem Cron nativo
  // da Vercel, disparado por um scheduler externo — ver .github/workflows/
  // sync-clinicorp.yml) — espalha o INÍCIO do trabalho em até 10s, só para
  // não bater sempre no mesmo instante contra o rate limit por conta.
  const jitterMs = Math.floor(Math.random() * 10_000)
  await sleep(jitterMs)

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
    .filter((r) => (r.steps?._clinicorp?.units?.length ?? 0) > 0)
    .map((r) => ({ accountId: r.account_id, name: r.name, panelId: r.panel_id, token: r.token, steps: r.steps }))

  if (accountId && !clinics.length) {
    return res.status(404).json({ error: `Clínica "${accountId}" não encontrada ou sem Clinicorp vinculado.` })
  }

  const results = []
  for (const clinic of clinics) {
    const summary = await syncClinicClinicorp(clinic).catch((err) => ({
      clinic: clinic.name, accountId: clinic.accountId, moved: 0, created: 0, failed: 1, errors: [err.message], unmatchedCrc: [],
    }))
    results.push(summary)
    await sleep(500) // respiro entre clínicas
  }

  const totals = results.reduce((acc, r) => ({
    moved: acc.moved + r.moved, created: acc.created + r.created, failed: acc.failed + r.failed,
  }), { moved: 0, created: 0, failed: 0 })

  console.log('[cron/sync-clinicorp]', JSON.stringify({ jitterMs, clinicsProcessed: clinics.length, ...totals }))
  for (const r of results) {
    if (r.errors?.length) console.error(`[cron/sync-clinicorp] ${r.clinic}:`, r.errors)
  }

  return res.status(200).json({ jitterMs, clinicsProcessed: clinics.length, totals, results })
}
