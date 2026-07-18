-- Token de acesso por clínica (PLANO_INGESTAO_E_PROCESSO.md, B5.1 — LGPD).
-- Rodar no SQL Editor do Supabase (DDL não roda via REST com service key).
--
-- A coluna nasce preenchida para todas as clínicas (default gen_random_uuid()),
-- mas o dashboard SÓ exige o token quando steps._flags.requireToken = true —
-- virada gradual, clínica por clínica, sem quebrar link existente.

alter table clinics
  add column if not exists access_token uuid not null default gen_random_uuid();

-- Conferir os tokens gerados (para montar as URLs novas):
--   select name, slug, access_token from clinics order by name;
--
-- Ligar a exigência para UMA clínica (depois de entregar a URL nova a ela):
--   update clinics
--      set steps = jsonb_set(steps, '{_flags,requireToken}', 'true'::jsonb, true)
--    where slug = '<slug-da-clinica>';
--
-- URL nova do dashboard: https://<dominio>/?clinic=<slug>&t=<access_token>
--
-- Reverter (emergência): mesmo update com 'false'::jsonb.
