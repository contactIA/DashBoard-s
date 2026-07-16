// One-shot: adiciona a dimensão "Campanha" (steps._dims.campanha) na IBS
// (PLANO_AGENDADOR_CAMPANHA.md FASE 3.1) — corte por customField de valor
// livre (key 'campanha'), preenchido manualmente pelo usuário no painel.
// Faz MERGE em memória antes do PATCH — o JSONB `steps` é substituído
// inteiro pelo Supabase, então perder qualquer chave existente seria uma
// regressão silenciosa (mesmo padrão de scripts/configure-ibs-dates.mjs).
import { readFileSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const IBS_ACCOUNT_ID = '58e1700e-84e1-4d41-aaa9-2918925a3cef'

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
  const [row] = await sbGet(`/clinics?account_id=eq.${IBS_ACCOUNT_ID}&select=steps`)
  if (!row) throw new Error('IBS não encontrada.')
  const steps = row.steps

  steps._dims = {
    ...(steps._dims ?? {}),
    campanha: { label: 'Campanha', source: 'customFields.campanha' },
  }

  console.log('Prévia do que será salvo:')
  console.log('_dims.campanha:', JSON.stringify(steps._dims.campanha))

  await sbPatch(`/clinics?account_id=eq.${IBS_ACCOUNT_ID}`, { steps })
  console.log('\n=== SALVO ===')

  const [confirm] = await sbGet(`/clinics?account_id=eq.${IBS_ACCOUNT_ID}&select=steps`)
  console.log('_dims.campanha confirmado:', JSON.stringify(confirm.steps._dims.campanha))
  const metricSlugs = Object.keys(confirm.steps).filter(k => !k.startsWith('_'))
  console.log('steps de métrica preservados:', metricSlugs.length, metricSlugs.join(', '))
}

main().catch((err) => { console.error('ERRO FATAL:', err.message); process.exit(1) })
