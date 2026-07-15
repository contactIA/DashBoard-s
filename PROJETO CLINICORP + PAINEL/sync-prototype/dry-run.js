// DRY-RUN do sync Clinicorp → Painel Helena.
// NÃO escreve nada em lugar nenhum: só lê a Clinicorp e mostra o que faria.
// Credenciais em .env (CLINICORP_USER, CLINICORP_TOKEN, CLINICORP_SUBSCRIBER).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { makeClient } from './clinicorp.js'

// .env manual (sem dependência): KEY=VALUE por linha
for (const line of readFileSync(new URL('.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const client = makeClient({
  user:         process.env.CLINICORP_USER,
  token:        process.env.CLINICORP_TOKEN,
  subscriberId: process.env.CLINICORP_SUBSCRIBER,
})

const iso = (d) => d.toISOString().slice(0, 10)
const today = new Date()
const from  = iso(new Date(today.getTime() - 30 * 86_400_000))
const to    = iso(new Date(today.getTime() + 15 * 86_400_000))

console.log(`\n=== DRY-RUN Clinicorp (${process.env.CLINICORP_SUBSCRIBER}) · ${from} → ${to} ===\n`)

async function safe(label, fn) {
  try {
    const data = await fn()
    console.log(`✅ ${label}`)
    return data
  } catch (err) {
    console.log(`❌ ${label} → ${err.message}`)
    return null
  }
}

const statuses = await safe('appointment/status_list', () => client.statusList())
if (statuses) console.log('   STATUS DISPONÍVEIS:', JSON.stringify(statuses).slice(0, 600), '\n')

const appts = await safe('appointment/list (com canceladas)', () =>
  client.appointments(from, to, { IncludeCanceled: 'true' }))
if (appts) {
  const list = Array.isArray(appts) ? appts : appts.items ?? appts.list ?? []
  console.log(`   ${list.length} agendamentos no período`)
  // distribuição por status — o coração do mapeamento status → step
  const byStatus = {}
  for (const a of list) {
    const s = a.Status ?? a.status ?? a.AppointmentStatus ?? '(sem campo Status)'
    byStatus[s] = (byStatus[s] ?? 0) + 1
  }
  console.log('   POR STATUS:', JSON.stringify(byStatus, null, 2))
  console.log('   AMOSTRA (2):', JSON.stringify(list.slice(0, 2), null, 1).slice(0, 1500), '\n')
  mkdirSync(new URL('out/', import.meta.url), { recursive: true })
  writeFileSync(new URL('out/appointments.json', import.meta.url), JSON.stringify(list, null, 2))
  console.log('   → salvo em out/appointments.json\n')
}

const ests = await safe('estimates/list', () => client.estimates(from, to))
if (ests) {
  const list = Array.isArray(ests) ? ests : ests.items ?? ests.list ?? []
  console.log(`   ${list.length} orçamentos no período`)
  console.log('   AMOSTRA (2):', JSON.stringify(list.slice(0, 2), null, 1).slice(0, 1500), '\n')
  writeFileSync(new URL('out/estimates.json', import.meta.url), JSON.stringify(list, null, 2))
  console.log('   → salvo em out/estimates.json\n')
}

await safe('group/list_subscribers_clinics', async () => {
  const g = await client.subscribersClinics()
  console.log('   CLÍNICAS:', JSON.stringify(g).slice(0, 400))
  return g
})

console.log('\n=== fim do dry-run (nada foi escrito na Helena) ===')
