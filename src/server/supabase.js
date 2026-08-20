// Único ponto do repo que monta chamada para o PostgREST do Supabase.
//
// POR QUE EXISTE: as tabelas deste projeto (`clinics`, `cards`, `sync_log`,
// `ingest_log`) estão saindo do schema `public` para um schema `dashboards`
// dedicado — ver Clinic-Control#71. Enquanto elas moram em `public`, que é o
// schema default do PostgREST, nenhuma chamada precisa dizer em que schema
// está mexendo. Fora do default, TODA chamada precisa: `Accept-Profile` na
// leitura e `Content-Profile` na escrita.
//
// Antes deste arquivo esses headers estavam duplicados em ~15 literais
// espalhados por api/, src/server/ e scripts/, cada arquivo com seu próprio
// `sb()`/`sbHeaders()`. Um único call site esquecido no corte não daria erro de
// build nem de lint — daria 404 do PostgREST só naquele caminho, e nos scripts
// só meses depois, quando alguém precisasse rodar aquele script.
//
// ENV LIDA SOB DEMANDA, de propósito. Os `scripts/*.mjs` carregam o `.env` no
// CORPO deles (lendo o arquivo à mão para dentro de process.env), e imports ESM
// são avaliados ANTES do corpo do módulo que importa. Ler process.env no topo
// daqui devolveria undefined em todo script.

export const supabaseUrl = () => process.env.SUPABASE_URL;
export const supabaseKey = () => process.env.SUPABASE_SERVICE_KEY;

/**
 * Schema onde vivem as tabelas. Default `public` até a migração #71 flipar a
 * env var — o código sobe com o default, as tabelas são movidas, e só então
 * `DASHBOARDS_DB_SCHEMA=dashboards` entra. Rollback = tirar a env var.
 */
export const dbSchema = () => process.env.DASHBOARDS_DB_SCHEMA ?? "public";

/**
 * Headers de autenticação + schema. `extra` vem por último, então o call site
 * pode sobrescrever (ex: `Prefer`, `Range`, `Content-Type`).
 *
 * Manda `Accept-Profile` e `Content-Profile` SEMPRE. O PostgREST usa o que se
 * aplica ao método (Accept na leitura, Content na escrita) e ignora o outro —
 * mandar os dois evita ter que decidir, em cada um dos ~20 call sites, se
 * aquela chamada lê ou escreve. Um erro nessa decisão seria silencioso.
 */
export function sbHeaders(extra = {}) {
  const key = supabaseKey();
  const schema = dbSchema();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Accept-Profile": schema,
    "Content-Profile": schema,
    ...extra,
  };
}

/** `fetch` cru com URL e headers montados. Use quando precisar do Response. */
export function sbFetch(path, init = {}) {
  return fetch(`${supabaseUrl()}/rest/v1${path}`, {
    ...init,
    headers: sbHeaders(init.headers),
  });
}

/** Versão que já parseia o JSON e lança em status de erro. */
export async function sb(path, init = {}) {
  const res = await sbFetch(path, init);
  const body = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null;
}
