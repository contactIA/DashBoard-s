// Cliente mínimo da API pública Clinicorp (Basic Auth). Portado do protótipo
// em PROJETO CLINICORP + PAINEL/sync-prototype/clinicorp.js.
const BASE = 'https://api.clinicorp.com/rest/v1'

export function makeClinicorpClient({ user, token, subscriberId }) {
  const auth = 'Basic ' + Buffer.from(`${user}:${token}`).toString('base64')

  async function get(path, params = {}) {
    const qs = new URLSearchParams({ subscriber_id: subscriberId ?? user, ...params })
    const res = await fetch(`${BASE}${path}?${qs}`, {
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
    })
    const body = await res.text()
    if (!res.ok) {
      const err = new Error(`Clinicorp ${res.status} em ${path}: ${body.slice(0, 300)}`)
      err.status = res.status
      throw err
    }
    try { return JSON.parse(body) } catch { return body }
  }

  return {
    statusList:   ()                => get('/appointment/status_list'),
    appointments: (from, to, extra) => get('/appointment/list', { from, to, ...extra }),
    estimates:    (from, to, extra) => get('/estimates/list', { from, to, ...extra }),
  }
}
