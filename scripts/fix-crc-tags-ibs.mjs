// One-shot: saneia as etiquetas de CRC dos cards do painel IBS que têm
// metadata.clinicorp_patient_id (PLANO_AGENDADOR_CAMPANHA.md FASE 1.4).
// Recalcula o CRC verdadeiro — agendamento com maior data de "Agendado em"
// (appointment.CreateDate) nas 2 unidades — e corrige/deduplica cards
// desatualizados. NUNCA remove etiqueta sem substituta resolvida.
//
// Uso:
//   node scripts/fix-crc-tags-ibs.mjs            → dry-run (só relatório)
//   node scripts/fix-crc-tags-ibs.mjs --apply     → aplica de fato (após revisar o dry-run)
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { makeClinicorpClient } from '../src/server/clinicorp.js'

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const IBS_ACCOUNT_ID = '58e1700e-84e1-4d41-aaa9-2918925a3cef'
const HELENA = 'https://api.wts.chat'
const APPLY = process.argv.includes('--apply')

const iso = (d) => d.toISOString().slice(0, 10)
const normTag = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function withRetry429(fn, { attempts = 3, baseDelayMs = 2000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (err) {
      if (err.status === 429 && i < attempts - 1) { await sleep(baseDelayMs * (i + 1)); continue }
      throw err
    }
  }
}

async function sbGet(path) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase GET ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res.json()
}

async function main() {
  const [row] = await sbGet(`/clinics?account_id=eq.${IBS_ACCOUNT_ID}&select=account_id,name,panel_id,token,steps`)
  if (!row) throw new Error('IBS não encontrada.')
  const clinic = { accountId: row.account_id, name: row.name, panelId: row.panel_id, token: row.token, steps: row.steps }
  const units = clinic.steps?._clinicorp?.units ?? []
  if (!units.length) throw new Error('IBS sem unidades Clinicorp configuradas.')

  const rawToken = String(clinic.token ?? '').trim()
  const helenaAuth = { Authorization: /^bearer /i.test(rawToken) ? rawToken : `Bearer ${rawToken}` }
  async function helenaRaw(method, path, body) {
    const res = await fetch(`${HELENA}${path}`, {
      method, headers: { ...helenaAuth, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    if (!res.ok) {
      const err = new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 250)}`)
      err.status = res.status
      throw err
    }
    try { return JSON.parse(text) } catch { return null }
  }
  const helena = (method, path, body) => withRetry429(() => helenaRaw(method, path, body))

  // allCrcTagIds — só etiquetas conhecidas por algum crcMap podem ser tocadas.
  const allCrcTagIds = new Set(units.flatMap((u) => (u.crcMap ?? []).map((m) => m.tagId)))

  // agendadorByPatient: agendamento mais recente por CreateDate, nas 2 unidades.
  const agendadorByPatient = new Map()
  const today = new Date()
  const apptFrom = iso(new Date(today.getTime() - 60 * 86_400_000))
  const apptTo = iso(new Date(today.getTime() + 30 * 86_400_000))

  for (const unit of units) {
    if (!unit.user || !unit.token) continue
    const crcMap = unit.crcMap ?? []
    const resolveCrcTagId = (createUserName) => {
      if (!createUserName || !crcMap.length) return null
      const alvo = normTag(createUserName)
      for (const m of crcMap) {
        if (!m.clinicorpName || !m.tagId) continue
        if (normTag(m.clinicorpName) === alvo) return m.tagId
      }
      return null
    }
    const clinicorp = makeClinicorpClient({ user: unit.user, token: unit.token, subscriberId: unit.user })
    let appts = []
    try {
      const raw = await clinicorp.appointments(apptFrom, apptTo, { IncludeCanceled: 'true' })
      appts = Array.isArray(raw) ? raw : raw.items ?? raw.list ?? []
    } catch (err) {
      console.log(`[${unit.label || unit.user}] appointments falhou: ${err.message}`)
      continue
    }
    for (const a of appts) {
      if (!a.Patient_PersonId || !a.CreateUserName) continue
      const pid0 = String(a.Patient_PersonId)
      const agendadoEm = String(a.CreateDate ?? '').slice(0, 10)
      const prev = agendadorByPatient.get(pid0)
      if (!prev || agendadoEm > prev.agendadoEm) {
        const crcTagId = resolveCrcTagId(a.CreateUserName)
        agendadorByPatient.set(pid0, { nome: a.CreateUserName, agendadoEm, crcTagId })
      }
    }
  }

  // Cards do painel com metadata.clinicorp_patient_id
  let cards = []
  for (let pg = 1; pg <= 20; pg++) {
    const page = await helena('GET', `/crm/v1/panel/card?PanelId=${clinic.panelId}&PageSize=100&PageNumber=${pg}`)
    cards = cards.concat(page.items ?? [])
    if (!page.hasMorePages) break
  }
  cards = cards.filter((c) => !c.archived && c.metadata?.clinicorp_patient_id)

  const plan = { troca: [], dedup: [], semMatch: 0, jaCorreto: 0 }
  for (const c of cards) {
    const pid = String(c.metadata.clinicorp_patient_id)
    const resolved = agendadorByPatient.get(pid)
    const cardTagIds = c.tagIds ?? []
    const crcTagsNoCard = cardTagIds.filter((t) => allCrcTagIds.has(t))

    if (!resolved || !resolved.crcTagId) {
      plan.semMatch++
      continue
    }
    const { crcTagId } = resolved
    const jaTemSoAResolvida = crcTagsNoCard.length === 1 && crcTagsNoCard[0] === crcTagId
    if (jaTemSoAResolvida) { plan.jaCorreto++; continue }

    const novoTagIds = [...cardTagIds.filter((t) => !allCrcTagIds.has(t)), crcTagId]
    const entry = { cardId: c.id, card: c.title, patientId: pid, crcNome: resolved.nome, crcTagId, antes: cardTagIds, depois: novoTagIds }
    if (crcTagsNoCard.length > 1) plan.dedup.push(entry)
    else plan.troca.push(entry)
  }

  console.log('=== DRY-RUN: fix-crc-tags-ibs ===')
  console.log(`cards com clinicorp_patient_id: ${cards.length}`)
  console.log(`já corretos: ${plan.jaCorreto}`)
  console.log(`sem match (não toca): ${plan.semMatch}`)
  console.log(`trocar etiqueta: ${plan.troca.length}`)
  console.log(`deduplicar (2+ tags de CRC): ${plan.dedup.length}`)
  console.log('\n--- exemplos (até 10) ---')
  for (const e of [...plan.troca, ...plan.dedup].slice(0, 10)) {
    console.log(`"${e.card}" (${e.crcNome}) — antes: [${e.antes.join(',')}] → depois: [${e.depois.join(',')}]`)
  }

  mkdirSync(new URL('out', import.meta.url), { recursive: true })
  writeFileSync(new URL('out/fix-crc-tags-ibs-plan.json', import.meta.url), JSON.stringify(plan, null, 2))
  console.log('\nPlano completo salvo em scripts/out/fix-crc-tags-ibs-plan.json')

  if (!APPLY) {
    console.log('\nDry-run apenas. Rode com --apply após revisar o plano para aplicar de fato.')
    return
  }

  console.log('\n=== APLICANDO ===')
  let applied = 0, failed = 0
  for (const e of [...plan.troca, ...plan.dedup]) {
    try {
      await helena('PUT', `/crm/v2/panel/card/${e.cardId}`, { fields: ['tagIds'], tagIds: e.depois })
      applied++
      console.log(`✅ "${e.card}" → ${e.crcNome}`)
    } catch (err) {
      failed++
      console.log(`❌ "${e.card}": ${err.message}`)
    }
    await sleep(250)
  }
  console.log(`\n=== ${applied} aplicado(s) · ${failed} falha(s) ===`)
}

main().catch((err) => { console.error('ERRO FATAL:', err.message); process.exit(1) })
