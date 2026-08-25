-- Cache id->telefone de contatos da Helena.
--
-- Motivo: GET /crm/v1/panel/card?IncludeDetails=Contacts devolve o contato só
-- como {id,name} — SEM telefone. O sync precisa do telefone para o dedup (sem
-- ele o dedup fica cego e cria card duplicado; incidente real de 16/07), então
-- fazia um GET /core/v1/contact/{id} para CADA card: ~4.000 requisições por
-- rodada só na IBS, contra o teto de ~5.000/5min da Helena. Era a causa dos
-- 429 que derrubavam o sync e a própria Helena.
--
-- Telefone de contato praticamente não muda, então cabe cache persistente: a
-- primeira rodada preenche, as seguintes leem daqui e só buscam ids novos.
create table if not exists dashboards.contact_phone (
  contact_id text primary key,
  phone      text,
  fetched_at timestamptz not null default now()
);

comment on table dashboards.contact_phone is
  'Cache id->telefone de contatos Helena. Evita ~1 request por card por rodada (rate limit 5000/5min).';

-- RLS ligado SEM políticas: só a service_role key (backend) lê/escreve.
alter table dashboards.contact_phone enable row level security;

-- Manutenção opcional: telefone muda raríssimo, mas se quiser forçar releitura
--   delete from dashboards.contact_phone where fetched_at < now() - interval '180 days';
