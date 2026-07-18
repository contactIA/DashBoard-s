export async function fetchDashboard(accountId, accessToken) {
  const t = accessToken ? `&t=${encodeURIComponent(accessToken)}` : ''
  const res = await fetch(`/api/dashboard?accountId=${encodeURIComponent(accountId)}${t}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.error || `Erro HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}
