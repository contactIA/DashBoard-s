// Datas no fuso do Brasil (UTC-3 fixo — sem horário de verão desde 2019).
// new Date().toISOString() é UTC: depois das 21h em Brasília o "hoje" pularia
// para amanhã, quebrando "Próximos Atendimentos" e os filtros rápidos (7d/30d…).
const BR_OFFSET_MS = 3 * 60 * 60 * 1000

export function todayBR() {
  return new Date(Date.now() - BR_OFFSET_MS).toISOString().slice(0, 10)
}

export function daysAgoBR(n) {
  return new Date(Date.now() - BR_OFFSET_MS - n * 86_400_000).toISOString().slice(0, 10)
}
