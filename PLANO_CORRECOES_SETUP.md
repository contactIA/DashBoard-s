# Plano de correções — /setup datas + CRC + backfill IBS

> **Para o executor (Sonnet):** siga na ordem. Contexto: o wizard já tem os
> campos "Agendado Para"/"Agendado em" e o mapa CRC por unidade (commits
> "Atualizacoes"/"9877a43"), mas o teste real do usuário no /setup da IBS
> revelou os problemas abaixo. NÃO reabrir decisões: formato ISO local
> confirmado por teste real; mapa CRC é POR UNIDADE; "Agendado Para" é campo
> único data+hora; dueDate não recebe mais data da consulta.

## Problemas encontrados no teste real (com telas)

| # | Problema | Evidência |
|---|---|---|
| P1 | **CRÍTICO (invisível na tela):** `deriveDatesConfig`/`customFieldKeyOf` só olha `rules[0]`. Na IBS o auto-detect deixou `dueDate` como 1ª regra e `customFields.agendado-para` como 2ª → `_dates.scheduledFor` sai **null** ao salvar → o sync NUNCA escreveria nos campos novos, sem nenhum aviso. | imagem1 (dueDate 1ª regra) |
| P2 | Botão "Buscar usuários do Clinicorp" → **401 Unauthorized** nas duas unidades. Causa: em modo edição, `u.existingToken` vem **mascarado** (`abc12345…wxyz`) do GET admin/clinics; `clinicorpConfig()` manda esse token mascarado pro endpoint → Basic Auth inválido. | imagem5 |
| P3 | Mapa CRC lista **todas** as etiquetas do painel (BUENO, ELDORADO, AGENDAMENTO IA…), não só as CRCs — ruído e risco de vincular etiqueta de unidade a um nome. | imagem4/5 |
| P4 | Campo "Horário" desnecessário — "Agendado Para" já carrega data+hora. | imagem2 |
| P5 | Card "Agendado em" mostra sugestão "💡 dueDate bate em 6/12 → Usar" — **enganosa**: dueDate é a data da consulta, não a de agendamento; clicar quebraria a semântica do funil. | imagem3 |
| P6 | Etapa **Revisão** não mostra as keys de data derivadas nem o mapa CRC → sem confiança do que será salvo ("se salvar vai estar ok? na revisão não aparece"). | relato |
| P7 | Previews 5/6 e 0/6: **dados antigos** — cards existentes da IBS têm a data no `dueDate` (vencimento) e nada em `agendado-para`/`agendado-em-`. Pedido explícito do usuário: **backfill de todos os cards da IBS**. | imagem1/3 |

## Correções de código (fazer primeiro, nesta ordem)

### C1 — `deriveDatesConfig` varre todas as regras (P1) — `src/admin/ClinicWizard.jsx`

`customFieldKeyOf` deve retornar a key da **primeira regra `customFields.*` da
lista** (em qualquer posição), não `rules[0]`:

```js
function customFieldKeyOf(rules) {
  for (const r of rules ?? []) {
    if (r?.from?.startsWith('customFields.')) return r.from.slice(13) || null
  }
  return null
}
```

Sem mudança no `_extract` de leitura: dueDate como 1ª regra continua ok para
cards antigos (após o backfill P7, tanto faz a ordem — os dois batem).

### C2 — 401 na busca de usuários (P2) — `api/admin/clinicorp-users.js` + `adminApi.js` + wizard

O endpoint deve **restaurar o token real server-side** quando o recebido vier
mascarado/vazio (mesma lógica de `restoreClinicorpTokens` em
`api/admin/clinics.js`):

- Front (`getClinicorpUsers(units, accountId)`): passar também o `accountId`
  da clínica em edição (`clinic?.accountId` — em cadastro novo não existe, ok).
- Endpoint: para cada unit com `!token || token.includes('…')`, buscar
  `steps._clinicorp.units` da clínica no Supabase (`account_id=eq.<accountId>`,
  service key) e casar por `user` para obter o token real. Unit sem restauração
  possível → pular com erro amigável em `errors` (não 401 geral).
- **Nunca** devolver o token restaurado na resposta — só usar internamente.

### C3 — Filtrar etiquetas do mapa CRC (P3) — `ClinicWizard.jsx`

Na seção "Mapa de CRC desta unidade", mostrar apenas etiquetas que:
1. **Não** são `tagId` de nenhuma unidade (`ccUnits.map(u => u.tagId)`), e
2. Se existir dimensão cujo label contenha `agendador`/`crc` (case-insensitive),
   **somente** as tags dessa dimensão; senão, todas as não-unidade.

Assim BUENO/ELDORADO somem da lista e sobram GABI/FLÁVIA/RITA/Naiara/IA.

### C4 — Remover campo "Horário" quando data+hora é campo único (P4) — `ClinicWizard.jsx`

- Na etapa Extração, **ocultar** o `ExtractField` de `time` quando
  `customFieldKeyOf(extract.date)` retornar uma key (campo único data+hora).
- Ao salvar com data em customField, gravar `_extract.time` automaticamente:
  `[{ from: 'customFields.<key>', regex: '(\\d{1,2}:\\d{2})' }]` — o valor ISO
  (`2026-07-08T12:00:00.0000000`) casa a regex e o dashboard segue exibindo a
  hora. (Confirmado: `String(array)` de 1 elemento vira a própria string.)

### C5 — Suprimir sugestão dueDate no "Agendado em" (P5) — `ClinicWizard.jsx`

Em `EXTRACT_FIELDS`, adicionar `noSuggest: true` ao campo `scheduledAt`; em
`ExtractField`, `suggestHelena` só quando `!field.noSuggest`. (dueDate ≠ data
de agendamento — a sugestão induz erro de semântica.)

### C6 — Revisão mostra datas + CRC (P6) — `ClinicWizard.jsx`

Na etapa Revisão, adicionar linhas:
- **Datas**: `Agendado Para → customFields.<key>` e `Agendado em →
  customFields.<key>` (ou "— não configurado" quando ausente).
- **Mapa CRC**: por unidade, `N etiqueta(s) vinculada(s)` com os pares
  (`GABI → Gabriela Vieira Da Silva`), ou aviso quando vazio.

### Validação das correções
- `npx vite build` sem erro; `node --input-type=module` nos módulos tocados.
- Dev server: editar IBS no /setup → busca de usuários funciona (sem 401),
  mapa CRC lista só CRCs, campo Horário oculto, revisão mostra tudo.
- Commit (mensagem clara), push após aprovação do usuário.

## P7 — Backfill dos cards da IBS (após C1-C6 validados)

Pedido do usuário: "as datas estão em vencimento, busque e atualize todos os
cards". Script one-shot (ex: `scripts/backfill-ibs-dates.mjs`, fora do bundle),
nos moldes de `sync-prototype/backfill-eventdate.js`:

1. **Fonte da data/hora da consulta** (por card, na ordem):
   a. `customFields.data` (DD/MM/AAAA legado) + `customFields.hor-rio` (HH:MM);
   b. senão `dueDate` (UTC → Brasília: -3h) — data e hora;
   c. senão pular o card (sem data conhecida).
2. Escrever `agendado-para` = ISO local (`AAAA-MM-DDTHH:MM:00.0000000`) via
   PUT `/crm/v2/panel/card/{id}` com `fields:['customFields']` — **não tocar**
   em stepId/valor/metadata (exceto preservar o metadata existente se a API
   exigir reenvio — conferir com um card de teste antes do lote).
3. **`agendado-em-`**: só para cards com `metadata.clinicorp_patient_id`:
   buscar `CreateDate` nos appointments das DUAS unidades (janela -90d/+30d,
   `IncludeCanceled=true`), casando por `Patient_PersonId`. Sem dado → deixar
   vazio (NUNCA inventar — card de CRC/IA antigo fica sem "agendado em").
4. **Não apagar** `dueDate` dos cards antigos (inofensivo; o sync novo já não
   escreve mais nele).
5. **Dry-run primeiro**: relatório (total de cards, quantos com fonte a/b,
   quantos ganham agendado-em-, 10 exemplos) → **aprovação do usuário** →
   apply com `sleep(250ms)` entre PUTs e retry 429.
6. Depois do apply: re-salvar a IBS no /setup (previews devem subir para ~6/6),
   com `_dates` derivado, `_extract.scheduledAt` de `agendado-em-` e mapa CRC
   preenchido por unidade.
7. Sync manual da IBS (`?accountId=58e1700e-...`) e conferência: cards novos
   com os 2 campos certos, vencimento intacto, funil "Agendaram" contando por
   "Agendado em".

## Guardrails
- ❌ Não tocar dedup/CUTOFF/prioridades/anti-regressão do sync.
- ❌ Não reintroduzir sugestão/adivinhação de CRC (mapa por unidade é a fonte).
- ❌ Backfill nunca move card de etapa nem altera valor — SÓ customFields.
- ❌ Endpoint de usuários nunca ecoa token (mascarado ou real) na resposta.
- ❌ Sem migration de banco; clínicas sem `_dates` continuam no legado.
- ❌ Commit só após build limpo + sanity-check de segredos; push com aprovação.
