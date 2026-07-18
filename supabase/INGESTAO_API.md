# Descoberta da API Helena — GET /crm/v1/panel/card

> FASE A0 do PLANO_INGESTAO_E_PROCESSO.md. Rodada em 18/07/2026 contra o
> painel da Salutar (`09e6e9bb-...`, 908 cards / 184 páginas com PageSize=5)
> via `scripts/discover-helena-api.mjs` + sondas extras com data futura.

## Resultados testados (não assumidos)

| Teste | Resultado | Evidência |
|---|---|---|
| `UpdatedAfter` / `UpdatedAtAfter` / `MinUpdatedAt` | ❌ **IGNORADOS em silêncio** | com data **futura** (2100-01-01) devolvem as mesmas 184 páginas — se filtrassem, seria 0 |
| `OrderBy=UpdatedAt` | ❌ **rejeitado com 500** FORM_ERROR | enum validado (mesmo padrão do IncludeDetails) |
| `SortBy=UpdatedAt` | ❌ ignorado | 200, mas mesma ordem do baseline e itens fora de ordem de updatedAt |
| `StepId=<id>` | ✅ **FILTRA DE VERDADE** | 184 → 14 páginas |
| `PageSize` | máximo **100** | 200 e 500 → HTTP 500 |
| Rate limit | folgado | 20 chamadas seguidas sem 429 |

⚠ Comportamento MISTO da validação (pegadinha dupla): parâmetro de filtro
desconhecido é **ignorado em silêncio** (parece funcionar e não funciona),
mas valor desconhecido em `OrderBy`/`IncludeDetails`/`PageSize` **derruba com
500**. Nunca concluir nada sem testar com caso que diferencie (ex: data futura).

## Estratégia escolhida

- [ ] 1. `UpdatedAfter` → incremental de verdade — **indisponível**
- [ ] 2. Ordenação por UpdatedAt + parada antecipada — **indisponível**
- [ ] 3. `StepId` das etapas ativas + full diária — disponível, adiado
- [x] **4. Varredura completa por clínica no cron (horária)** ← ESCOLHIDA

Justificativa: com PageSize=100, 908 cards = ~10 chamadas/hora por clínica —
custo desprezível PARA UM CRON (o problema de escala era a function do
dashboard paginando na frente do cliente, e isso a ingestão elimina).
A opção 3 (`StepId` só das etapas ativas + varredura completa diária) fica
como otimização documentada para quando algum painel passar de ~5k cards —
o filtro já foi validado e funciona.

Implementação: `src/server/cardsIngest.js` + `api/cron/ingest-cards.js` +
`.github/workflows/ingest-cards.yml` (horária aos :22, fora dos :07/:37 do
sync Clinicorp — fotografa o painel já atualizado pelo sync).
