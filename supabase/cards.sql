-- Tabela de ingestão de cards (PLANO_INGESTAO_E_PROCESSO.md, FASE A1).
-- Rodar no SQL Editor do Supabase (DDL não roda via REST com service key).
--
-- Fonte: painéis Helena, alimentada pelo ingestor (FASE A2) no cron.
-- O dashboard passa a ler daqui quando steps._flags.readFromDb = true (A3).
-- RLS ligada SEM policies = só a service key acessa (mesmo modelo de sync_log).

create table if not exists cards (
  account_id   text        not null,              -- clínica (clinics.account_id)
  card_id      text        not null,              -- id do card na Helena
  step_id      text        not null,
  step_type    text,                              -- resolvido pelo mapeamento do /setup (null = não mapeado)
  title        text,
  name         text,                              -- extraído (_extract)
  phone        text,
  date         date,                              -- "Agendado Para" extraído
  "time"       text,
  scheduled_at date,                              -- "Agendado em" extraído
  event_date   date,                              -- metadata.clinicorp_event_date
  value        numeric,                           -- monetaryAmount
  dims         jsonb       not null default '{}', -- dimensões resolvidas (origem, campanha, …)
  created_at   timestamptz,                       -- createdAt da Helena
  updated_at   timestamptz,                       -- updatedAt da Helena
  raw          jsonb,                             -- card cru: permite REPROCESSAR extração sem re-buscar a Helena
  frozen       boolean     not null default false,-- etapa terminal + estável: ingestor não re-busca
  synced_at    timestamptz not null default now(),
  primary key (account_id, card_id)
);

-- Índices pensados nas queries do dashboard (filtro por clínica + período)
create index if not exists cards_period  on cards (account_id, date);
create index if not exists cards_created on cards (account_id, created_at);
create index if not exists cards_step    on cards (account_id, step_type);
create index if not exists cards_active  on cards (account_id) where not frozen;

alter table cards enable row level security;  -- sem policies: só service key

-- Consultas úteis:
--   Contagem por clínica (conferir com o total do painel na virada):
--     select account_id, count(*), count(*) filter (where frozen) as congelados
--       from cards group by account_id;
--   Cards agendados sem data (a fila de correção manual do aviso amarelo):
--     select account_id, card_id, title from cards
--      where step_type not in ('lead','notScheduled') and step_type is not null
--        and date is null;
