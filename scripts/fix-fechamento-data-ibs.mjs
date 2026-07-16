// One-shot: saneamento dos fechados da IBS (PLANO_AGENDADOR_CAMPANHA.md 2.3).
// Para cards em step `converted` com `metadata.clinicorp_event_date` (fato do
// Clinicorp: e.Date do orçamento aprovado), compara com `customFields[<agendado-para>]`
// atual. Lista divergências — cards SEM clinicorp_event_date (fechados manuais,
// sem orçamento no Clinicorp) NUNCA são tocados.
//
// Uso:
//   node scripts/fix-fechamento-data-ibs.mjs            → dry-run (só relatório)
//   node scripts/fix-fechamento-data-ibs.mjs --apply     → aplica de fato (após revisar o dry-run)
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const IBS_ACCOUNT_ID = '58e1700e-84e1-4d41-aaa9-2918925a3cef'
const HELENA = 'https://api.wts.chat'
const APPLY = process.argv.includes('--apply')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function isoLocal(dateStr, timeStr) {
  if (!dateStr) return null
  const hhmm = timeStr && /^\d{1,2}:\d{2}$/.test(timeStr) ? timeStr.padStart(5, '0') : '00:00'
  return `${dateStr}T${hhmm}:00.0000000`
}

async function sbGet(path) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase GET ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res.json()
}

function fieldValue(cf, key) {
  const v = cf?.[key]
  return Array.isArray(v) ? v[0] ?? null : v ?? null
}

async function main() {
  const [row] = await sbGet(`/clinics?account_id=eq.${IBS_ACCOUNT_ID}&select=account_id,name,panel_id,token,steps`)
  if (!row) throw new Error('IBS não encontrada.')
  const steps = row.steps ?? {}
  const dateCfg = steps._dates ?? null
  const sfKey = dateCfg?.scheduledFor?.key
  if (!sfKey) throw new Error('IBS sem steps._dates.scheduledFor configurado — nada a comparar.')

  // stepId(s) mapeados como type 'converted' (FECHOU)
  const convertedStepIds = new Set(
    Object.entries(steps).filter(([k, s]) => !k.startsWith('_') && s?.type === 'converted' && s?.id).map(([, s]) => s.id)
  )
  if (!convertedStepIds.size) throw new Error('Nenhuma etapa mapeada como converted (FECHOU) no /setup da IBS.')

  const rawToken = String(row.token ?? '').trim()
  const helenaAuth = { Authorization: /^bearer /i.test(rawToken) ? rawToken : `Bearer ${rawToken}` }
  async function helena(method, path, body) {
    const res = await fetch(`${HELENA}${path}`, {
      method, headers: { ...helenaAuth, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
    try { return JSON.parse(text) } catch { return null }
  }

  let cards = []
  for (let pg = 1; pg <= 20; pg++) {
    const page = await helena('GET', `/crm/v1/panel/card?PanelId=${row.panel_id}&PageSize=100&PageNumber=${pg}&IncludeDetails=CustomFields`)
    cards = cards.concat(page.items ?? [])
    if (!page.hasMorePages) break
  }
  const fechados = cards.filter((c) => !c.archived && convertedStepIds.has(c.stepId))

  const plan = { divergentes: [], semEventDate: 0, jaCorretos: 0 }
  for (const c of fechados) {
    const eventDate = c.metadata?.clinicorp_event_date ?? null
    if (!eventDate) { plan.semEventDate++; continue } // fechado manual sem orçamento no Clinicorp — não toca

    // Compara só a DATA (YYYY-MM-DD) — a regra do fechamento substitui o dia
    // do "Agendado Para" pelo dia do fechamento; a hora original da consulta
    // não é parte do que a regra pede para corrigir (e.Date não tem hora).
    const atualRaw = String(fieldValue(c.customFields, sfKey) ?? '').replace(/\//g, '-')
    const atualData = atualRaw.slice(0, 10)
    if (atualData === eventDate) { plan.jaCorretos++; continue }

    const atualHora = (atualRaw.match(/T(\d{2}:\d{2})/) ?? [])[1] ?? null
    const desejado = isoLocal(eventDate, atualHora) // preserva a hora original da consulta, troca só o dia
    plan.divergentes.push({ cardId: c.id, card: c.title, eventDate, atual: fieldValue(c.customFields, sfKey), desejado })
  }

  console.log('=== DRY-RUN: fix-fechamento-data-ibs ===')
  console.log(`cards fechados (converted): ${fechados.length}`)
  console.log(`sem clinicorp_event_date (não toca): ${plan.semEventDate}`)
  console.log(`já corretos: ${plan.jaCorretos}`)
  console.log(`divergentes: ${plan.divergentes.length}`)
  console.log('\n--- exemplos (até 15) ---')
  for (const e of plan.divergentes.slice(0, 15)) {
    console.log(`"${e.card}" — event_date=${e.eventDate} · atual="${e.atual}" → desejado="${e.desejado}"`)
  }

  mkdirSync(new URL('out', import.meta.url), { recursive: true })
  writeFileSync(new URL('out/fix-fechamento-data-ibs-plan.json', import.meta.url), JSON.stringify(plan, null, 2))
  console.log('\nPlano completo salvo em scripts/out/fix-fechamento-data-ibs-plan.json')

  if (!APPLY) {
    console.log('\nDry-run apenas. Rode com --apply após revisar o plano para aplicar de fato.')
    return
  }

  console.log('\n=== APLICANDO ===')
  let applied = 0, failed = 0
  for (const e of plan.divergentes) {
    try {
      // MERGE confirmado (2.2): reenviar só sfKey não afeta agendado-em- nem outros campos.
      await helena('PUT', `/crm/v2/panel/card/${e.cardId}`, { fields: ['customFields'], customFields: { [sfKey]: e.desejado } })
      applied++
      console.log(`✅ "${e.card}" → ${e.desejado}`)
    } catch (err) {
      failed++
      console.log(`❌ "${e.card}": ${err.message}`)
    }
    await sleep(250)
  }
  console.log(`\n=== ${applied} aplicado(s) · ${failed} falha(s) ===`)
}

main().catch((err) => { console.error('ERRO FATAL:', err.message); process.exit(1) })
