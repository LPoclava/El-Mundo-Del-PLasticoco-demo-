-- Etapa 1, fase 1 (b): acceso explícito del grupo de desarrollo (AImpulse Tech).
--
-- El rol CEO del comercio NO equivale a un usuario de desarrollo. Las funciones reservadas (hoy, el circuito fiscal) exigen estar
-- en esta tabla, y esa exigencia vive en la base: ocultar botones no alcanza.
--
-- Cómo se da de alta o de baja una cuenta: a mano, como propietario de la base (SQL Editor), nunca desde la API:
--   insert into public.developer_access (user_id, note) values ('<uuid de auth.users>', 'AImpulse Tech');
--   delete from public.developer_access where user_id = '<uuid>';
-- La tabla no tiene políticas ni permisos para anon ni authenticated: por la API no se puede leer, insertar ni borrar.
-- Solo agrega una tabla y funciones nuevas: no cambia nada existente.

create table public.developer_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);
alter table public.developer_access enable row level security;
revoke all on public.developer_access from public, anon, authenticated;
-- Sin políticas a propósito: nadie la toca por la API.

-- ¿La sesión actual es del grupo de desarrollo? Exige estar en la tabla Y tener un perfil activo (una cuenta desactivada pierde el acceso).
create function public.is_developer() returns boolean
  language sql stable security definer set search_path = ''
  as $$
  select exists (
    select 1
    from public.developer_access d
    join public.profiles p on p.user_id = d.user_id
    where d.user_id = auth.uid() and p.active
  )
$$;

-- Control interno que usan las funciones reservadas: falla con «No autorizado» si no es de desarrollo.
create function public.require_developer() returns void
  language plpgsql stable security definer set search_path = ''
  as $$
begin
  if not public.is_developer() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
end $$;

revoke execute on function public.is_developer() from public, anon;
grant execute on function public.is_developer() to authenticated;
-- require_developer no se invoca desde la API: solo desde otras funciones del propietario.
revoke execute on function public.require_developer() from public, anon, authenticated;
