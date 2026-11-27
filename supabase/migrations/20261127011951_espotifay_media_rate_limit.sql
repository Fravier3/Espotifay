-- Aplicada en el proyecto Supabase "Desarollos Fran" (syyealdlapxmpeccaary).
-- Límite de audio por oyente (400 peticiones por hora) para el backend de Vercel.
create table espotifay_private.media_limits (
  bucket text primary key,
  window_start timestamptz not null,
  requests integer not null check (requests >= 0)
);
alter table espotifay_private.media_limits enable row level security;

-- Llamada por el backend de Vercel con el hash SHA-256 de la IP del oyente.
create function public.espotifay_media_allow(p_client text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_window timestamptz := date_trunc('hour', now()); n integer;
begin
  if p_client is null or p_client !~ '^[a-f0-9]{64}$' then return false; end if;
  insert into espotifay_private.media_limits as l(bucket, window_start, requests) values (p_client, v_window, 1)
  on conflict (bucket) do update
    set window_start = excluded.window_start,
        requests = case when l.window_start = v_window then l.requests + 1 else 1 end
    where l.window_start <> v_window or l.requests < 400
  returning requests into n;
  if not found then return false; end if;
  if random() < 0.01 then delete from espotifay_private.media_limits where window_start < now() - interval '1 day'; end if;
  return true;
end; $$;
revoke all on function public.espotifay_media_allow(text) from public;
grant execute on function public.espotifay_media_allow(text) to anon;
