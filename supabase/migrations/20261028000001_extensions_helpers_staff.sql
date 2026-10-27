-- Extensiones, funciones auxiliares y personal autorizado.
-- Ver docs/modelo-de-datos.md.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent no es "immutable"; este envoltorio permite usarlo en columnas generadas e índices.
create function public.f_unaccent(text) returns text
  language sql immutable parallel safe strict set search_path = ''
  as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

create function public.set_updated_at() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Personal autorizado. Se da de alta a mano: crear el usuario en Supabase Auth
-- e insertar su id acá desde el SQL editor. Sin políticas: la API no puede leerla ni escribirla.
create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.staff enable row level security;

create function public.is_staff() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select exists (select 1 from public.staff where user_id = auth.uid()) $$;

revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;
