# Plano — Ingestão de cards no Supabase + Processo validado de desenvolvimento

> Horizonte: **6 a 12 meses** de operação sustentável. Criado em 18/07/2026.
> Motivação: hoje o dashboard pagina o painel Helena INTEIRO a cada
> carregamento (`api/dashboard.js`) e o wizard até 15 páginas. Com ~900 cards
> funciona; com 3-5 mil trava (limite de 30s da function, rate limit Helena).
> A estimativa é que isso vire problema real em ~3 meses de crescimento.
>
> **Para o executor (humano ou IA):** cada FASE tem critério de "pronto"
> verificável. Não avance de fase sem cumprir o critério. Nas seções
> "Via IA", os prompts são para o Claude Code NO REPO — sempre exigir que
> ele rode a validação indicada antes de aceitar o resultado.

---

## Decisões já tomadas (NÃO reabrir)

- **Ingestão será feita.** Cards passam a viver numa tabela do Supabase; o
  dashboard lê SQL, não a Helena. A Helena vira fonte de INGESTÃO, não de leitura.
- **Webhook da Helena não será usado por ora** — a conta usa webhook só para o
  agendamento da IA; não misturar. Ingestão via cron (polling incremental).
- **Clínicas com Clinicorp (ex: Salutar, IBS)** já têm o cron horário
  (`sync-clinicorp`) tocando os cards — o ingestor pega carona na mesma
  infraestrutura de cron (GitHub Actions), não cria um segundo mecanismo.
- **Card em etapa terminal não é re-buscado** (ideia validada pelo usuário):
  quem está em "Compareceu e Fechou"/"Compareceu e Não Fechou" (e demais
  desfechos) é imutável — congela no banco. Só o pipeline ativo é reconsultado.
- Regra estrita de datas (commit `79fa6d1`) se mantém: card mal alimentado
  não computa. A ingestão NÃO muda regra de métrica nenhuma.

---

# PARTE A — Ingestão incremental de cards

## FASE A0 — Descoberta da API Helena (½ dia) — BLOQUEIA O DESENHO

Antes de escrever qualquer código, confirmar com token real o que
`GET /crm/v1/panel/card` suporta. O desenho do sync depende disso:

| Pergunta | Como testar | Impacto |
|---|---|---|
| Aceita filtro por data de atualização (`UpdatedAfter`/`UpdatedAt`)? | chamar com o parâmetro e comparar contagem | Se SIM → incremental de verdade (plano ideal) |
| Aceita ordenação (`OrderBy=UpdatedAt desc`)? | idem | Se SIM → dá para parar de paginar cedo (quase tão bom) |
| Aceita filtro por `StepId`? | idem | Se SIM → varredura só do pipeline ativo |
| Qual o rate limit real? | 20 chamadas seguidas, medir 429 | Define paralelismo e frequência |

> ⚠ Lição do commit `4b5805f`: a Helena VALIDA parâmetros e devolve 500 em
> valor desconhecido — testar cada parâmetro isoladamente, nunca assumir
> que parâmetro extra é ignorado.

**Estratégia por resultado (em ordem de preferência):**
1. `UpdatedAfter` existe → busca só cards alterados desde o último sync.
2. Só ordenação existe → pagina por `UpdatedAt desc` e PARA quando a página
   inteira for mais antiga que o último sync.
3. Só `StepId` existe → varredura horária apenas das etapas ativas
   (lead/agendado/etc.) + varredura completa 1x/dia de madrugada.
4. Nada existe → varredura completa 1x/hora POR CLÍNICA com `PageSize=100`,
   mas gravando no banco — o dashboard nunca espera essa varredura.
   (Mesmo o pior caso já resolve o problema: quem pagina é o cron com até
   10 min de vida, não a function de 30s na frente do cliente.)

**Pronto quando:** documento curto no repo (`supabase/INGESTAO_API.md`) com as
respostas testadas e a estratégia escolhida marcada.

## FASE A1 — Schema no Supabase (½ dia)

Criar `supabase/cards.sql` (DDL roda no SQL Editor do Supabase — ação humana,
como foi com `sync_log.sql`):

```sql
create table cards (
  account_id   text        not null,             -- clínica (FK lógica p/ clinics)
  card_id      text        not null,             -- id do card na Helena
  step_id      text        not null,
  step_type    text,                             -- resolvido pelo mapeamento do /setup
  title        text,
  name         text,
  phone        text,
  date         date,                             -- "Agendado Para" extraído
  time         text,
  scheduled_at date,                             -- "Agendado em" extraído
  event_date   date,                             -- clinicorp_event_date (metadata)
  value        numeric,
  dims         jsonb       default '{}',         -- dimensões resolvidas (origem, campanha…)
  created_at   timestamptz,                      -- createdAt da Helena
  updated_at   timestamptz,                      -- updatedAt da Helena
  raw          jsonb,                            -- card cru (auditoria/reprocesso)
  frozen       boolean     default false,        -- etapa terminal: não re-buscar
  synced_at    timestamptz not null default now(),
  primary key (account_id, card_id)
);
create index cards_period  on cards (account_id, date);
create index cards_created on cards (account_id, created_at);
create index cards_step    on cards (account_id, step_type);
```

Regras do schema:
- `raw` guarda o card inteiro: se uma regra de extração mudar no /setup, dá
  para **reprocessar do banco** sem re-buscar a Helena (comando de replay).
- `frozen = true` quando `step_type` ∈ {converted, attended, missed,
  cancelled} **e** `updated_at` > 30 dias — congela com margem para correção
  manual recente.
- RLS **desligada** na tabela (acesso só server-side com service key, como
  `clinics` e `sync_log`). Nenhuma chave anon toca esse dado.

**Pronto quando:** tabela criada no Supabase + arquivo SQL commitado.

## FASE A2 — Ingestor (2-3 dias)

Novo módulo `src/server/cardsIngest.js` + entrada no workflow de cron
existente (GitHub Actions, mesmo padrão do `sync-clinicorp`):

1. Para cada clínica ativa: busca cards pela estratégia da FASE A0
   (ignorando `frozen`), aplica `extractCard`/`computeDims` (MESMAS funções
   de `src/utils/extract.js` — zero duplicação de regra) e faz upsert.
2. Grava resultado em `sync_log` (tabela já existe) com contagens:
   buscados, upsertados, congelados, erros.
3. Backfill: primeiro run de cada clínica é uma varredura completa (todas as
   páginas) — é o import inicial. Flag `--backfill` explícita.
4. Frequência: `:07` de cada hora (carona no cron atual), `max-parallel: 4`.

**Pronto quando:** `sync_log` mostra runs verdes por 3 dias seguidos para
1 clínica piloto, e `select count(*) from cards` bate com o total do painel.

## FASE A3 — Dashboard lê do banco, com validação-sombra (2-3 dias + 1 semana de sombra)

1. `api/dashboard.js` ganha um modo por clínica (flag `steps._flags.readFromDb`):
   - `false` (default): comportamento atual (Helena ao vivo).
   - `true`: lê `cards` do Supabase (1 query), monta a MESMA resposta JSON.
2. **Validação-sombra** (o portão de qualidade): por 7 dias, um job diário
   computa os KPIs do período corrente pelos DOIS caminhos e grava o diff em
   `sync_log`. Critério: diferença ZERO em leads/agendados/compareceram/
   fecharam/valor por 5 dias consecutivos.
3. Virada por clínica: liga a flag da piloto → observa 1 semana → liga as
   demais. Helena ao vivo permanece como fallback por 1 ciclo (30 dias),
   depois o código do caminho antigo é removido.

**Pronto quando:** todas as clínicas com flag ligada, diff-sombra zerado,
caminho antigo removido do código.

## FASE A4 — Bônus destravados pela ingestão (backlog, sem prazo)

- Histórico próprio (relatórios ano-a-ano; Helena pode apagar, o banco não).
- Wizard descobre customFields do BANCO (fim do problema "campo vazio não
  aparece" de vez — o banco viu todos os cards da história).
- Alertas: "X cards agendados sem data há mais de 48h" por e-mail/WhatsApp.
- Dashboard multi-clínica consolidado para o grupo.

---

# PARTE B — Processo validado de criação e mudança de sistema

> Objetivo: parar de descobrir bug em produção (o 500 do setup foi descoberto
> pelo usuário clicando). Todo o processo abaixo é pré-requisito para as fases
> da PARTE A — implantar ANTES ou JUNTO da FASE A1.

## B1 — Fluxo de mudança (a regra de ouro)

```
branch → push → Preview Deploy (Vercel, automático) → validar na URL de preview
       → merge em main → produção → smoke test pós-deploy
```

- **NUNCA commit direto em `main`** para mudança de código (docs podem).
- Preview da Vercel já existe de graça: todo push em branch gera URL isolada
  com as MESMAS env vars — o setup/dashboard é validável lá antes do merge.
- Toda mudança de REGRA DE NEGÓCIO atualiza `REGRAS_DASHBOARD.md` no mesmo PR
  (o doc é a fonte de verdade; código que diverge do doc é bug de um dos dois).

## B2 — Testes automatizados (o mínimo que já pegava os bugs desta semana)

- **Vitest** em `src/utils/*.test.js` cobrindo as funções PURAS:
  - `parseCards`: effectiveDate estrita (com/sem date, lead, eventDate),
    funil fecha (Agendados ≥ Compareceram ≥ Fecharam), agendouCardsOf
    estrito vs fallback, campaignBreakdown com o cenário `0/1/1 → 1/1/1`.
  - `extract`: normalizeDate (DMY, YMD, barras da Helena, ano de 2 dígitos),
    isPlausiblePhone, extractCard com scheduledAt.
  - Os casos validados à mão nos commits `f71f340`/`185f291`/`79fa6d1`
    viram testes permanentes — regressão nunca mais passa batida.
- **GitHub Action** (`.github/workflows/ci.yml`): `npm test` + `vite build`
  em todo push/PR. Merge bloqueado se falhar.

## B3 — Checklist de validação (Definition of Done)

Toda mudança só está pronta quando:
- [ ] Testes novos cobrindo o comportamento (não só os antigos passando)
- [ ] `npm test` + `vite build` verdes no CI
- [ ] Validada na URL de preview (fluxo real clicado, não só código lido)
- [ ] Chamada externa nova (Helena/Clinicorp/Supabase) testada com token real
      em preview — **lição do `IncludeDetails`: parâmetro não documentado se
      testa isolado antes de commitar**
- [ ] `REGRAS_DASHBOARD.md` atualizado se regra de negócio mudou
- [ ] Commit descreve o PORQUÊ (padrão atual dos commits está bom — manter)

## B4 — Clínica de homologação

Criar no Helena um painel "CLINICA TESTE" com ~30 cards sintéticos cobrindo
todos os stepTypes e casos de borda (sem data, sem campanha, data futura,
cancelado com data passada). Cadastrar como clínica `teste` no Supabase.
- Wizard e dashboard são validados NELA antes de tocar clínica real.
- Os cards sintéticos são o dataset dos testes E2E manuais do checklist B3.

## B5 — Segurança (paralelo, 1 dia cada)

1. **Token por clínica no dashboard** (URGENTE, risco LGPD): coluna
   `access_token` em `clinics` (UUID), dashboard exige `?clinic=slug&t=<token>`,
   URL entregue à clínica já com token. Sem token → 401.
2. Rate limit no `x-admin-secret` (5 tentativas/min por IP) — Vercel KV.
3. (Mais tarde) Supabase Auth com login por clínica substitui o token na URL.

---

# PARTE C — Execução passo a passo: via MANUAL e via IA

> Ordem recomendada de execução geral:
> **B1 → B2 → B5.1 → A0 → A1 → A2 → B4 → A3 → B3 vira rotina → A4/B5.2+**

## C1 — Implantar o fluxo de branch + preview (B1)

**Via manual:**
1. Vercel → Settings → Git: confirmar "Preview Deployments" ligado (default).
2. GitHub → Settings → Branches → proteger `main`: exigir PR + status check.
3. Próxima mudança: `git checkout -b fix/nome`, push, abrir PR, validar na
   URL de preview que a Vercel comenta no PR, merge.

**Via IA (Claude Code):**
```
Crie a branch <nome> para esta mudança, commite nela e faça push.
NÃO mergeie em main. Me dê o link do PR para eu validar no preview.
```
Portão: o humano SEMPRE valida a URL de preview antes de pedir o merge.

## C2 — Montar os testes (B2)

**Via manual:** instalar Vitest (`npm i -D vitest`), criar
`src/utils/parseCards.test.js`, portar os cenários listados em B2,
adicionar `"test": "vitest run"` ao package.json, criar o workflow de CI.

**Via IA (Claude Code):**
```
Instale o Vitest e crie testes para src/utils/parseCards.js e extract.js
cobrindo: [colar a lista da seção B2]. Use os cenários dos commits f71f340,
185f291 e 79fa6d1 como casos. Depois crie .github/workflows/ci.yml rodando
npm test e vite build. Rode npm test e me mostre a saída completa.
```
Portão: exigir a saída do `npm test` com todos verdes; pedir para a IA
QUEBRAR um teste de propósito e mostrar o CI falhando (prova de que o
portão funciona).

## C3 — Token por clínica (B5.1)

**Via manual:** SQL Editor → `alter table clinics add column access_token
uuid default gen_random_uuid()`; editar `api/dashboard.js` para exigir e
comparar o token; reenviar URLs às clínicas.

**Via IA (Claude Code):**
```
Adicione autenticação por token ao dashboard: coluna access_token na tabela
clinics (me dê o SQL para eu rodar no Supabase), validação em
api/dashboard.js (401 sem token válido), e o link com token na tela de
sucesso do wizard. Branch + preview, não mergeie.
```
Portão: testar no preview que URL SEM token dá 401 e COM token funciona.

## C4 — Descoberta da API Helena (A0)

**Via manual:** com um token de clínica real, rodar as 4 chamadas da tabela
da FASE A0 via curl/Postman, anotar resultados em `supabase/INGESTAO_API.md`.

**Via IA (Claude Code):**
```
Preciso descobrir o que GET /crm/v1/panel/card da Helena suporta.
Escreva um script Node que teste, ISOLADAMENTE e com 1s entre chamadas:
UpdatedAfter, OrderBy, StepId e o comportamento em erro. Vou fornecer o
token via variável de ambiente na hora de rodar — NÃO grave o token em
arquivo. Gere supabase/INGESTAO_API.md com os resultados.
```
Portão: o humano fornece o token só na execução; conferir que nada de
token foi parar em arquivo/commit.

## C5 — Schema + ingestor + sombra (A1→A3)

**Via manual:** seguir as fases A1-A3 na ordem; DDL sempre pelo SQL Editor
(service key não roda DDL via REST — lição do `sync_log`).

**Via IA (Claude Code):** uma fase por vez, cada uma em branch própria:
```
FASE A1: crie supabase/cards.sql conforme o PLANO_INGESTAO_E_PROCESSO.md.
Me dê o SQL para eu rodar no Supabase e aguarde eu confirmar.

FASE A2: implemente src/server/cardsIngest.js reusando extractCard/computeDims
de src/utils/extract.js (não duplique lógica). Estratégia de busca: a que está
marcada em supabase/INGESTAO_API.md. Inclua --backfill. Testes com cards
sintéticos. Rode npm test.

FASE A3: modo readFromDb em api/dashboard.js atrás de flag por clínica +
job de diff-sombra gravando em sync_log. O default é o caminho atual.
```
Portão de cada fase: o critério de "Pronto quando" da própria fase, conferido
pelo humano (contagens no banco, sync_log verde, diff-sombra zerado). A IA
não decide a virada de flag — isso é decisão humana com o diff na mão.

---

## Cronograma sugerido (folgado de propósito)

| Mês | Entrega | Critério de saída |
|---|---|---|
| **1** (ago/26) | B1 + B2 + B5.1 (processo, testes, token) | CI verde bloqueando merge; dashboard exige token |
| **2** (set/26) | A0 + A1 + A2 (descoberta, schema, ingestor) | piloto com 3 dias de sync verde e contagem batendo |
| **3** (out/26) | B4 + A3 (homologação + leitura do banco em sombra) | diff-sombra zerado 5 dias na piloto |
| **4** (nov/26) | Virada de todas as clínicas | todas com readFromDb=true, Helena só como ingestão |
| **5-6** | Remoção do caminho antigo + A4 (bônus) + B5.2/3 | codebase só com o caminho novo |

Riscos que podem mexer no cronograma:
- FASE A0 revelar que a Helena não tem NENHUM filtro (cai no plano 4 — pior
  performance de sync, mesma arquitetura, sem impacto no usuário final).
- Rate limit da Helena mais agressivo que o esperado → espaçar clínicas no cron.
- Clínicas novas entrando no meio → cadastrar já com `readFromDb=true` desde
  o dia 1 a partir do mês 4 (nunca conhecem o caminho antigo).
