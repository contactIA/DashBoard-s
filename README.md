# Dashboard Odontológico — Multi-Clínica

> **Dashboard de performance em tempo real para clínicas odontológicas**, integrado à plataforma Helena (WTS.chat) via API. Multi-clínica, sem redeploy — basta um `accountId` na URL.

---

## Visão Geral

```
https://seu-dominio.vercel.app/?clinic=ob-clinic
```

Cada clínica acessa seu próprio dashboard pelo slug configurado no setup (o formato antigo `?accountId=uuid` segue funcionando). As credenciais ficam seguras no **Supabase** — nunca expostas no frontend ou no repositório.

---

## Layout

### KPIs + Receita
```
┌─────────────────────────────────────────────────────────────────────┐
│  Total    Comparec.  Conversão   Faltas   Cancel.   Reagend.  Ticket│
│  66       33,3%      40,0%       66,7%    4         3         R$12k │
│  +340%    +44,4%     +20,0%      -13,3%   +300%     —         —     │
├──────────────────────────────────────────────────────────────────────┤
│  RECEITA · baseado nos valores reais dos cards                       │
│  ┌──────────────────────────┐  ┌──────────────────────────────────┐ │
│  │ Receita Fechada          │  │ Oportunidade Perdida             │ │
│  │ R$ 51.060                │  │ R$ 95.000                        │ │
│  │ 6 contratos fechados     │  │ 14 pacientes não fecharam        │ │
│  └──────────────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Gráfico + Distribuição por Etapa
```
┌──────────────────────────────────┬───────────────────────────────┐
│  Evolução temporal               │  Distribuição por etapa       │
│                                  │                               │
│     ╭─╮                          │  Agendou          ████  12   │
│    ╭╯ ╰╮     ╭─╮                 │  Compareceu NF    ███   8    │
│   ╭╯   ╰─────╯ ╰╮                │  Faltou           ██    5    │
│  ─────────────────────           │  Cancelou         █     3    │
│  Jan  Fev  Mar  Abr  Mai         │                               │
│                                  │  [ Período ] [ Geral ]        │
└──────────────────────────────────┴───────────────────────────────┘
```

### Tabela de Recuperáveis
```
┌──────────────────────────────────────────────────────────────────┐
│  Compareceu mas não fechou          RECUPERAVEL                  │
│  ┌──────────────┬──────────────┬──────────┬────────────────────┐ │
│  │ Paciente     │ Telefone     │ Data     │ Potencial          │ │
│  ├──────────────┼──────────────┼──────────┼────────────────────┤ │
│  │ Maria Silva  │ (11) 9xxxx   │ 20/05    │ R$ 8.500           │ │
│  │ Joao Souza   │ (21) 9xxxx   │ 18/05    │ sem valor          │ │
│  └──────────────┴──────────────┴──────────┴────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (React)                          │
│   ?accountId=uuid  →  fetchDashboard()  →  /api/dashboard      │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│               VERCEL SERVERLESS (api/dashboard.js)              │
│                                                                 │
│   1. Busca config da clinica no Supabase (accountId)            │
│   2. Chama Helena API (paginado, paralelo)                      │
│   3. Parseia cards + datas das descricoes                       │
│   4. Calcula ticket medio real                                  │
│   5. Retorna JSON compacto ao frontend                          │
└──────────┬──────────────────────────────┬───────────────────────┘
           │                              │
┌──────────▼──────────┐       ┌──────────▼──────────────────────┐
│     SUPABASE        │       │        HELENA API               │
│  tabela: clinics    │       │   api.wts.chat/crm/v1/panel     │
│  - account_id       │       │   - cards paginados             │
│  - token            │       │   - monetaryAmount              │
│  - panel_id         │       │   - stepId                      │
│  - steps (JSON)     │       │   - description (data/hora)     │
└─────────────────────┘       └─────────────────────────────────┘
```

---

## KPIs Calculados

| Indicador | Formula | Descricao |
|-----------|---------|-----------|
| **Comparecimento** | `(compareceu + fechou) / (compareceu + fechou + faltou)` | Taxa de presenca nas consultas |
| **Conversao** | `fechou / (compareceu + fechou)` | Taxa de fechamento entre os que vieram |
| **Faltas** | `faltou / (compareceu + fechou + faltou)` | Taxa de ausencia |
| **Ticket Medio** | `sum(monetaryAmount) / n fechados` | Calculado dos valores reais da API |
| **Receita Fechada** | `sum(monetaryAmount) dos converted` | Apenas valores reais, sem estimativa |
| **Oport. Perdida** | `sum(monetaryAmount) dos attended` | Pacientes que vieram mas nao fecharam |

> Cards sem `monetaryAmount` nao entram nos calculos de receita — aparecem em alerta separado com nome e telefone para acompanhamento.

---

## Estrutura do Projeto

```
DashBoard-s/
│
├── api/
│   ├── dashboard.js          # Serverless function (Vercel)
│   └── admin/
│       ├── panels.js         # Proxy Helena: listar paineis e steps (setup)
│       └── clinics.js        # CRUD de clinicas no Supabase (setup)
│
├── src/
│   ├── App.jsx               # Componente raiz, estado global, layout
│   ├── api.js                # fetchDashboard() — chamada ao backend
│   │
│   ├── admin/
│   │   ├── AdminApp.jsx      # /setup — gate de senha + lista de clinicas
│   │   ├── ClinicWizard.jsx  # Assistente: credenciais → painel → metricas → revisao
│   │   ├── adminApi.js       # Cliente das rotas /api/admin/*
│   │   └── metricTypes.js    # Tipos de metrica + sugestao automatica por titulo
│   │
│   ├── components/
│   │   ├── KpiStrip.jsx      # Faixa de KPIs com sparklines e deltas
│   │   ├── RevenueRow.jsx    # Cards de receita fechada e oportunidade
│   │   ├── TrendChart.jsx    # Grafico de evolucao temporal (Recharts)
│   │   ├── StepDistribution.jsx  # Barras por etapa (Periodo / Geral)
│   │   ├── LostTable.jsx     # Pacientes que compareceram e nao fecharam
│   │   ├── UpcomingTable.jsx # Proximos agendamentos
│   │   └── DateRangePicker.jsx   # Calendario customizado de selecao
│   │
│   └── utils/
│       ├── parseCards.js     # KPIs, receita, delta, getLost, getUpcoming
│       └── groupByTime.js    # Agrupamento por dia/semana/mes
│
├── .env.example              # Template de variaveis de ambiente
├── vercel.json               # Roteamento das serverless functions
└── vite.config.js            # Plugin local para emular /api em dev
```

---

## Tipos de Step (Helena)

Cada step do painel Helena e mapeado para um `type` semantico:

| type | Significado | Exemplos de step |
|------|-------------|-----------------|
| `scheduled` | Agendamento futuro | Agendou, Reagendou |
| `attended` | Compareceu, nao fechou | Compareceu e NAO Fechou |
| `converted` | Fechou contrato | Compareceu e Fechou |
| `missed` | Faltou | Faltou |
| `cancelled` | Cancelou | Cancelou |

---

## Como Adicionar uma Nova Clinica

### Via Setup (recomendado)

Acesse `/setup`, informe a senha de administrador (`ADMIN_SECRET`) e siga o assistente:

1. **Credenciais** — nome da clinica, slug da URL (sugerido automaticamente) + token Helena (`pn_...`)
2. **Painel** — o app lista os paineis da conta via API; selecione o que alimenta o dashboard
3. **Metricas** — cada step do painel recebe uma sugestao automatica de metrica (scheduled, attended, converted, missed, cancelled); ajuste tipos e cores, defina o ticket medio
4. **Revisao** — confira e salve; a URL `?clinic=slug` e gerada automaticamente (internamente o accountId e o `companyId` da conta Helena)

O painel tambem lista as clinicas cadastradas, com edicao (re-mapear steps, trocar token, ajustar ticket) e exclusao. Tokens nunca sao exibidos por completo apos o cadastro.

```
/setup  →  senha admin  →  listar paineis  →  mapear steps  →  URL pronta
```

### Via SQL (alternativa manual)

Insira um registro no Supabase — nenhum redeploy necessario:

```sql
INSERT INTO clinics (account_id, name, slug, token, panel_id, ticket, steps)
VALUES (
  'uuid-da-clinica',
  'Nome da Clinica',
  'slug-da-clinica',
  'Bearer pn_TOKEN_AQUI',
  'UUID_DO_PAINEL',
  12000,
  '{
    "agendou":             {"id": "UUID", "label": "Agendou",                 "color": "#6366F1", "type": "scheduled"},
    "reagendou":           {"id": "UUID", "label": "Reagendou",               "color": "#8B5CF6", "type": "scheduled"},
    "cancelou":            {"id": "UUID", "label": "Cancelou",                "color": "#EF4444", "type": "cancelled"},
    "compareceuNaoFechou": {"id": "UUID", "label": "Compareceu e NAO Fechou", "color": "#F59E0B", "type": "attended"},
    "compareceuFechou":    {"id": "UUID", "label": "Compareceu e Fechou",     "color": "#10B981", "type": "converted"},
    "faltou":              {"id": "UUID", "label": "Faltou",                  "color": "#F97316", "type": "missed"}
  }'::jsonb
);
```

URL gerada automaticamente:
```
https://dashboard.vercel.app/?clinic=slug-da-clinica
```

---

## Rodando Localmente

```bash
# 1. Instalar dependencias
npm install

# 2. Criar arquivo de variaveis de ambiente
cp .env.example .env
# Preencher SUPABASE_URL e SUPABASE_SERVICE_KEY

# 3. Rodar em desenvolvimento
npm run dev

# Acessar:
# http://localhost:5174/?accountId=SEU_ACCOUNT_ID
```

### Variaveis de Ambiente

```env
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
ADMIN_SECRET=senha-da-pagina-de-onboarding
```

No Vercel: adicione em Settings → Environment Variables antes do deploy.

---

## Deploy (Vercel)

```bash
vercel --prod
```

Ou conecte o repositorio GitHub na Vercel UI e configure as Environment Variables. O `vercel.json` ja esta configurado para rotear `/api/*` para as serverless functions.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite |
| Estilizacao | Tailwind CSS v3 |
| Graficos | Recharts |
| Calendario | Customizado (date-fns) |
| Backend | Vercel Serverless Functions |
| Banco de dados | Supabase (PostgreSQL) |
| CRM | Helena / WTS.chat API |
| Deploy | Vercel |

---

## Seguranca

- Token Helena e service key Supabase ficam apenas no servidor, nunca no bundle do frontend
- RLS (Row Level Security) habilitado na tabela `clinics`
- `.env` no `.gitignore` — credenciais nunca vao para o repositorio
- Pagina `/setup` e rotas `/api/admin/*` protegidas por `ADMIN_SECRET` (header `x-admin-secret`)
- Tokens das clinicas sao exibidos mascarados apos o cadastro (`pn_xxxx…xxxx`)

---

*Dashboard Odontologico v2 · Escalarodonto*
