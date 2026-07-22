# Regras do Dashboard — como os dados são puxados, o funil é montado e o agendador é resolvido

> Documento de referência (não é plano de execução). Descreve o comportamento
> ATUAL do código em 16/07/2026, incluindo um bug real e confirmado na seção 6.

---

## 1. De onde vêm os dados

- **Fonte única de cards**: painel Helena (`api.wts.chat`), buscado a cada
  carregamento do dashboard — sem cache, sem banco intermediário de cards.
  `api/dashboard.js` pagina `GET /crm/v1/panel/card` até acabar as páginas.
- **Configuração da clínica**: tabela `clinics` no Supabase, coluna `steps`
  (JSONB). Guarda: quais steps do painel valem como quais métricas, as regras
  de extração, as dimensões (cortes do funil), o funil, e a integração
  Clinicorp (se houver).
- **O Clinicorp não é lido pelo dashboard.** Ele só entra pelo **sync**
  (`src/server/clinicorpSync.js`, rodado pelo cron a cada hora), que escreve
  nos MESMOS campos do card Helena que uma CRC/IA preencheria manualmente.
  O dashboard sempre lê do card — nunca do Clinicorp direto.

## 2. Como um card vira uma "métrica" (stepType)

Cada etapa (step) do painel Helena é mapeada no `/setup` para um **tipo de
métrica** (`lead`, `scheduled`, `attended`, `converted`, `missed`, `cancelled`,
`negotiating`, `notScheduled`, `rescheduled`, ou `ignore` — lista completa em
`src/admin/metricTypes.js`). Essa é a "tradução" entre o vocabulário de cada
clínica (uma chama de "AGENDOU", outra de "AGENDADO") e o vocabulário fixo que
o resto do código usa.

- Step marcado como `ignore` fica fora de tudo — não conta em nenhuma métrica,
  nenhum funil, nenhum KPI. Aparece só no aviso de "cards não mapeados".
- `api/dashboard.js:201-206` monta esse lookup (`stepLookup`) e anexa
  `stepType`/`stepLabel`/`stepColor` a cada card retornado.

## 3. As QUATRO datas de um card (a parte que mais gera confusão)

| Data | Campo no card | Quando é preenchida | Para que serve |
|---|---|---|---|
| **Criação do card** | `card.createdAt` (nativo Helena) | Quando o lead entrou no painel (CRC, IA ou sync) | Topo do funil: "Leads (entraram)" |
| **Agendado em** | customField configurável (ex: `agendado-em-`), lido via `_extract.scheduledAt` → `c.scheduledAt` | Dia em que a CRC/IA/sync **marcou** o agendamento | Barra "Agendaram" do funil |
| **Agendado Para** | customField configurável (ex: `agendado-para`, campo único data+hora), lido via `_extract.date`/`.time` → `c.date`/`c.time` | Dia/hora que o paciente **vai à clínica** — a consulta em si, IMUTÁVEL uma vez marcada | Agendamentos futuros, exibição geral |
| **Fechado em** (novo, 20/07) | customField configurável (ex: `fechado-em-`), lido via `_extract.closedAt` → `c.closedAt` | Dia em que o **orçamento foi aprovado** no Clinicorp — pode ser MESES depois da consulta (ex: agendado 28/05, consulta 03/06, fechou 20/07) | Alimenta `metadata.clinicorp_event_date` quando o card fecha — nunca sobrescreve "Agendado Para" |
| **Data do evento** | `metadata.clinicorp_event_date` → `c.eventDate` | Gravada só pelo sync: para FECHOU é o "Fechado em"; para os demais desfechos (faltou/desmarcou/etc.) é a data do agendamento | Atribuição temporal de KPIs e receita — impede que um card movido HOJE sobre um fato de meses atrás conte como receita do mês errado |

**LIÇÃO DE 20/07 (bug real, corrigido em `src/server/clinicorpSync.js`)**: antes
desta correção, quando um orçamento aprovava no Clinicorp, o motor de sync
gravava a data de aprovação (`e.Date`, que é ≈ `LastChange_Date` — confirmado
contra a API real) TAMBÉM no campo "Agendado Para", sobrescrevendo a data real
da consulta. Um paciente agendado em maio, atendido em junho, cujo orçamento só
aprova em julho, tinha o card "Agendado Para" reescrito para julho — quebrando
qualquer relatório de agenda por data de consulta. Agora as 3 datas
(agendado em / agendado para / fechado em) são gravadas em campos
INDEPENDENTES, nenhuma nunca sobrescreve outra. Ver `PROJETO CLINICORP + PAINEL/Documentação` para o payload real de `/estimates/list`.

**Regra de prioridade da "data efetiva"** (`effectiveDate`, `src/utils/parseCards.js`, regra ESTRITA desde 18/07):
1. `eventDate` se existir (fato real do Clinicorp — inclui o "Fechado em" quando aplicável);
2. senão, se o card está em `lead`/`notScheduled` → data de **criação**;
3. senão → **SÓ** a data do agendamento (`date`, "Agendado Para"). SEM fallback
   por `updatedAt` — card sem essa data fica FORA das métricas por período
   (ausência visível no aviso amarelo > número falso que mudava a cada edição).

Essa `effectiveDate` é o que decide se um card "aconteceu" dentro do período
filtrado, para **quase tudo**: KPIs, receita, tabela de perdidos, etc.

**Exceções que usam datas diferentes de propósito** (não é bug, é design):
- **Topo do funil** ("Entraram"): usa `createdInPeriod` — data de criação do
  card, com uma correção: se o `eventDate` for anterior à criação (fato antigo
  importado hoje pelo sync), usa o menor dos dois (`parseCards.js:76-81`).
- **Barra "Agendaram"** do funil geral: usa `scheduledInPeriod` — a nova data
  "Agendado em" (`c.scheduledAt`), com fallback para `effectiveDate` quando o
  card não tem esse campo (clínica ainda não migrada para o padrão novo).
- **Agendamentos futuros** (`getUpcoming`): usa `c.date` ("Agendado Para"),
  não a data efetiva.

## 4. Extração dos campos (`_extract`)

Cada clínica tem `steps._extract`, com uma lista de regras por campo
(`date`, `time`, `scheduledAt`, `name`, `phone`). A primeira regra que casar
vence; as demais são fallback (`src/utils/extract.js`, `extractWith`).

- Fontes possíveis: `title`, `description`, `dueDate`, `contactName`,
  `contactPhone`, `metadata.<campo>`, `customFields.<campo>`.
- Datas aceitam formato `YMD` (`AAAA-MM-DD`) ou `DMY` (`DD/MM/AAAA`) — o regex
  de `YMD` aceita tanto hífen quanto barra como separador (`2026-07-13` e
  `2026/07/13`), porque a própria Helena reformata alguns customFields com
  barras na gravação, dependendo do campo.
- Sem nenhuma regra configurada (clínica legada), cai num parser de texto
  livre (`parseDescription`/`parseTitleAppointment` em `api/dashboard.js`).
- **`noDate`**: cards sem `date` extraído aparecem num aviso no topo do
  dashboard — sem data, o card só entra nos filtros de período pela data
  efetiva (movimentação), não pela data real do agendamento.

## 5. Dimensões (cortes do funil — Origem, Unidade, Agendador…)

Uma **dimensão** agrupa etiquetas (tags) do card Helena sob um rótulo comum
que aparece como corte no dashboard (ex: dimensão "Origem" = etiquetas
Meta + Orgânico + Indicação).

- Configuração: `steps._dims.<chave> = { label, source: 'tag', values: {tagId: rótulo}, isUnit? }`.
- Cálculo por card (`dimValue`, `src/utils/extract.js`): percorre
  `card.tagIds` e devolve o rótulo da **primeira** tag que bater com alguma
  das configuradas na dimensão. **Se o card tiver duas etiquetas da mesma
  dimensão, só a primeira encontrada na ordem de `card.tagIds` conta — as
  demais são ignoradas silenciosamente.**
- `isUnit: true` marca a dimensão usada como filtro de "unidade" no topo do
  dashboard (ex: Bueno/Eldorado da IBS).
- Uma etiqueta que não está em NENHUMA dimensão é ignorada nas métricas —
  aparece só como "etiqueta sem dimensão" no /setup.

## 6. O Agendador/CRC — os DOIS mecanismos que existem e o bug confirmado

Este é o ponto que você relatou como errado. Existem **dois sistemas
diferentes**, um de leitura (o que o dashboard mostra) e um de escrita (o que
o sync grava), e a causa raiz do erro está na falta de sincronismo entre eles.

### 6.1. Mecanismo de EXIBIÇÃO (o que aparece no dashboard)

A dimensão "Agendador" é só mais uma dimensão comum (seção 5): olha as
etiquetas do card **agora, ao vivo**, sem cache. Se o card tem a etiqueta
"GABI", o dashboard mostra "GABI" — não importa como ou quando essa etiqueta
foi parar lá.

### 6.2. Mecanismo de ESCRITA (o que o sync do Clinicorp aplica)

Configurado por unidade Clinicorp (`steps._clinicorp.units[].crcMap`), casando
o nome de quem agendou no Clinicorp (`CreateUserName`) com uma etiqueta da
Helena. **Só entra em ação quando o sync CRIA um card novo.**

### 6.3. A causa raiz confirmada: o MOVE nunca atualiza a etiqueta de CRC

Quando o sync **move** um card já existente (ex: o paciente reagendou, faltou,
fechou), o `PUT /crm/v2/panel/card/{id}` só envia `stepId`, `monetaryAmount`,
`customFields` e `metadata` — **nunca `tagIds`** (`clinicorpSync.js`, bloco de
`allMoves`). Ou seja:

> **A etiqueta de CRC fica CONGELADA em quem agendou a PRIMEIRA VEZ, para
> sempre — mesmo que o paciente seja remarcado por uma CRC diferente depois.**

Isso é a explicação mais provável para "o agendador está errado": se a Rita
agendou pela primeira vez e depois a Naiara remarcou o mesmo paciente, o
dashboard continua mostrando **Rita**, porque o card nunca teve a tag trocada.

### 6.4. Outras causas que também contribuem (por ordem de probabilidade)

1. **CRC "vencedora" errada dentro da janela de busca.** O sync varre
   agendamentos de 60 dias atrás a 30 dias à frente; se o mesmo paciente tem
   mais de um agendamento nessa janela, `agendadorByPatient` guarda o
   `CreateUserName` do **último item processado na lista bruta da API**, não
   necessariamente o mais recente por data — pode nascer errado desde a
   criação.
2. **Card sem etiqueta nenhuma, confundido com "etiqueta errada".** Quando o
   nome do Clinicorp não bate com nenhum `crcMap` cadastrado (nome digitado
   diferente, ou pessoa ainda não vinculada), o card nasce **sem** tag de CRC
   e o nome cai em `unmatchedCrc` — no dashboard aparece como "sem agendador",
   que pode ser lido como "errado" quando na verdade é "não configurado".
3. **Cards com DUAS etiquetas de CRC ao mesmo tempo.** Um script antigo de
   backfill (fora do cron de produção, em
   `PROJETO CLINICORP + PAINEL/sync-prototype/backfill-crc-tags.js`) **adiciona**
   a etiqueta de CRC a cards existentes sem remover nenhuma tag anterior. Se
   esse script rodou nessa clínica, um card pode ter 2 etiquetas de CRC
   diferentes — e a dimensão mostra a que aparecer primeiro na lista de tags
   da Helena, que não é necessariamente a correta.

### 6.5. O que isso significa na prática (sem sugerir código ainda)

- O problema não é "o cálculo está errado" — é que **o sistema nunca foi
  desenhado para re-etiquetar CRC num reagendamento**. É uma lacuna de
  design, não um erro de fórmula.
- Corrigir isso exigiria decidir: o MOVE deveria atualizar a tag de CRC
  sempre que o Clinicorp indicar um agendador diferente do card atual? Isso
  tem implicações (qual CRC "vale" quando há histórico de reagendamentos?) —
  fica para uma conversa e um plano à parte, não faz parte deste documento.

## 7. O Funil — as 4 barras e o que cada uma soma

| Barra | Fonte de data | Quem entra |
|---|---|---|
| Leads (entraram) | Criação do card | Todos os cards criados no período |
| Agendaram | "Agendado em" (`scheduledAt`), fallback data efetiva | stepTypes configurados em `_funnel.stages.agendou` |
| Compareceram | Data efetiva | stepTypes em `_funnel.stages.compareceu` |
| Fecharam | Data efetiva | stepTypes em `_funnel.stages.fechou` |

Sem `_funnel` configurado, usa o padrão (`DEFAULT_FUNNEL_CFG`,
`parseCards.js:226-234`): agendou = scheduled+rescheduled+attended+
negotiating+converted+missed+cancelled; compareceu = attended+negotiating+
converted; fechou = converted.

**Taxas do funil** (todas com denominador explicável "de cabeça"):
- Taxa de agendamento = agendou ÷ entraram.
- Taxa de comparecimento = compareceu ÷ (compareceu + faltou).
- Taxa de fechamento = **fechou ÷ compareceu** [regra revisada pelo usuário
  16/07 à noite]: compareceu = em aberto + não fechou + fechou, e o em aberto
  FICA no denominador. Mesma régua em TODO lugar que mostra % de conversão:
  KPI do topo, tabelas por dimensão, campanhas, card de contratos.

### 7.1. Inconsistência confirmada entre o funil geral e a quebra por dimensão

A tabela "quebra por Agendador/Origem" (`DimensionBreakdown`, alimentada por
`breakdownByDimension`) **não recebeu** a atualização da barra "Agendaram" —
ela ainda soma pela **data efetiva** (movimentação), não pela nova "Agendado
em". Ou seja: **o número de "Agendou" no funil geral pode ser diferente do
número de "Agendou" na tabela por Agendador**, mesmo olhando o mesmo período,
porque usam critérios de data diferentes. Isso é bug de UX/UI real — os dois
deveriam contar do mesmo jeito.

## 8. KPIs (faixa-herói e secundários)

- **Leads/não agendou ficam fora dos KPIs de atendimento** — nunca tiveram
  consulta, então só aparecem no funil, não na régua de comparecimento/
  conversão.
- Taxa de comparecimento = (não fechou + em aberto + fechou) ÷
  (esse total + faltou).
- Taxa de conversão = **fechou ÷ compareceram** (não fechou + em aberto +
  fechou) [regra revisada pelo usuário 16/07 à noite — o em aberto entra no
  denominador; ex: 28 fecharam de 81 que compareceram = 34,6%].
- Receita: só soma `monetaryAmount > 0` (valor real); cards sem valor em
  etapas que deveriam ter (fechou/em aberto/não fechou) aparecem numa lista
  separada de alerta ("sem valor preenchido").
- Receita "projetada": agendamentos futuros × taxa de fechamento histórica ×
  ticket médio (ou ticket configurado, se não houver fechamentos com valor).

## 9. Sobre "a ordem/UX/UI está muito ruim" (observação registrada, sem solução aqui)

Você sinalizou que a organização visual do dashboard não está boa. Este
documento não propõe redesign — é só o registro de que a queixa foi recebida.
Pontos que já pulam aos olhos ao ler o código, para conversarmos depois:
- A ordem de seções na tela (`src/App.jsx:313-401`) é: Hero → KPIs → Funil +
  quebras por dimensão (em colunas CSS que reordenam sozinhas por altura,
  método "masonry") → Receita detalhada → Tendência + distribuição por etapa
  → Próximos agendamentos → Perdidos + Orçamentos em aberto.
- O layout "masonry" (colunas CSS) do bloco de funil é o que decide a ordem
  visual dos cartões de quebra por dimensão — a ordem pode parecer
  imprevisível porque depende da ALTURA de cada bloco, não de uma prioridade
  fixa definida por alguém.
- Não há hierarquia visual configurável pelo admin — a ordem das dimensões
  no dashboard segue a ordem em que foram criadas no `/setup`, não uma
  prioridade de negócio.
