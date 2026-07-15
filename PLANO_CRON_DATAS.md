# Plano de ação — Cron gravando "Agendado em"/"Agendado Para" + acerto do painel IBS

> **Para o executor (Sonnet 5):** siga EXATAMENTE esta ordem. Não improvise.
> Todo o CÓDIGO necessário já está pronto e em produção (commits `ad69211`,
> `f49339f`) — este plano é quase todo CONFIGURAÇÃO + DADOS. Não altere os
> arquivos do motor de sync, do funil ou do wizard, salvo o que estiver
> explicitamente escrito aqui (spoiler: nada).

## Contexto verificado no banco em 15/07/2026 (não assumir — foi conferido)

| Item | Estado real | Consequência |
|---|---|---|
| Cron | GitHub Actions `7 * * * *` — **a cada hora, aos :07** (um job por clínica, `max-parallel: 4`) | ok, NÃO mudar |
| `steps._dates` da IBS | **null** | cron roda em modo LEGADO: cria/move cards com keys `data`/`hor-rio`, sem "Agendado Para"/"Agendado em" → dash errado |
| `steps._extract.date` da IBS | já lê `customFields.agendado-para` (YMD) | ok, mas sem fallback `dueDate` |
| `steps._extract.scheduledAt` da IBS | **null** | funil "Agendaram" sem fonte — cai no fallback por data efetiva |
| `steps._extract.time` da IBS | regex em `description` | deve ler a hora do próprio `agendado-para` |
| `units[].crcMap` da IBS | **null** nas duas unidades | cards criados pelo sync ficam sem etiqueta de CRC |
| Tabela `sync_log` no Supabase | **NÃO EXISTE** (PGRST205) | auditoria do cron falhando em silêncio (best-effort — sync não é afetado) |
| Backfill dos 138 cards | ✅ aplicado 15/07 (139/174 com os 2 campos) | cards criados pelo cron DEPOIS do backfill (modo legado) podem estar sem os campos |

## O que o usuário decidiu (NÃO reabrir)

- Formato de escrita: ISO local `AAAA-MM-DDTHH:MM:00.0000000` (string simples;
  a Helena empacota em array e, no `agendado-em-`, reformata com barras — o
  `normalizeDate` já aceita `-` e `/`, commit `f49339f`).
- Mapa CRC é POR UNIDADE. Vínculo confirmado pelo usuário para a GABI:
  - Bueno → `Gabriela Vieira Da Silva`
  - Eldorado → `Gabriela Vieira`
  - Demais etiquetas (FLÁVIA, RITA, Naiara, AGENDAMENTO IA (IASMIN)): o usuário
    ainda NÃO confirmou os nomes — deixar SEM vínculo (o sync lista em
    `unmatchedCrc` para revisão; NUNCA adivinhar).
- `dueDate` não recebe mais a data da consulta (o motor já não escreve).

---

## PASSO 1 — Criar a tabela `sync_log` (bloqueio de auditoria)

O arquivo `supabase/sync_log.sql` já existe no repo. **DDL não roda via REST**
com service key — precisa do SQL Editor do Supabase (ação do USUÁRIO) ou do
MCP do Supabase se disponível na sessão.

- Se o MCP `Supabase` estiver conectado: rodar o conteúdo de
  `supabase/sync_log.sql` via `apply_migration`/`execute_sql`.
- Senão: pedir ao usuário para colar `supabase/sync_log.sql` no SQL Editor e
  rodar (ele achou que já tinha feito — não está criada; conferir depois com
  `GET /rest/v1/sync_log?limit=1`, deve devolver `[]` e não PGRST205).

## PASSO 2 — Configurar a IBS no Supabase (script, com MERGE — nunca substituir)

Escrever um script one-shot `scripts/configure-ibs-dates.mjs` que:

1. Lê a linha atual: `GET /rest/v1/clinics?account_id=eq.58e1700e-84e1-4d41-aaa9-2918925a3cef&select=steps`.
2. Faz **merge em memória** (preservando TODAS as chaves existentes — steps de
   métrica, `_dims`, `_funnel`, `_clinicorp.units[].token/tagId/syncSince`):
   ```js
   steps._dates = {
     scheduledFor: { key: 'agendado-para' },
     createdAt:    { key: 'agendado-em-' },
   }
   steps._extract.date = [
     { from: 'customFields.agendado-para', regex: '', format: 'YMD' },
     { from: 'dueDate' },                       // fallback p/ cards antigos sem o campo
   ]
   steps._extract.scheduledAt = [
     { from: 'customFields.agendado-em-', regex: '', format: 'YMD' },
   ]
   steps._extract.time = [
     { from: 'customFields.agendado-para', regex: '(\\d{1,2}:\\d{2})' },
   ]
   // crcMap POR UNIDADE — SÓ a GABI (confirmada). tagId da GABI: buscar nas
   // tags do painel via GET /crm/v1/panel/{id}?IncludeDetails=Tags (name "GABI").
   units.find(u => u.label === 'Bueno').crcMap    = [{ tagId: <GABI>, tagName: 'GABI', clinicorpName: 'Gabriela Vieira Da Silva' }]
   units.find(u => u.label === 'Eldorado').crcMap = [{ tagId: <GABI>, tagName: 'GABI', clinicorpName: 'Gabriela Vieira' }]
   ```
3. `PATCH /rest/v1/clinics?account_id=eq.<IBS>` com `{ steps }` completo
   (JSONB é substituído inteiro — por isso o merge em memória é obrigatório).
4. Reler e imprimir `_dates`/`_extract.scheduledAt`/`crcMap` para confirmar.

> ⚠️ NUNCA tocar em `token`, `panel_id`, `slug`, `ticket`, `syncSince`,
> `tagId` das unidades, steps de métrica, `_dims`, `_funnel`.

## PASSO 3 — Sync manual da IBS + verificação

1. Rodar o motor localmente (não esperar o cron):
   ```js
   // scripts/run-sync-ibs.mjs — carrega a linha da IBS do Supabase (token real)
   // e chama syncClinicClinicorp(clinic); imprime o summary.
   ```
2. Conferir no summary: `moved`/`created` sem erros novos; `unmatchedCrc` deve
   listar os nomes de CRC ainda não mapeados (esperado — só GABI está no mapa).
3. Reler 2-3 cards movidos/criados na Helena e confirmar:
   - `customFields['agendado-para']` = data+hora da consulta (ISO);
   - `customFields['agendado-em-']` = data de criação do agendamento;
   - `dueDate` NÃO foi (re)escrito;
   - card novo de agendamento da Gabi tem a etiqueta GABI.

## PASSO 4 — Re-rodar o backfill (pegar os cards do intervalo legado)

Cards criados pelo cron entre o backfill de 15/07 e o PASSO 2 nasceram em modo
legado (keys `data`/`hor-rio`, sem os campos novos). O script já existe e é
idempotente:

```
node scripts/backfill-ibs-dates.mjs          # dry-run — ver quantos sobraram
node scripts/backfill-ibs-dates.mjs --apply  # só após conferir o relatório
```

- A fonte A (legado `data`/`hor-rio`) captura exatamente esses cards.
- Cards que já têm `agendado-para` são reescritos com o mesmo dado (inofensivo).

## PASSO 5 — Verificação final (dash certo)

1. `GET /api/dashboard?clinic=58e1700e-...` (dev server local):
   - `scheduledAt` preenchido nos cards que têm `agendado-em-`;
   - `date` vindo de `agendado-para`;
   - contar: cards com `scheduledAt` ≥ 139 (backfill) + os do PASSO 3/4.
2. Funil: barra "Agendaram" contando pela janela de `scheduledAt`
   (`computeFunnel` → `scheduledInPeriod`), topo pela criação do card.
3. Na PRÓXIMA rodada do cron (hh:07), conferir `sync_log` (PASSO 1) com a linha
   da IBS e conferir na Helena que os cards mexidos pelo cron têm os 2 campos.

## PASSO 6 — Commit/push

- Commitar os scripts novos (`configure-ibs-dates.mjs`, `run-sync-ibs.mjs`) e
  qualquer ajuste, com sanity-check de segredos antes (grep dos tokens
  conhecidos). Push só após aprovação do usuário.

## Perguntas em aberto para o usuário (não bloqueiam os passos 1-2)

1. Nomes no Clinicorp de FLÁVIA, RITA, Naiara e AGENDAMENTO IA (IASMIN), por
   unidade — para completar o `crcMap` (usar o autocomplete do /setup, que já
   funciona sem 401, ou informar aqui).
2. As demais clínicas (Lumine etc.) seguem o mesmo procedimento DEPOIS que a
   IBS validar — uma por vez, nunca em lote.

## Guardrails (violação = parar e perguntar)

- ❌ NÃO alterar o cron/workflow (`sync-clinicorp.yml`), env vars ou secrets.
- ❌ NÃO alterar `clinicorpSync.js`, `parseCards.js`, `extract.js`,
  `dashboard.js`, wizard — o código está pronto; o plano é config + dados.
- ❌ NÃO substituir o JSONB `steps` sem merge (perde token/config).
- ❌ NÃO inventar vínculo de CRC não confirmado pelo usuário.
- ❌ NÃO mover card de etapa nem alterar valor em nenhum passo.
- ❌ NÃO rodar backfill `--apply` sem mostrar o dry-run antes.
- ❌ NÃO commitar tokens (sanity-check antes de todo commit).
