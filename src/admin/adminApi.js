const STORAGE_KEY = 'dashboard_admin_secret'

export function getSecret() {
  return sessionStorage.getItem(STORAGE_KEY) ?? ''
}

export function setSecret(secret) {
  sessionStorage.setItem(STORAGE_KEY, secret)
}

export function clearSecret() {
  sessionStorage.removeItem(STORAGE_KEY)
}

async function call(path, { method = 'GET', body, helenaToken } = {}) {
  const headers = { 'x-admin-secret': getSecret() }
  if (helenaToken) headers['x-helena-token'] = helenaToken
  if (body) headers['Content-Type'] = 'application/json'

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `Erro HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

export const listClinics  = () => call('/api/admin/clinics')
export const createClinic = (payload) => call('/api/admin/clinics', { method: 'POST', body: payload })
export const updateClinic = (payload) => call('/api/admin/clinics', { method: 'PUT', body: payload })
export const deleteClinic = (accountId) =>
  call(`/api/admin/clinics?accountId=${encodeURIComponent(accountId)}`, { method: 'DELETE' })

// auth: { helenaToken } (cadastro) ou { accountId } (edição — token vem do Supabase)
export const listPanels = ({ helenaToken, accountId } = {}) =>
  call(`/api/admin/panels${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''}`, { helenaToken })

export const getPanelSteps = ({ helenaToken, accountId } = {}, panelId) => {
  const params = new URLSearchParams({ panelId })
  if (accountId) params.set('accountId', accountId)
  return call(`/api/admin/panels?${params}`, { helenaToken })
}

export const getClinicorpDirectory = () => call('/api/admin/clinicorp-directory')

// Usuários (CRCs) cadastrados nas contas Clinicorp já configuradas no wizard —
// para o autocomplete do mapa CRC (etiqueta Helena → nome no Clinicorp).
export const getClinicorpUsers = (units) =>
  call('/api/admin/clinicorp-users', { method: 'POST', body: { units } })
