# Plano de execução — Datas "Agendado em" / "Agendado Para" + filtros do funil + mapa CRC

> **Para o executor (Sonnet 5):** siga este plano ao pé da letra. Foi escrito
> após estudar o código real, a doc da API do Clinicorp, o dashboard e o estado
> do banco. **NÃO improvise arquitetura.** As regras de negócio já validadas em
> produção (Lumine + IBS) não podem regredir. Onde houver dúvida, PARE e pergunte.

---

## 0. Decisões do usuário já fechadas (NÃO reabrir)

1. **O dashboard SEMPRE lê dos campos do card da Helena** (via `_extract`), nunca
   do Clinicorp direto. O Clinicorp só **abastece** os campos do card no sync.
   Dois caminhos deixam a data no mesmo lugar (o campo do card):
   - **CRC/IA agenda na Helena:** a pessoa/IA preenche "Agendado em" e "Agendado
     Para" no card, manualmente.
   - **Sync do Clinicorp:** o robô preenche os MESMOS campos, lendo do Clinicorp.
2. **Três campos, três papéis** (definição do usuário):
   | Campo do card | Significa | Filtro para |
   |---|---|---|
   | Criação do card (nativo Helena) | quando o lead **entrou** | entrada do lead (topo do funil) |
   | **Agendado em** | dia em que a CRC **agendou** | barra **"Agendaram"** do funil |
   | **Agendado Para** | dia/hora que o cliente **vai à clínica** | agendamentos futuros |
   Exemplo: agenda hoje 15/07 (Agendado em) um lead para 17/07 09:00 (Agendado Para).
3. **"Agendado Para" é UM campo único data-hora** (`dd/mm/aaaa --:--`) — data e
   hora juntas na mesma key. (Confirmado pelo usuário.)
4. **Keys configuráveis no /setup por clínica** — a nomenclatura pode ser a mesma
   mas a key interna sai diferente por painel; o admin escolhe as keys no wizard.
5. **Padrão único para TODAS as clínicas** daqui pra frente. **IBS já está certa**;
   a **Lumine será migrada**; toda clínica nova segue.
6. **Parar de usar o `dueDate`** para a data da consulta — vai só para "Agendado
   Para". Ajustar o `_extract` junto para o dashboard não perder a data.
7. **Mapa CRC explícito no /setup**: vincular etiqueta CRC da Helena (ex: "GABI")
   ao **nome de quem agendou no Clinicorp** (`CreateUserName`, ex: "Gabriela
   Souza"). O sync usa **SÓ esse mapa** (sem adivinhação); quem não estiver no
   mapa é criado **sem etiqueta CRC** e listado em `unmatchedCrc` para revisão.

## 1. As três datas (glossário técnico)

| Conceito | Origem no sync (Clinicorp) | Onde mora no card Helena | Lido pelo dashboard via | Uso |
|---|---|---|---|---|
| **Criação do card** | — (Helena cria) | `card.createdAt` (nativo) | `c.createdAt` | topo do funil |
| **Agendado em** | `appointment.CreateDate` | **customField configurável** (ex: `agendado-em-`) | `_extract` → `c.scheduledAt` (NOVO) | barra "Agendaram" |
| **Agendado Para** | `appointment.date` + `fromTime` (juntos) | **customField configurável** único (ex: `agendado-para`) | `_extract` → `c.date` (+ hora embutida) | futuros / exibição |
| **Data do evento** (fechou/faltou) | derivada | `metadata.clinicorp_event_date` | `c.eventDate` | atribuição de KPIs/receita (JÁ EXISTE) |

> **Correções de rodadas anteriores (LER):**
> - "Agendado em" é um **campo do card** (CRC/IA também preenchem), **não** uma
>   metadata escondida. A ideia antiga de `metadata.clinicorp_scheduled_at` está
>   **CANCELADA**. O sync escreve `CreateDate` no customField "Agendado em"; o
>   dashboard lê via `_extract` (mesma mecânica do "Agendado Para").
> - "Agendado Para" é **campo único data-hora** (decisão 3) — não há key de hora
>   separada.

## 2. Descobertas do estudo (fatos verificados)

- **API Clinicorp `/appointment/list`** (dados reais em
  `PROJETO CLINICORP + PAINEL/sync-prototype/out/appointments.json`):
  `CreateDate` (criação) e `date` + `fromTime` (consulta), além de `CreateUserName`
  (quem agendou — usado no mapa CRC). Ambos já vêm da API.
- **Estimates** (`/estimates/list`): têm `e.Date` mas **não** `CreateDate` nem
  `CreateUserName` → cards vindos só de estimate ficam sem "Agendado em" e sem CRC
  (esperado).
- **`_extract`** (`steps._extract`) já é o mecanismo de leitura do dashboard.
  Hoje a Lumine lê `date` de `customFields.data`. Vamos apontar para as keys novas.
- **Backend** (`api/dashboard.js` ~linha 208-239) monta cada card e roda o
  `extractCard(card, extractCfg)`. `date`/`time`/`name`/`phone` saem do `_extract`.
  Para o funil precisamos de mais um campo derivado do `_extract`: `scheduledAt`.
- **Extração** (`src/utils/extract.js`, usada tanto no backend quanto no preview
  do wizard): hoje conhece os campos `date`/`time`/`name`/`phone`. Precisa
  aprender um campo novo: `scheduledAt` (lido de um customField).
- **Sync CRC atual** (`clinicorpSync.js` `findAgendadorTag` + `NICKNAMES`): casa
  `CreateUserName` com etiqueta por adivinhação de 1º nome. **Será substituído**
  pelo mapa explícito (decisão 7), com a adivinhação removida do caminho principal.
- **Funil** (`parseCards.js`): `computeFunnel` usa `createdInPeriod` (topo) e
  `inPeriod`/`effectiveDate` (demais). A barra "agendou" hoje soma stepTypes por
  `inPeriod` — mudaremos a JANELA dessa barra para a data "Agendado em" (§7).

## 3. Modelo de dados (Supabase — SEM migration de schema)

`clinics.steps` é JSONB. Adicionamos `_dates` (clínica) e `crcMap` DENTRO de
cada unidade Clinicorp (`_clinicorp.units[i].crcMap`) — **não** é clínica-level:
a mesma pessoa pode ter usuário diferente cadastrado em cada conta Clinicorp
(confirmado na IBS: "Gabriela Vieira Da Silva" no Bueno vs. "Gabriela Vieira"
no Eldorado — mesma pessoa, contas separadas). Formato ISO local confirmado
por teste real de escrita/leitura no card da Cristiane (IBS): a Helena aceita
string simples (`"2026-07-08T12:00:00.0000000"`) e empacota em array sozinha
na leitura — sync escreve string simples, dashboard lê via regex/format YMD.

```jsonc
"_dates": {
  "scheduledFor": { "key": "agendado-para" }, // consulta: data+hora ISO (campo único)
  "createdAt":    { "key": "agendado-em-" }    // "Agendado em": data em que agendou (ISO)
},
"_clinicorp": {
  "units": [
    {
      "label": "Bueno", "user": "ibsimplantes", "token": "...", "tagId": "...", "syncSince": "...",
      "crcMap": [
        // etiqueta CRC (Helena) ↔ nome de quem agendou NESTA unidade (CreateUserName)
        { "tagId": "<uuid-etiqueta-gabi>", "tagName": "GABI", "clinicorpName": "Gabriela Vieira Da Silva" }
      ]
    },
    {
      "label": "Eldorado", "user": "ibsodonto1s", "token": "...", "tagId": "...", "syncSince": "...",
      "crcMap": [
        { "tagId": "<uuid-etiqueta-gabi>", "tagName": "GABI", "clinicorpName": "Gabriela Vieira" }
      ]
    }
  ]
}
```

- `_dates` **ausente** → sync mantém LEGADO (keys `data`/`hor-rio`, dueDate, sem
  "Agendado em"). `_extract` legado continua lendo `customFields.data`.
- `unit.crcMap` **ausente/vazio** → sync NÃO casa CRC pelo mapa nessa unidade;
  ver §5.5 (sem adivinhação: fica sem etiqueta e vai pra `unmatchedCrc`).
- **Descoberta de usuários Clinicorp**: endpoint novo `POST /api/admin/clinicorp-users`
  (proxy autenticado pra `/security/list_users` de cada unidade) alimenta um
  autocomplete no wizard — testado contra a IBS real (106 usuários, 2 unidades).

## 4. Ordem de execução (visão geral)

1. `src/utils/extract.js` — ensinar o campo `scheduledAt` — §5A.
2. `src/server/clinicorpSync.js` — datas + mapa CRC — §5.
3. `api/dashboard.js` — expor `scheduledAt` — §6.
4. `src/utils/parseCards.js` — funil "Agendaram" por "Agendado em" — §7.
5. `ClinicWizard.jsx` + `metricTypes.js` — /setup: keys de data + mapa CRC — §8.
6. Validação local read-only + piloto (GDLE) + migração Lumine — §10.
7. `/code-review`, commit + push só após aprovação — §10.

---

## 5A. `src/utils/extract.js` — novo campo `scheduledAt`

O extrator hoje processa `date`/`time`/`name`/`phone` a partir de `_extract`.
Adicionar suporte a um campo `scheduledAt` (uma data), lido de um customField,
com o mesmo maquinário de `date` (formato de data, fallback em cadeia). Não
inventar formato novo: reusar a normalização de data existente (`normalizeDate`).
O `extractCard` passa a devolver também `scheduledAt` quando o `_extract.scheduledAt`
existir; ausente → `null` (não quebra clínicas legadas).

## 5. `src/server/clinicorpSync.js` (motor)

> ⚠️ **PROIBIDO alterar** (regras já validadas): `findOrCreateContact`,
> `phoneKey`, `withRetry429`, `resolveStep`, `rankOfStep`/`TYPE_RANK`,
> `propose`/prioridades, a **dedup** (`cardsByClinicorpId`/`cardsByPhone`), o
> **CUTOFF**/`syncSince`, e a paginação. Só mexa no descrito abaixo.

### 5.1. Capturar `CreateDate` no loop de appointments (~linha 282)

No `extra` do loop `for (const a of appts)`:

```js
const extra = {
  nome: a.PatientName,
  quando: String(a.date ?? '').slice(0, 10),                 // consulta (existe)
  time: a.fromTime ?? null,                                  // horário (existe)
  criadoEm: String(a.CreateDate ?? '').slice(0, 10) || null, // NOVO: "Agendado em"
  telefone: a.MobilePhone,
  patientId: a.Patient_PersonId,
  primeiraConsulta: Boolean(a.FirstAppointment),
}
```

Estimates: não setar `criadoEm`.

### 5.2. Propagar `criadoEm` aos payloads

`propose` já espalha `extra`. Incluir `criadoEm: want.criadoEm ?? null` nos dois
`push`: `allCreates` e `allMoves`.

### 5.3. Helper de customFields de data (campo "Agendado Para" único data-hora)

No topo de `syncClinicClinicorp`: `const dateCfg = clinic.steps?._dates ?? null`.

```js
// Sem _dates → LEGADO (keys 'data'/'hor-rio'); NÃO alterar o legado.
function buildDateCustomFields(quando, time, criadoEm) {
  if (!dateCfg) {
    return quando ? { data: fmtDateBR(quando), ...(time ? { 'hor-rio': time } : {}) } : null
  }
  const cf = {}
  const sf = dateCfg.scheduledFor
  if (sf?.key && quando) {
    // "Agendado Para" é campo ÚNICO data-hora: "17/07/2026 09:00"
    cf[sf.key] = `${fmtDateBR(quando)}${time ? ' ' + time : ''}`
  }
  const ca = dateCfg.createdAt
  if (ca?.key && criadoEm) cf[ca.key] = fmtDateBR(criadoEm) // "Agendado em" (só data)
  return Object.keys(cf).length ? cf : null
}
```

### 5.4. Usar o helper + remover dueDate

- **Create** (~linha 352): montar `const cf = buildDateCustomFields(c.quando, c.time, c.criadoEm)`,
  incluir `...(cf ? { customFields: cf } : {})`, **manter** `metadata` com
  `clinicorp_patient_id`, `clinicorp_origem` e `clinicorp_event_date`.
  **REMOVER** a linha do `dueDate`. **NÃO** criar `clinicorp_scheduled_at` (cancelada).
- **Move** (~linha 340): `const cf = buildDateCustomFields(m.quando, m.time, m.criadoEm)`;
  `if (cf) { body.customFields = cf; fields.push('customFields') }`;
  manter `body.metadata.clinicorp_event_date = m.quando`.

### 5.5. Mapa CRC explícito (substitui a adivinhação)

Ler o mapa: `const crcMap = clinic.steps?._crcMap ?? []`.

Nova resolução, usada no lugar de `findAgendadorTag(crcNome, panel.tags)`:

```js
// Normaliza p/ comparar nomes (acento/caixa/espaços). Reusar `normTag` existente.
function resolveCrcTagId(createUserName) {
  if (!createUserName || !crcMap.length) return null
  const alvo = normTag(createUserName)
  for (const m of crcMap) {
    if (!m.clinicorpName || !m.tagId) continue
    if (normTag(m.clinicorpName) === alvo) return m.tagId
  }
  return null
}
```

No ponto do create onde hoje chama `findAgendadorTag`:

```js
const crcNome  = agendadorByPatient.get(pid) ?? null
const crcTagId = resolveCrcTagId(crcNome)          // SÓ o mapa do setup
if (crcNome && !crcTagId) summary.unmatchedCrc.add(crcNome) // sem match → revisão
```

> ⚠️ **Remover do caminho principal** a chamada a `findAgendadorTag`. Pode-se
> **manter a função e a tabela `NICKNAMES` no arquivo** (não referenciadas) ou
> apagá-las — preferível apagar para não confundir. **Não** reintroduzir
> adivinhação: decisão 7 é mapa-só. O card ainda é criado sem a etiqueta CRC
> quando não há match (nunca bloquear a criação por causa da CRC).

> **Etiqueta da UNIDADE** (`unit.tagId`, ex: BUENO/ELDORADO) **continua igual** —
> não é CRC, não muda. O create segue anexando `[unit.tagId, crcTagId].filter(Boolean)`.

## 6. `api/dashboard.js` — expor `scheduledAt`

No `cards.map` (~linha 220), a partir do resultado do `extractCard`:

```js
scheduledAt: appt?.scheduledAt ?? null, // NOVO: "Agendado em" (barra Agendaram)
```

(Vem do `_extract.scheduledAt` via §5A. Se a clínica não configurou, fica `null`.)

## 7. `src/utils/parseCards.js` — barra "Agendaram" pela data "Agendado em"

### 7.1. Janela de "agendou"

```js
/** O lead foi AGENDADO no período? (barra "Agendaram")
 *  Usa a data "Agendado em" (c.scheduledAt), preenchida por CRC/IA/sync.
 *  Fallback: data efetiva, para cards sem esse campo (legado/sem extração). */
export function scheduledInPeriod(c, from, to) {
  const d = c?.scheduledAt ?? effectiveDate(c)
  return Boolean(d && d >= from && d <= to)
}
```

### 7.2. `computeFunnel` + `funnelOf`

```js
export function computeFunnel(cards, from, to, funnelCfg) {
  if (!cards?.length) return null
  const inRange     = cards.filter(c => inPeriod(c, from, to))
  const entrou      = cards.filter(c => createdInPeriod(c, from, to)).length
  const agendouCards = cards.filter(c => scheduledInPeriod(c, from, to)) // NOVO
  return funnelOf(inRange, funnelCfg, { entrou, agendouCards })
}
```

Em `funnelOf`, calcular `agendou` do `opts.agendouCards` quando presente; senão,
manter `sumTypes(stages.agendou)` (legado e `breakdownByDimension` não regridem):

```js
const agendou = opts.agendouCards
  ? opts.agendouCards.filter(c => (stages.agendou ?? []).includes(c.stepType)).length
  : sumTypes(stages.agendou)
```

> ⚠️ Não alterar `compareceu`/`fechou`/`decididos`/taxas. `taxaAgendamento =
> agendou/entrou` segue válida. `breakdownByDimension` NÃO passa `agendouCards`.

## 8. `ClinicWizard.jsx` + `metricTypes.js` (/setup)

### 8.1. Etapa Extração — sub-seção "Datas do Clinicorp"

Dois seletores, populados pelo dropdown `customFields` (que `api/admin/panels.js`
já devolve, incluindo os que vivem só nos cards):
- **"Campo Agendado Para (data+hora da consulta)"** → `_dates.scheduledFor.key`
- **"Campo Agendado em (dia que agendou)"** → `_dates.createdAt.key`

Pré-selecionar por heurística (`/agendado.?para/i`, `/agendado.?em/i`), editável.

### 8.2. Persistir `_dates` e ajustar `_extract` junto

- Gravar `_dates` (§3) no `steps`. Sem escolha → não gravar (legado).
- Apontar `_extract.date[0] = { from: 'customFields.<scheduledFor.key>', format:'DMY' }`
  (dueDate/description antigos viram fallback nas posições seguintes).
- Apontar `_extract.scheduledAt[0] = { from: 'customFields.<createdAt.key>', format:'DMY' }`.
- Como "Agendado Para" é data-hora único, o `_extract.time` deve extrair a hora
  **da mesma string** (regex de hora sobre o mesmo customField), OU manter a hora
  fora do dashboard se não for usada. **Validar no preview** (`countExtractHits`).

### 8.3. Nova etapa/sub-seção — Mapa CRC

Na etapa Dimensões (ou uma sub-seção "CRC / quem agendou"): listar as etiquetas
de CRC do painel (já vêm em `panel.tags` com `suggestDimension` marcando as de
"Agendador") e, para cada uma que o admin quiser mapear, um campo de texto
**"Nome no Clinicorp (CreateUserName)"**. Salvar em `steps._crcMap` (§3).
- Pré-preencher `tagName` com o nome da etiqueta; `clinicorpName` em branco.
- Só entram no `_crcMap` as linhas com `clinicorpName` preenchido.

## 9. Verificações que o usuário pediu

### 9.1. Duplicação — ✅ correta, NÃO alterar
Dedup por `clinicorp_patient_id` + telefone (`phoneKey`) + `CUTOFF`/`syncSince`.
As mudanças só adicionam campos de data e trocam a resolução de CRC; a key de
dedup continua igual.

### 9.2. Cron — ✅ correto, NADA a mudar
`7 * * * *` + `workflow_dispatch`; matrix por accountId; `sync_log`; `CRON_SECRET`.
Nenhum env/secret novo.

### 9.3. Banco — ✅ sem schema
`_dates` e `_crcMap` no JSONB `steps`. `sync_log` já criada. Migração por clínica
ao re-salvar no wizard. **Opcional** (perguntar): backfill de "Agendado em" nos
cards já sincronizados, adaptando `sync-prototype/backfill-eventdate.js`.

## 10. Passo a passo detalhado (para o executor)

1. `src/utils/extract.js`: §5A. Testar `extractCard` com um `_extract.scheduledAt`
   fictício sobre um card de amostra (deve devolver a data; ausente → null).
2. `clinicorpSync.js`: §5.1 → §5.5. Depois:
   `node --input-type=module -e "import('./src/server/clinicorpSync.js').then(()=>console.log('ok'))"`.
3. `api/dashboard.js`: §6 (uma linha).
4. `src/utils/parseCards.js`: §7. Conferir que card sem `scheduledAt` cai no
   fallback e mantém o número de hoje.
5. `metricTypes.js` + `ClinicWizard.jsx`: §8 (datas + mapa CRC).
6. **Validação local read-only:** `npm run dev`; `/setup` → editar IBS (padrão
   certo): ver seletores de data populados, preview de extração achando a data, e
   o mapa CRC listando as etiquetas. **NÃO** disparar sync de produção ainda.
7. **Piloto GDLE:** configurar `_dates` (`agendado-para`/`agendado-em-`), `_crcMap`
   (ex: GABI→"Gabriela …"), ajustar `_extract`, salvar. Sync só dela
   (`?accountId=<GDLE>`) e conferir no painel:
   - "Agendado em" = dia que agendou; "Agendado Para" = data/hora da consulta;
   - vencimento NÃO recebe mais data;
   - card criado por agendamento da Gabi recebe a etiqueta GABI.
8. Conferir no **dashboard** GDLE: barra "Agendaram" conta pela data "Agendado em";
   entrada do lead pela criação do card; futuros pela "Agendado Para".
9. **Migrar Lumine** ao padrão novo (decisão 5), mesma conferência.
10. Demais clínicas via wizard.
11. `/code-review` no diff; sanity-check de segredos; commit + push **só após
    aprovação do usuário**.

## 11. Guardrails (o que NÃO pode acontecer)

- ❌ Não alterar dedup (`clinicorp_patient_id`, `phoneKey`, `cardsByPhone`).
- ❌ Não alterar `CUTOFF`/`syncSince`, `propose`/prioridades, `resolveStep`,
  `rankOfStep`/anti-regressão, paginação.
- ❌ Não reintroduzir adivinhação de CRC — mapa `_crcMap` é a única fonte
  (decisão 7). Sem match → card criado sem etiqueta CRC + `unmatchedCrc`.
- ❌ Não criar `metadata.clinicorp_scheduled_at` (cancelada). "Agendado em" é
  customField do card lido via `_extract`.
- ❌ Não remover `clinicorp_event_date` nem `clinicorp_patient_id`.
- ❌ Não usar `dueDate` para a data da consulta (removido).
- ❌ Não tornar keys de data fixas no código (configuráveis por clínica).
- ❌ Não mudar `compareceu`/`fechou`/taxas — só a janela de `agendou`.
- ❌ Não mudar a etiqueta de UNIDADE (`unit.tagId`) — só a de CRC muda de método.
- ❌ Não mudar o cron nem criar env/secret novo.
- ❌ Clínicas sem `_dates`/`_crcMap` continuam idênticas a hoje (legado intacto).
- ❌ Não commitar tokens reais (sanity-check antes do commit).
