// EXECUTOR do plano de sincronização (out/sync-plan.json) → escreve na Helena.
// Uso:
//   node apply.js --limit 1          # executa só o 1º move e o 1º create (teste)
//   node apply.js --only moves       # só movimentações
//   node apply.js                    # plano completo
// Cada ação vira uma linha em out/apply-log.json (auditoria/reversão).
import { readFileSync, writeFileSync } from 'node:fs'

for (const line of readFileSync(new URL('.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const HELENA = 'https://api.wts.chat'
const AUTH = { Authorization: `Bearer ${process.env.HELENA_TOKEN}`, 'Content-Type': 'application/json' }

const args = process.argv.slice(2)
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity
const only  = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

const plan = JSON.parse(readFileSync(new URL('out/sync-plan.json', import.meta.url), 'utf8'))
const log = []
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// "2026-06-16" → "16/06/2026" — formato exibido nos campos "Data do Agendamento"
// do card Helena (campos personalizados "data"/"hor-rio" do painel da Lumine).
function fmtDateBR(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

async function helena(method, path, body) {
  const res = await fetch(`${HELENA}${path}`, {
    method, headers: AUTH, body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 250)}`)
    err.status = res.status
    throw err
  }
  return json
}

// contato por telefone: acha ou cria (para o card novo já nascer vinculado)
async function findOrCreateContact(nome, telefone, patientId) {
  const digits = String(telefone ?? '').replace(/\D/g, '')
  if (!digits) return null
  const candidates = digits.startsWith('55') ? [digits, digits.slice(2)] : [`55${digits}`, digits]
  for (const c of candidates) {
    try {
      const ct = await helena('GET', `/core/v1/contact/phonenumber/${encodeURIComponent(c)}`)
      if (ct?.id) return { id: ct.id, created: false }
    } catch (err) {
      // Helena devolve 500 + "Contato não encontrado" (FORM_ERROR) quando não existe
      const naoEncontrado = /não encontrado|FORM_ERROR/i.test(err.message)
      if (err.status !== 404 && err.status !== 400 && !naoEncontrado) throw err
    }
    await sleep(150)
  }
  const created = await helena('POST', '/core/v1/contact', {
    name: nome,
    phoneNumber: `+${candidates[0]}`,
    metadata: { clinicorp_patient_id: String(patientId ?? '') },
  })
  return created?.id ? { id: created.id, created: true } : null
}

// ── 1. MOVES ─────────────────────────────────────────────────────────────────
let moved = 0, created = 0, failed = 0
if (only !== 'creates') {
  for (const m of plan.moves.slice(0, limit)) {
    try {
      // clinicorp_event_date é a data REAL do fato (fechou/faltou/desmarcou em
      // <quando>) — sem ela o dashboard atribui o valor ao dia em que o robô
      // rodou (updatedAt=hoje), não ao dia em que aconteceu de verdade.
      const body = {
        metadata: {
          clinicorp_patient_id: String(m.clinicorpPatientId ?? ''),
          ...(m.quando ? { clinicorp_event_date: m.quando } : {}),
        },
      }
      const fields = ['metadata']
      if (m.stepAlvoId && m.stepAlvoId !== undefined) { body.stepId = m.stepAlvoId; fields.push('stepId') }
      if (m.valor > 0) { body.monetaryAmount = m.valor; fields.push('monetaryAmount') }
      if (m.quando) {
        body.customFields = { data: fmtDateBR(m.quando), ...(m.time ? { 'hor-rio': m.time } : {}) }
        fields.push('customFields')
      }
      body.fields = fields
      await helena('PUT', `/crm/v2/panel/card/${m.cardId}`, body)
      moved++
      log.push({ acao: 'move', ok: true, card: m.card, de: m.stepAtual, para: m.stepAlvo, valor: m.valor ?? null, quando: m.quando ?? null, motivo: m.motivo, cardId: m.cardId })
      console.log(`✅ MOVIDO  "${m.card}"  ${m.stepAtual} → ${m.stepAlvo}${m.valor ? ` · R$ ${m.valor}` : ''}`)
    } catch (err) {
      failed++
      log.push({ acao: 'move', ok: false, card: m.card, erro: err.message })
      console.log(`❌ move "${m.card}": ${err.message}`)
    }
    await sleep(300)
  }
}

// ── 2. CREATES ───────────────────────────────────────────────────────────────
if (only !== 'moves') {
  for (const c of plan.creates.slice(0, limit)) {
    try {
      const contact = await findOrCreateContact(c.nome, c.telefone, c.clinicorpPatientId)
      await sleep(200)
      const body = {
        stepId: c.stepId,
        title: c.nome,
        ...(contact ? { contactIds: [contact.id] } : {}),
        ...(c.valor > 0 ? { monetaryAmount: c.valor } : {}),
        ...(c.quando ? { dueDate: `${c.quando}T15:00:00.000Z` } : {}),
        ...(c.quando ? { customFields: { data: fmtDateBR(c.quando), ...(c.time ? { 'hor-rio': c.time } : {}) } } : {}),
        metadata: {
          clinicorp_patient_id: String(c.clinicorpPatientId ?? ''),
          clinicorp_origem: c.motivo,
          ...(c.quando ? { clinicorp_event_date: c.quando } : {}),
        },
      }
      const card = await helena('POST', '/crm/v1/panel/card', body)
      created++
      log.push({ acao: 'create', ok: true, nome: c.nome, step: c.step, valor: c.valor ?? null, quando: c.quando ?? null, motivo: c.motivo, cardId: card?.id ?? null, contactId: contact?.id ?? null, contatoCriado: contact?.created ?? false })
      console.log(`✅ CRIADO  "${c.nome}" → ${c.step}${c.valor ? ` · R$ ${c.valor}` : ''}${contact?.created ? ' (contato novo)' : ''}`)
    } catch (err) {
      failed++
      log.push({ acao: 'create', ok: false, nome: c.nome, erro: err.message })
      console.log(`❌ create "${c.nome}": ${err.message}`)
    }
    await sleep(300)
  }
}

// Acumula histórico entre execuções (cada rodada do sync some do log anterior
// se sobrescrever — importante para auditoria/backfill de rodadas passadas).
const logPath = new URL('out/apply-log.json', import.meta.url)
let previous = []
try { previous = JSON.parse(readFileSync(logPath, 'utf8')) } catch {}
writeFileSync(logPath, JSON.stringify([...previous, ...log], null, 2))
console.log(`\n=== RESULTADO: ${moved} movidos · ${created} criados · ${failed} falhas ===`)
console.log(`Log completo (acumulado, ${previous.length + log.length} entradas): out/apply-log.json`)
