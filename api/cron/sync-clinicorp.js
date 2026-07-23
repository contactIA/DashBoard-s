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

// LOCK contra execuções CONCORRENTES da mesma clínica — causa raiz confirmada
// de cards duplicados em produção (22/07): duas execuções do sync rodando ao
// mesmo tempo (ex: disparo manual + cron agendado, ou dois cliques em "Run
// workflow") cada uma lê a lista de cards ANTES da outra criar os novos —
// nenhuma vê o card que a outra está prestes a criar, e cada uma cria o seu.
// A trava usa a própria tabela clinics.steps._syncLock (JSONB, sem migração
// nova): grava um timestamp ao ENTRAR, libera ao SAIR; se já houver um lock
// mais novo que LOCK_TTL_MS, recusa a execução concorrente.
const LOCK_TTL_MS = 4 * 60 * 1000 // folga acima do tempo real de 1 clínica (visto: 6-28s)

// Adquire o lock de forma ATÔMICA: relê o `steps` FRESCO do banco (não o
// `currentSteps` da listagem inicial, que pode estar desatualizado se outra
// execução já adquiriu o lock nesse meio tempo) e só faz o PATCH se, na
// releitura, ainda não houver lock válido. Ainda existe uma janela mínima
// entre o GET e o PATCH (PostgREST não expõe compare-and-swap simples aqui),
// mas ela é de dezenas de ms — ordens de grandeza menor que os 6-30s da
// race condition original (execuções inteiras rodando em paralelo).
async function acquireLock(accountId) {
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/clinics?account_id=eq.${encodeURIComponent(accountId)}&select=steps`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!getRes.ok) return { ok: false, lockedAt: null, error: `lock GET ${getRes.status}` }
  const [row] = await getRes.json()
  const fresh = row?.steps ?? {}
  const now = Date.now()
  const existing = fresh?._syncLock?.lockedAt
  if (existing && now - Date.parse(existing) < LOCK_TTL_MS) {
    return { ok: false, lockedAt: existing }
  }
  const newSteps = { ...fresh, _syncLock: { lockedAt: new Date(now).toISOString() } }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clinics?account_id=eq.${encodeURIComponent(accountId)}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ steps: newSteps }),
  })
  if (!res.ok) return { ok: false, lockedAt: null, error: `lock PATCH ${res.status}` }
  return { ok: true, steps: newSteps }
}

// Relê o `steps` FRESCO antes de liberar — o admin pode ter editado a
// clínica no /setup durante a execução do sync; usar um `steps` antigo aqui
// desfaria essa edição. Só remove `_syncLock`, preserva todo o resto.
async function releaseLock(accountId) {
  try {
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/clinics?account_id=eq.${encodeURIComponent(accountId)}&select=steps`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
    if (!getRes.ok) return
    const [row] = await getRes.json()
    const { _syncLock, ...rest } = row?.steps ?? {}
    await fetch(`${SUPABASE_URL}/rest/v1/clinics?account_id=eq.${encodeURIComponent(accountId)}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ steps: rest }),
    })
  } catch { /* best-effort — o lock expira sozinho via LOCK_TTL_MS mesmo se isto falhar */ }
}

// Grava o resultado de cada clínica na tabela `sync_log` do Supabase —
// auditoria consultável (o log do GitHub Actions expira e não é pesquisável).
// Best-effort: se a tabela ainda não existir ou o insert falhar, só loga no
// console; o sync em si nunca é afetado.
async function logSyncRun(summary) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_log`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        account_id:    summary.accountId,
        clinic_name:   summary.clinic,
        moved:         summary.moved,
        created:       summary.created,
        failed:        summary.failed,
        errors:        summary.errors?.length ? summary.errors : null,
        unmatched_crc: summary.unmatchedCrc?.length ? summary.unmatchedCrc : null,
        duration_ms:   summary.durationMs ?? null,
      }),
    })
    if (!res.ok) console.error('[sync_log] insert falhou:', res.status, (await res.text()).slice(0, 200))
  } catch (err) {
    console.error('[sync_log] insert falhou:', err.message)
  }
}

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

  // Modo leve: só lista quem tem Clinicorp vinculado (sem sincronizar nada) —
  // o workflow usa isso pra saber quais accountId chamar, um por vez, cada
  // um em sua própria chamada (evita estourar o maxDuration somando todas).
  if (req.query?.list === '1') {
    return res.status(200).json({ accountIds: clinics.map((c) => c.accountId) })
  }

  if (accountId && !clinics.length) {
    return res.status(404).json({ error: `Clínica "${accountId}" não encontrada ou sem Clinicorp vinculado.` })
  }

  const results = []
  for (const clinic of clinics) {
    const lock = await acquireLock(clinic.accountId)
    if (!lock.ok) {
      const summary = {
        clinic: clinic.name, accountId: clinic.accountId, moved: 0, created: 0, failed: 0,
        errors: [`sync ignorado — já há uma execução em andamento (lock de ${lock.lockedAt ?? 'origem desconhecida'}, TTL ${LOCK_TTL_MS / 1000}s). Evita a duplicação de cards por execuções concorrentes (bug confirmado em 22/07).`],
        unmatchedCrc: [], durationMs: 0,
      }
      results.push(summary)
      await logSyncRun(summary)
      continue
    }
    const startedAt = Date.now()
    const summary = await syncClinicClinicorp(clinic).catch((err) => ({
      clinic: clinic.name, accountId: clinic.accountId, moved: 0, created: 0, failed: 1, errors: [err.message], unmatchedCrc: [],
    }))
    summary.durationMs = Date.now() - startedAt
    results.push(summary)
    await logSyncRun(summary) // auditoria persistente — best-effort, nunca derruba o sync
    await releaseLock(clinic.accountId)
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
