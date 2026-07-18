-- Auditoria do ingestor de cards (PLANO_INGESTAO_E_PROCESSO.md, FASE A2).
-- Rodar UMA VEZ no SQL Editor do Supabase (mesmo modelo do sync_log).

create table if not exists public.ingest_log (
  id          bigint generated always as identity primary key,
  executed_at timestamptz not null default now(),
  account_id  uuid        not null,
  clinic_name text,
  fetched     int         not null default 0,   -- cards lidos da Helena
  upserted    int         not null default 0,   -- linhas gravadas em `cards`
  frozen      int         not null default 0,   -- em etapa terminal estável
  errors      jsonb,                            -- null = rodada limpa
  duration_ms int
);

create index if not exists ingest_log_account_id_executed_at
  on public.ingest_log (account_id, executed_at desc);

alter table public.ingest_log enable row level security;  -- sem policies: só service key

-- Saúde do ingestor (última rodada por clínica):
--   select distinct on (account_id) account_id, clinic_name, executed_at,
--          fetched, upserted, errors
--     from ingest_log order by account_id, executed_at desc;
