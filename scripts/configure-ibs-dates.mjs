// One-shot: configura _dates/_extract/crcMap da IBS no Supabase (PLANO_CRON_DATAS.md
// PASSO 2). Faz MERGE em memória antes do PATCH — o JSONB `steps` é substituído
// inteiro pelo Supabase, então perder qualquer chave existente (token, syncSince,
// tagId, steps de métrica, _dims, _funnel) seria uma regressão silenciosa.
import { readFileSync } from 'node:fs'

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const IBS_ACCOUNT_ID = '58e1700e-84e1-4d41-aaa9-2918925a3cef'
const GABI_TAG_ID = 'b50e2155-22e9-49aa-b882-990a45ecf0d9' // confirmado via GET /crm/v1/panel real

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
  const steps = row.steps // objeto completo — vamos só ADICIONAR/AJUSTAR chaves nele

  // _dates: keys já usadas nos customFields reais do painel (confirmado no /setup)
  steps._dates = {
    scheduledFor: { key: 'agendado-para' },
    createdAt:    { key: 'agendado-em-' },
  }

  // _extract: preserva name/phone existentes; ajusta date/scheduledAt/time
  steps._extract = {
    ...(steps._extract ?? {}),
    date: [
      { from: 'customFields.agendado-para', regex: '', format: 'YMD' },
      { from: 'dueDate' }, // fallback para cards antigos sem o campo novo
    ],
    scheduledAt: [
      { from: 'customFields.agendado-em-', regex: '', format: 'YMD' },
    ],
    time: [
      { from: 'customFields.agendado-para', regex: '(\\d{1,2}:\\d{2})' },
    ],
  }

  // crcMap POR UNIDADE — só GABI confirmada pelo usuário. Demais etiquetas
  // (FLÁVIA, RITA, Naiara, AGENDAMENTO IA) ficam sem vínculo até confirmação.
  const units = steps._clinicorp.units.map(u => {
    if (u.label === 'Bueno') {
      return { ...u, crcMap: [{ tagId: GABI_TAG_ID, tagName: 'GABI', clinicorpName: 'Gabriela Vieira Da Silva' }] }
    }
    if (u.label === 'Eldorado') {
      return { ...u, crcMap: [{ tagId: GABI_TAG_ID, tagName: 'GABI', clinicorpName: 'Gabriela Vieira' }] }
    }
    return u
  })
  steps._clinicorp = { ...steps._clinicorp, units }

  console.log('Prévia do que será salvo:')
  console.log('_dates:', JSON.stringify(steps._dates))
  console.log('_extract.date:', JSON.stringify(steps._extract.date))
  console.log('_extract.scheduledAt:', JSON.stringify(steps._extract.scheduledAt))
  console.log('_extract.time:', JSON.stringify(steps._extract.time))
  console.log('units crcMap:', JSON.stringify(units.map(u => ({ label: u.label, crcMap: u.crcMap ?? null }))))

  const [updated] = await sbPatch(`/clinics?account_id=eq.${IBS_ACCOUNT_ID}`, { steps })
  console.log('\n=== SALVO ===')

  // Reler para confirmar
  const [confirm] = await sbGet(`/clinics?account_id=eq.${IBS_ACCOUNT_ID}&select=steps`)
  console.log('_dates confirmado:', JSON.stringify(confirm.steps._dates))
  console.log('scheduledAt confirmado:', JSON.stringify(confirm.steps._extract.scheduledAt))
  console.log('crcMap confirmado:', JSON.stringify(confirm.steps._clinicorp.units.map(u => ({ label: u.label, crcMap: u.crcMap ?? null }))))
  // Sanidade: chaves de métrica e token continuam intactos
  const metricSlugs = Object.keys(confirm.steps).filter(k => !k.startsWith('_'))
  console.log('steps de métrica preservados:', metricSlugs.length, metricSlugs.join(', '))
}

main().catch((err) => { console.error('ERRO FATAL:', err.message); process.exit(1) })
