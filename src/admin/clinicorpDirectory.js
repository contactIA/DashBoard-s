// Sem dados sensíveis aqui — a planilha real (token, usuário API, etc. da
// frota) vive só em CLINICORP_DIRECTORY_JSON no .env do servidor / env var da
// Vercel, nunca no bundle do frontend nem no repositório. Ver
// api/admin/clinicorp-directory.js.

/** Um token real do Clinicorp é um UUID — "google agenda"/"controle odonto"/etc. não são. */
export function hasClinicorp(row) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(row.token ?? '').trim())
}
