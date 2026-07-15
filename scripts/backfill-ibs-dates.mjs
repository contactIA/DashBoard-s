// Backfill one-shot: preenche "agendado-para" e "agendado-em-" nos cards já
// existentes da IBS Implantes (painel Helena, ver PLANO_CORRECOES_SETUP.md §P7).
// Hoje esses cards têm a data da consulta só no vencimento (dueDate) ou no
// customField legado "data"/"hor-rio" — sem isso o wizard mostra preview
// 0/6 nos campos novos e o funil "Agendaram" fica sem dado.
//
// NUNCA move etapa, NUNCA altera valor/metadata existente — só escreve
// customFields. Rode primeiro sem --apply (dry-run só imprime relatório).
//
// Uso:
//   node scripts/backfill-ibs-dates.mjs            → dry-run (não escreve nada)
//   node scripts/backfill-ibs-dates.mjs --apply     → aplica de verdade

import { readFileSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const APPLY = process.argv.includes('--apply')
const HELENA = 'https://api.wts.chat'
const IBS_ACCOUNT_ID = '58e1700e-84e1-4d41-aaa9-2918925a3cef'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function sb(path) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res.json()
}

async function helena(method, path, auth, body) {
  const res = await fetch(`${HELENA}${path}`, {
    method,
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 250)}`)
    err.status = res.status
    throw err
  }
  return text ? JSON.parse(text) : null
}

async function withRetry429(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn() }
    catch (err) {
      if (err.status === 429 && i < attempts - 1) { await sleep(2000 * (i + 1)); continue }
      throw err
    }
  }
}

// dueDate (UTC) → data/hora local Brasília (UTC-3, fixo — BR não observa DST desde 2019)
function dueDateToLocal(iso) {
  if (!iso) return null
  const utcMs = Date.parse(iso)
  if (Number.isNaN(utcMs)) return null
  const local = new Date(utcMs - 3 * 3_600_000)
  return { date: local.toISOString().slice(0, 10), time: local.toISOString().slice(11, 16) }
}

function isoLocal(dateStr, timeStr) {
  if (!dateStr) return null
  const hhmm = timeStr && /^\d{1,2}:\d{2}$/.test(timeStr) ? timeStr.padStart(5, '0') : '00:00'
  return `${dateStr}T${hhmm}:00.0000000`
}

function fmtDateBR2iso(raw) {
  const m = String(raw ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (!m) return null
  const dd = m[1].padStart(2, '0'), mm = m[2].padStart(2, '0')
  let yyyy = m[3]
  if (yyyy.length === 2) yyyy = `20${yyyy}`
  return `${yyyy}-${mm}-${dd}`
}

async function main() {
  console.log(APPLY ? '=== APPLY (escrita real) ===' : '=== DRY-RUN (nenhuma escrita) ===')

  const [clinic] = await sb(`/clinics?account_id=eq.${IBS_ACCOUNT_ID}&select=name,token,panel_id,steps`)
  if (!clinic) throw new Error('IBS não encontrada no Supabase.')
  const auth = clinic.token.startsWith('Bearer') ? clinic.token : `Bearer ${clinic.token}`
  const panelId = clinic.panel_id
  const units = clinic.steps?._clinicorp?.units ?? []

  // 1) Todos os cards do painel
  let cards = []
  for (let pg = 1; pg <= 30; pg++) {
    const page = await helena('GET', `/crm/v1/panel/card?PanelId=${panelId}&PageSize=100&PageNumber=${pg}&IncludeDetails=CustomFields`, auth)
    cards = cards.concat(page.items ?? [])
    if (!page.hasMorePages) break
  }
  console.log(`Total de cards no painel: ${cards.length}`)

  // 2) CreateDate (Agendado em) por Patient_PersonId, buscado nas 2 unidades
  const createDateByPatient = new Map()
  for (const u of units) {
    if (!u.user || !u.token) continue
    const authCC = 'Basic ' + Buffer.from(`${u.user}:${u.token}`).toString('base64')
    const today = new Date()
    const from = new Date(today.getTime() - 90 * 86_400_000).toISOString().slice(0, 10)
    const to = new Date(today.getTime() + 30 * 86_400_000).toISOString().slice(0, 10)
    try {
      const res = await fetch(`https://api.clinicorp.com/rest/v1/appointment/list?subscriber_id=${u.user}&from=${from}&to=${to}&IncludeCanceled=true`, {
        headers: { Authorization: authCC },
      })
      const raw = await res.json()
      const list = Array.isArray(raw) ? raw : raw.items ?? raw.list ?? []
      for (const a of list) {
        if (a.Patient_PersonId && a.CreateDate) {
          createDateByPatient.set(String(a.Patient_PersonId), String(a.CreateDate).slice(0, 10))
        }
      }
      console.log(`[${u.label || u.user}] ${list.length} agendamentos consultados`)
    } catch (err) {
      console.log(`[${u.label || u.user}] erro ao buscar appointments: ${err.message}`)
    }
    await sleep(300)
  }

  // 3) Monta o plano por card
  const plan = []
  for (const c of cards) {
    if (c.archived) continue
    const cf = c.customFields ?? {}
    let quando = null, time = null, fonte = null

    // Fonte A: customFields.data (legado, DD/MM/AAAA) + hor-rio
    const legadoData = Array.isArray(cf.data) ? cf.data[0] : cf.data
    if (legadoData) {
      const iso = fmtDateBR2iso(legadoData)
      if (iso) { quando = iso; time = Array.isArray(cf['hor-rio']) ? cf['hor-rio'][0] : cf['hor-rio']; fonte = 'legado data/hor-rio' }
    }
    // Já tem agendado-para preenchido? pula (idempotente)
    const jaTemNovo = cf['agendado-para'] && (Array.isArray(cf['agendado-para']) ? cf['agendado-para'][0] : cf['agendado-para'])

    // Fonte B: dueDate
    if (!quando && c.dueDate) {
      const parts = dueDateToLocal(c.dueDate)
      if (parts) { quando = parts.date; time = parts.time; fonte = 'dueDate' }
    }

    if (!quando) continue // sem fonte conhecida — não inventa

    const patientId = c.metadata?.clinicorp_patient_id
    const criadoEm = patientId ? createDateByPatient.get(String(patientId)) ?? null : null

    plan.push({ id: c.id, title: c.title, quando, time, criadoEm, fonte, jaTemNovo: Boolean(jaTemNovo) })
  }

  const comFonteA = plan.filter(p => p.fonte === 'legado data/hor-rio').length
  const comFonteB = plan.filter(p => p.fonte === 'dueDate').length
  const comAgendadoEm = plan.filter(p => p.criadoEm).length
  const jaPreenchidos = plan.filter(p => p.jaTemNovo).length

  console.log('\n=== RELATÓRIO ===')
  console.log(`Cards com data conhecida (a atualizar): ${plan.length} de ${cards.length}`)
  console.log(`  - fonte customFields.data/hor-rio (legado): ${comFonteA}`)
  console.log(`  - fonte dueDate: ${comFonteB}`)
  console.log(`  - já têm agendado-para preenchido (serão sobrescritos com o mesmo tipo de dado): ${jaPreenchidos}`)
  console.log(`Cards que também ganham "agendado-em-": ${comAgendadoEm}`)
  console.log(`Cards SEM nenhuma fonte de data (não serão tocados): ${cards.length - plan.length}`)

  console.log('\n=== 10 EXEMPLOS ===')
  for (const p of plan.slice(0, 10)) {
    console.log(`- "${p.title}" [${p.fonte}] → agendado-para=${isoLocal(p.quando, p.time)}${p.criadoEm ? `, agendado-em-=${isoLocal(p.criadoEm, null)}` : ''}`)
  }

  if (!APPLY) {
    console.log('\nDry-run concluído — nenhuma escrita feita. Rode com --apply para aplicar de verdade.')
    return
  }

  console.log('\n=== APLICANDO ===')
  let ok = 0, fail = 0
  for (const p of plan) {
    try {
      const customFields = { 'agendado-para': isoLocal(p.quando, p.time) }
      if (p.criadoEm) customFields['agendado-em-'] = isoLocal(p.criadoEm, null)
      await withRetry429(() => helena('PUT', `/crm/v2/panel/card/${p.id}`, auth, {
        fields: ['customFields'],
        customFields,
      }))
      ok++
    } catch (err) {
      fail++
      console.log(`❌ "${p.title}": ${err.message}`)
    }
    await sleep(250)
  }
  console.log(`\n=== CONCLUÍDO: ${ok} atualizados, ${fail} falharam ===`)
}

main().catch((err) => { console.error('ERRO FATAL:', err.message); process.exit(1) })
