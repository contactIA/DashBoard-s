-- Tabela de auditoria do sync Clinicorp → Helena.
-- Rodar UMA VEZ no Supabase: Dashboard → SQL Editor → colar → Run.
-- O endpoint api/cron/sync-clinicorp.js insere uma linha por clínica a cada
-- rodada (best-effort: se a tabela não existir, o sync segue funcionando e
-- só loga o erro no console).

create table if not exists public.sync_log (
  id            bigint generated always as identity primary key,
  executed_at   timestamptz not null default now(),
  account_id    uuid        not null,
  clinic_name   text,
  moved         int         not null default 0,
  created       int         not null default 0,
  failed        int         not null default 0,
  errors        jsonb,      -- lista de mensagens de erro da rodada (null = sem erros)
  unmatched_crc jsonb,      -- nomes de CRC sem etiqueta correspondente na Helena
  duration_ms   int
);

-- Consultas por clínica e por período são o uso principal
create index if not exists sync_log_account_id_executed_at
  on public.sync_log (account_id, executed_at desc);

-- RLS ligado SEM políticas: só a service_role key (backend) lê/escreve;
-- as chaves públicas (anon/authenticated) não enxergam nada.
alter table public.sync_log enable row level security;

-- Opcional (manutenção): apagar logs com mais de 90 dias, rodar quando quiser:
--   delete from public.sync_log where executed_at < now() - interval '90 days';
