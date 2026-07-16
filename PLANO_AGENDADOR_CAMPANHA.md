# Plano de execução — Agendador dinâmico + regra do fechamento + tabela CRC + Campanhas + gestão

> **Para o executor (Sonnet 5):** siga na ordem das fases. Contexto técnico em
> `REGRAS_DASHBOARD.md`. NÃO reabrir decisões [DECIDIDO]. **Leia "As datas —
> LEIA ANTES DE CODAR" antes de tocar em qualquer coisa.**
> **ESTADO ATUAL DO WORKING TREE**: a FASE 1 (itens 1.1–1.3) JÁ ESTÁ
> IMPLEMENTADA em `src/server/clinicorpSync.js` (diff não commitado, sintaxe
> validada) — não reimplemente; valide e commite conforme a FASE 1 descreve.

## As datas — LEIA ANTES DE CODAR

Dois "create" com nomes parecidos e significados diferentes:

| Termo | O que é | Exemplo |
|---|---|---|
| `card.createdAt` (Helena) | Quando o CARD foi criado = primeira conversa do lead | lead chegou 30/06 |
| `appointment.CreateDate` (Clinicorp) | Quando o AGENDAMENTO foi criado = dia em que a CRC/IA agendou = **fonte do "Agendado em"** | agendou 29/06 (para consulta em 30/06) |

- "**data do Agendado em**" neste plano = `appointment.CreateDate` (= valor de
  `customFields['agendado-em-']`). PROIBIDO usar `card.createdAt` aí.
- `card.createdAt` só aparece onde é o correto por definição: topo do funil
  ("entraram"), "Leads" por campanha, e tempo de resposta (FASE 7).
- A busca de agendamentos no Clinicorp (`/appointment/list?from&to`) filtra
  pela data da CONSULTA (`a.date` = "Agendado Para") — é assim que a API
  funciona e é o correto: a janela acompanha as consultas, não o dia em que
  foram marcadas.

## REGRA DO FECHAMENTO [DECIDIDO 16/07] — a substituição do "Agendado Para"

Exemplo do usuário: agendado em 29/06, consulta em 30/06, compareceu, e o
orçamento foi APROVADO em 02/07 → **o faturamento é de julho**.

- Quando o orçamento é aprovado (card vai/está em FECHOU), o campo
  **"Agendado Para" é SUBSTITUÍDO pela data do fechamento** (data do orçamento
  aprovado, `estimate.Date`). O "Agendado em" (29/06) **permanece intocado**.
- `metadata.clinicorp_event_date` recebe a mesma data (02/07) — é ela que já
  garante a atribuição da receita ao mês certo no dashboard.
- **O motor JÁ faz a substituição no move de fechamento** (a proposta de
  FECHOU usa `quando = e.Date` com prioridade máxima, e o move escreve
  `agendado-para` a partir de `quando`). O que a FASE 2 corrige são os GAPS:
  cards que fecharam ANTES desta regra existir, cards já em FECHOU que não
  geram PUT, e um risco de apagar o "Agendado em" sem querer (ver 2.2).

## Decisões do usuário (consolidadas, 16/07/2026)

1. [DECIDIDO] **Agendador DINÂMICO**: a etiqueta de CRC acompanha quem agendou
   por último (pela data do Agendado em). Nunca congela.
2. [DECIDIDO] **Sem match de CRC = "sem agendador"** (linha própria na
   tabela). O sync NUNCA remove etiqueta sem substituta resolvida.
3. [DECIDIDO] **Tabela por Agendador**: `Nome · Agendados · Compareceram ·
   Não fecharam · Fecharam · Compar.% · Fech.%`. Compareceram = régua
   `compareceu` (3 tipos). Compar.% = Compareceram÷Agendados; Fech.% =
   Fecharam÷Compareceram.
4. [DECIDIDO] **"Agendados" (em QUALQUER tabela/corte, incl. campanha) = régua
   cumulativa `agendou` do funil**: scheduled + cancelled + missed +
   negotiating + attended + converted ("agendou, cancelou, faltosos,
   comparecidos, compareceu e não fechou, compareceu e fechou — sempre
   assim"). Nunca "só quem está na etapa agora".
5. [DECIDIDO] **Cadência do cron: 30 minutos** (`7,37 * * * *` — mantém o
   hábito de fugir do topo da hora).
6. [DECIDIDO] **Regra do fechamento** (seção acima).
7. [DECIDIDO] **Campanhas** por customField (key `campanha` na IBS), seção no
   fim do dash, com Faltaram/No-show% (qualidade do lead). IBS manual; demais
   clínicas com automação externa preenchendo.
8. [DECIDIDO] **Flag "tem IA?" no /setup** + tempo de resposta da CRC (só
   clínicas sem IA), leads parados, widget de saúde do sync no /setup.

---

## FASE 1 — Agendador dinâmico (motor) — JÁ IMPLEMENTADO, falta validar+commitar

O working tree já contém (não commitado):
- 1.1 `agendadorByPatient` guarda `{nome, agendadoEm}` e o mais recente pela
  data do Agendado em vence;
- 1.2 MOVE troca a etiqueta de CRC (`precisaCrc`, `allCrcTagIds`, `tagIds` no
  PUT — só etiquetas mapeadas são trocadas; sem match não toca);
- 1.3 CREATE consumindo `?.nome`.

**Falta:**
1. Sync manual (`scripts/run-sync-ibs.mjs`) e conferir: card remarcado com
   etiqueta trocada; nenhuma tag de unidade/origem perdida; `unmatchedCrc`
   consistente.
2. Commit da FASE 1 (sanity-check de segredos antes).
3. **1.4** Script one-shot `scripts/fix-crc-tags-ibs.mjs` (saneamento dos
   cards já errados): para cada card com `clinicorp_patient_id`, recalcula o
   CRC pelo agendamento com maior data de Agendado em (2 unidades); troca se
   diferente; deduplica cards com 2+ etiquetas de CRC; sem match não toca.
   Dry-run → aprovação do usuário → apply.
4. **1.5** Cadência: schedule do workflow vira `7,37 * * * *`.

## FASE 2 — Regra do fechamento: fechar os gaps

### 2.1. Card já em FECHOU não recebe correção de data (gap)
Hoje um card já em FECHOU com valor preenchido não gera PUT nenhum — se o
`agendado-para` dele estiver com a data da consulta (era o comportamento
antigo) em vez da data do fechamento, nunca é corrigido.
- Adicionar `IncludeDetails=CustomFields` ao fetch de cards do sync (mesma
  chamada, sem custo extra) para poder comparar.
- Nova condição `precisaData`: o `agendado-para` desejado (calculado de
  `want.quando`/`want.time`) difere do atual do card → entra em `allMoves`
  mesmo sem mudança de step/valor/CRC. Comparar pelo valor normalizado
  (`isoLocal`), tolerando o formato com barras que a Helena devolve.

### 2.2. Risco de APAGAR o "Agendado em" no fechamento (verificar ANTES de tudo)
No move de fechamento vindo de orçamento, `criadoEm` é null (estimates não
têm CreateDate) → `buildDateCustomFields` monta `customFields` SÓ com
`agendado-para`. **Se o PUT de customFields da Helena for REPLACE (apagar as
keys não enviadas), o `agendado-em-` é destruído a cada fechamento.**
- Teste real controlado (1 card de teste, regravando valor igual) para
  determinar merge vs replace.
- Se replace: o move passa a SEMPRE reenviar o `agendado-em-` atual do card
  (disponível via fetch com CustomFields do 2.1) quando não tiver `criadoEm`
  novo. Se merge: nada a fazer, documentar no código.

### 2.3. Saneamento dos fechados da IBS (o usuário já atualizou manualmente — conferir)
Script dry-run: para cards `converted` da IBS, comparar
`customFields['agendado-para']` com a data do fechamento
(`metadata.clinicorp_event_date`, que o sync grava do `e.Date`). Listar
divergências → aprovação → corrigir só os divergentes. NÃO tocar em cards
sem `clinicorp_event_date` (fechados manuais sem orçamento no Clinicorp).

## FASE 3 — Tabela por Agendador (frontend)

- 3.1 `DimensionBreakdown.jsx`: colunas fixas
  `Agendados (f.agendou) · Compareceram (f.compareceu) · Não fecharam
  (f.attended) · Fecharam (f.fechou) · Compar.% · Fech.%`; remover a coluna
  condicional de `negotiating`; títulos fixos em toda clínica (vocabulário
  próprio vira tooltip).
- 3.2 Linha "Sem agendador" (`null` incluído em `breakdownByDimension`,
  renderizada por último).
- 3.3 Janela do "Agendados" igual ao funil geral: por valor da dimensão,
  `agendouCards = dimCards.filter(c => scheduledInPeriod(c, from, to))`
  passado ao `funnelOf` (fecha a divergência de REGRAS_DASHBOARD §7.1).

## FASE 4 — Campanhas

- 4.1 `dimValue` (extract.js): novo source `customFields.<key>` (array →
  primeiro item → trim; vazio → null). `api/dashboard.js`: `values` de dims
  de customField derivados dos cards (distintos, por contagem desc).
  IBS: `steps._dims.campanha = { label: 'Campanha', source: 'customFields.campanha' }`
  via script de merge. Wizard: fonte "Campo personalizado" na etapa Dimensões.
- 4.2 `CampaignTable.jsx` no FIM do dash (abaixo de Perdidos/Orçamentos):

  | Campanha | Leads | Agendados | Compareceram | Fecharam | Faltaram | No-show% | Valor fechado | Ticket médio | Fech.% |

  - Leads = cards da campanha criados no período (`createdInPeriod`, todos os
    steps). Agendados = régua `agendou` [decisão 4]. Compareceram = régua
    `compareceu`. Fecharam = converted. Faltaram = missed. No-show% =
    faltaram ÷ (compareceram + faltaram). Valor fechado = soma `value` dos
    converted. Ticket médio = valor ÷ converted com valor.
  - Linha "Sem campanha" no fim. Reusar réguas existentes — nenhuma nova.

## FASE 5 — Flag de IA no /setup

`steps._flags = { hasIA: boolean }` — checkbox no wizard (etapa Métricas):
"Esta clínica usa IA para agendar?" (default false). `buildStepsConfig` ganha
o parâmetro. `api/dashboard.js` expõe `flags`. IBS: definir com o usuário
(tem etiqueta "AGENDAMENTO IA (IASMIN)" → provavelmente true) via script.

## FASE 6 — Tempo de resposta da CRC (só sem IA)

Média e mediana de `card.createdAt → c.scheduledAt` (dias, 1 casa) nos cards
do período com ambos. Exibir SÓ quando `flags.hasIA === false`. Posição:
célula no `KpiStrip` ("Tempo até agendar") com delta vs período anterior.
(Ex do usuário: chegou 30/06, agendou 01/07 → 1 dia — aqui `createdAt` é o
ponto de partida correto por definição.)

## FASE 7 — Leads parados

Componente no bloco de ação: cards em `lead`/`notScheduled` com `updatedAt`
mais velho que N dias (seletor 3/7/14, default 7). Colunas: nome · telefone ·
dias parado · step. Ordenado do mais antigo.

## FASE 8 — Widget de saúde do sync no /setup

- `api/admin/sync-status.js` (x-admin-secret): última rodada por clínica via
  `sync_log` + agregado 24h (moved/created/failed) + `unmatched_crc` pendentes.
- `AdminApp.jsx`: badge por clínica com Clinicorp — verde (ok), amarelo
  (unmatchedCrc pendente), vermelho (failed>0 ou sem rodada há 2h+). Clique
  expande.

## FASE 9 — Validação final + commits

1. Build; sync manual IBS; dashboard local: tabela CRC nova + "Sem agendador";
   Agendados iguais entre funil/tabela; card remarcado com etiqueta trocada;
   card fechado com `agendado-para` = data do fechamento e `agendado-em-`
   preservado; Campanhas visível; tempo de resposta só sem IA; leads parados;
   widget no /setup.
2. Sanity-check de segredos; **commit POR FASE** (1: motor; 2: fechamento;
   3: tabela; 4: campanhas; 5-8: gestão); push com aprovação do usuário.

## Guardrails
- ❌ PROIBIDO `card.createdAt` na resolução de CRC ou em "Agendado em"
  (exceções por definição: topo do funil, Leads por campanha, FASE 6).
- ❌ "Agendado em" NUNCA é sobrescrito pelo fechamento — só o "Agendado Para".
- ❌ Não mexer em dedup, CUTOFF/`syncSince`, prioridades, anti-regressão,
  resolução de steps por type.
- ❌ NUNCA remover etiqueta de CRC sem substituta; NUNCA tocar em etiquetas
  fora de `allCrcTagIds`.
- ❌ Não inventar vínculo de CRC — mapa por unidade é a fonte única.
- ❌ Réguas de comparecimento/fechamento não mudam (apresentação apenas).
- ❌ Scripts one-shot sempre com dry-run + aprovação antes do apply.
- ❌ 2.2 (merge vs replace) DEVE ser verificado antes de qualquer mudança da
  FASE 2 ir a produção — risco de perda de dado real.
- ❌ Commit por fase; sem segredos; push só com aprovação.
