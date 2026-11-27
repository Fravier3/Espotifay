-- Aplicada en el proyecto Supabase "Desarollos Fran" (syyealdlapxmpeccaary).
-- Espotifay: biblioteca sincronizada por usuario (tablas independientes con prefijo espotifay_)
create table public.espotifay_libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  library jsonb not null default '{}'::jsonb,
  schema_version smallint not null default 1,
  updated_at timestamptz not null default now(),
  constraint espotifay_library_object check (jsonb_typeof(library) = 'object' and octet_length(library::text) <= 2000000)
);
comment on table public.espotifay_libraries is 'Espotifay: favoritas, playlists, historial y artistas de cada usuario.';
alter table public.espotifay_libraries enable row level security;
revoke all on public.espotifay_libraries from anon;
grant select, insert, update, delete on public.espotifay_libraries to authenticated;
create policy espotifay_read_own on public.espotifay_libraries for select to authenticated using ((select auth.uid()) = user_id);
create policy espotifay_insert_own on public.espotifay_libraries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy espotifay_update_own on public.espotifay_libraries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy espotifay_delete_own on public.espotifay_libraries for delete to authenticated using ((select auth.uid()) = user_id);

create function public.espotifay_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
create trigger espotifay_libraries_touch before insert or update on public.espotifay_libraries
  for each row execute function public.espotifay_touch();

-- Registro sin confirmación de correo, solo para Espotifay, con límite de intentos.
-- (La confirmación de correo del proyecto sigue activa para las demás apps.)
create schema if not exists espotifay_private;
revoke all on schema espotifay_private from public, anon, authenticated;
create table espotifay_private.signup_limits (
  bucket text primary key,
  window_start timestamptz not null,
  attempts integer not null check (attempts >= 0)
);
alter table espotifay_private.signup_limits enable row level security;

create function public.espotifay_sign_up(p_email text, p_password text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid := gen_random_uuid();
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text := coalesce(v_headers ->> 'cf-connecting-ip', split_part(v_headers ->> 'x-forwarded-for', ',', 1), 'desconocida');
  v_hour timestamptz := date_trunc('hour', now());
  k text; lim integer; n integer;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254
     or length(coalesce(p_password, '')) < 6 or octet_length(p_password) > 72 then
    return 'invalid';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then return 'exists'; end if;
  foreach k in array array['ip:' || encode(extensions.digest(trim(v_ip), 'sha256'), 'hex'), 'global'] loop
    lim := case when k = 'global' then 60 else 6 end;
    insert into espotifay_private.signup_limits as l(bucket, window_start, attempts) values (k, v_hour, 1)
    on conflict (bucket) do update
      set window_start = excluded.window_start,
          attempts = case when l.window_start = v_hour then l.attempts + 1 else 1 end
      where l.window_start <> v_hour or l.attempts < lim
    returning attempts into n;
    if not found then return 'limited'; end if;
  end loop;
  delete from espotifay_private.signup_limits where window_start < now() - interval '2 days';

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    is_sso_user, is_anonymous)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{"app":"espotifay"}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', '', false, false);
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now());
  return 'created';
exception when unique_violation then return 'exists';
end; $$;
revoke all on function public.espotifay_sign_up(text, text) from public;
grant execute on function public.espotifay_sign_up(text, text) to anon, authenticated;
