export async function fetchDashboard(accountId) {
  const res = await fetch(`/api/dashboard?accountId=${encodeURIComponent(accountId)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Erro HTTP ${res.status}`)
  }
  return res.json()
}
