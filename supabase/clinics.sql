-- Tabela central do dashboard: uma linha por clínica.
-- Rodar UMA VEZ no Supabase: Dashboard → SQL Editor → colar → Run.
--
-- ATENÇÃO — ESTE ARQUIVO É UMA RECONSTRUÇÃO, NÃO O DDL ORIGINAL.
-- A tabela `clinics` nasceu antes de existir qualquer .sql neste diretório:
-- foi criada à mão no SQL Editor e nunca versionada. Até 2026-08-20 a definição
-- dela existia SÓ dentro do banco — um clone deste repo não reconstruía a
-- tabela mais importante do projeto. Este arquivo fecha esse buraco, gerado por
-- introspecção do `information_schema` do projeto jggfnfxdtfqeqyvxufgu.
--
-- Consequência de ter sido reconstruído: a ORDEM em que as colunas apareceram
-- e os nomes originais das constraints estão preservados (vieram do catálogo),
-- mas não há histórico — não se sabe qual alteração veio quando. Daqui pra
-- frente, mudança em `clinics` entra como arquivo novo, não editando este.

create table if not exists public.clinics (
  -- Conta da clínica na Helena (companyId). É a chave por onde todo o resto do
  -- sistema encontra a clínica — inclusive o Clinic Control, que casa este
  -- valor com `clinic_control.clinic_integrations.company_id`.
  account_id   uuid        not null,
  name         text        not null,
  -- Bearer da API da Helena, EM TEXTO PLANO. O Clinic Control cifra a mesma
  -- credencial (AES-256-GCM) no schema dele. Assimetria conhecida e registrada
  -- — ver docs/reference/schema-dashboards.md no Clinic-Control.
  token        text        not null,
  panel_id     uuid        not null,
  -- Ticket médio da clínica, em reais. Usado quando o card não tem valor.
  ticket       integer,
  -- Configuração inteira da clínica: mapa de etapas → metricType, mais as
  -- chaves reservadas _extract/_dims/_funnel/_dates/_clinicorp/_flags/_ignored.
  -- Gerado pelo assistente de cadastro (buildStepsConfig em
  -- src/admin/metricTypes.js) e consumido por src/utils/parseCards.js.
  steps        jsonb       not null,
  created_at   timestamptz not null default now(),
  -- Slug da URL (`/?clinic=<slug>`). Nullable porque as primeiras clínicas
  -- foram cadastradas antes do slug existir e eram acessadas por
  -- `?accountId=<uuid>` — esse caminho ainda funciona em api/dashboard.js.
  slug         text,
  -- Token de acesso por clínica (LGPD). Nasce preenchido para todas, mas só é
  -- EXIGIDO quando steps._flags.requireToken = true — virada gradual, clínica
  -- por clínica. Historicamente adicionado por supabase/access_token.sql, que
  -- usa `add column if not exists` e por isso continua sendo no-op depois deste
  -- arquivo. Mantido aqui para que a tabela seja reconstruível de uma vez.
  access_token uuid        not null default gen_random_uuid(),

  constraint clinics_pkey     primary key (account_id),
  constraint clinics_slug_key unique (slug)
);

-- RLS ligada SEM políticas: só a service_role key (backend) lê/escreve; as
-- chaves públicas (anon/authenticated) não enxergam nada. Mesmo modelo de
-- sync_log/ingest_log/cards.
alter table public.clinics enable row level security;

-- Conferência rápida do que está cadastrado:
--   select name, slug, panel_id, ticket from public.clinics order by name;
