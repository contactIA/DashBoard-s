// One-shot REUTILIZÁVEL: adiciona a dimensão "Campanha" (steps._dims.campanha,
// source customFields.<key>) a uma clínica — generalização do antigo
// configure-ibs-campaign.mjs para qualquer clínica nova (ex: Clinica Liss).
// Faz MERGE em memória antes do PATCH — o JSONB `steps` é substituído inteiro
// pelo Supabase, então perder qualquer chave existente seria regressão silenciosa.
//
// Uso:
//   node scripts/configure-campaign-dim.mjs <accountId> [customFieldKey]
//   (customFieldKey default: 'campanha')
import { readFileSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const ACCOUNT_ID = process.argv[2]
const FIELD_KEY = process.argv[3] || 'campanha'
if (!ACCOUNT_ID) { console.error('Uso: node scripts/configure-campaign-dim.mjs <accountId> [customFieldKey]'); process.exit(1) }

async function sbGet(path) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`Supabase GET ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res.json()
}

async function sbPatch(path, body) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1${path}`, {
    method: 'PATCH',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Supabase PATCH ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res.json()
}

async function main() {
  const [row] = await sbGet(`/clinics?account_id=eq.${ACCOUNT_ID}&select=name,steps`)
  if (!row) throw new Error(`Clínica ${ACCOUNT_ID} não encontrada.`)
  const steps = row.steps

  const existing = Object.entries(steps._dims ?? {}).find(([, d]) => String(d.source ?? '').startsWith('customFields.'))
  if (existing) {
    console.log(`${row.name} JÁ tem dimensão de campanha: ${existing[0]} → ${existing[1].source}. Nada a fazer.`)
    return
  }

  steps._dims = {
    ...(steps._dims ?? {}),
    campanha: { label: 'Campanha', source: `customFields.${FIELD_KEY}` },
  }

  console.log(`Clínica: ${row.name}`)
  console.log('Prévia: _dims.campanha =', JSON.stringify(steps._dims.campanha))

  await sbPatch(`/clinics?account_id=eq.${ACCOUNT_ID}`, { steps })
  console.log('=== SALVO ===')

  const [confirm] = await sbGet(`/clinics?account_id=eq.${ACCOUNT_ID}&select=steps`)
  console.log('confirmado:', JSON.stringify(confirm.steps._dims.campanha))
  const metricSlugs = Object.keys(confirm.steps).filter(k => !k.startsWith('_'))
  console.log('steps de métrica preservados:', metricSlugs.length, metricSlugs.join(', '))
  console.log('_dims completo:', Object.keys(confirm.steps._dims).join(', '))
}

main().catch((err) => { console.error('ERRO FATAL:', err.message); process.exit(1) })
