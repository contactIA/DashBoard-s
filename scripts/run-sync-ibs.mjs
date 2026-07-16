// One-shot: roda o motor de sync (src/server/clinicorpSync.js) para a IBS,
// sem esperar a próxima rodada do cron (PLANO_CRON_DATAS.md PASSO 3).
import { readFileSync } from 'node:fs'
import { syncClinicClinicorp } from '../src/server/clinicorpSync.js'

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const IBS_ACCOUNT_ID = '58e1700e-84e1-4d41-aaa9-2918925a3cef'

async function main() {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/clinics?account_id=eq.${IBS_ACCOUNT_ID}&select=account_id,name,panel_id,token,steps`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
  })
  const [row] = await res.json()
  const clinic = { accountId: row.account_id, name: row.name, panelId: row.panel_id, token: row.token, steps: row.steps }

  console.log(`Sincronizando ${clinic.name}...`)
  const summary = await syncClinicClinicorp(clinic)
  console.log('\n=== RESUMO ===')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => { console.error('ERRO FATAL:', err.message); process.exit(1) })
