// Cliente mínimo da API pública Clinicorp (Basic Auth).
// Docs: ../Documentação/clinicorp-api-docs/
const BASE = 'https://api.clinicorp.com/rest/v1'

export function makeClient({ user, token, subscriberId }) {
  const auth = 'Basic ' + Buffer.from(`${user}:${token}`).toString('base64')

  async function get(path, params = {}) {
    const qs = new URLSearchParams({ subscriber_id: subscriberId, ...params })
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
    statusList:  ()                 => get('/appointment/status_list'),
    categories:  ()                 => get('/appointment/list_categories'),
    appointments:(from, to, extra)  => get('/appointment/list', { from, to, ...extra }),
    appointment: (id)               => get('/appointment/get_appointment', { appointmentId: id }),
    estimates:   (from, to, extra)  => get('/estimates/list', { from, to, ...extra }),
    estimate:    (id)               => get('/estimates/get', { estimateId: id }),
    patient:     (id)               => get('/patient/get', { patientId: id }),
    patientEstimates: (id)          => get('/patient/list_estimates', { patientId: id }),
    subscribersClinics: ()          => get('/group/list_subscribers_clinics'),
  }
}
