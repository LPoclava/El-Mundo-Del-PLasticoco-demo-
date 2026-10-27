-- Roles y perfiles (reemplaza a public.staff). Ver docs/autorizacion-roles.md.
-- Esta migración solo AGREGA objetos: no cambia permisos existentes.

create type public.app_role as enum ('empleado', 'gerente', 'ceo');

-- Un perfil por persona con acceso al sistema. El correo vive en auth.users (no se duplica).
-- El rol NUNCA se lee del token ni de user_metadata (editable por el usuario): solo de esta tabla.
create table public.profiles (
  -- restrict: un usuario con perfil no se puede borrar de Auth; se desactiva.
  user_id uuid primary key references auth.users (id) on delete restrict,
  display_name text not null check (btrim(display_name) <> '' and char_length(display_name) <= 80),
  role public.app_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Rol vigente del usuario autenticado; null si no tiene perfil o está inactivo.
create function public.current_app_role() returns public.app_role
  language sql stable security definer set search_path = ''
  as $$ select p.role from public.profiles p where p.user_id = auth.uid() and p.active $$;

-- true si el usuario activo tiene al menos el rol pedido (empleado < gerente < ceo).
create function public.has_role_at_least(min_role public.app_role) returns boolean
  language sql stable security definer set search_path = ''
  as $$ select coalesce(public.current_app_role() >= min_role, false) $$;

revoke execute on function public.current_app_role(), public.has_role_at_least(public.app_role)
  from public, anon;
grant execute on function public.current_app_role(), public.has_role_at_least(public.app_role)
  to authenticated;

-- La API solo lee perfiles. Todo cambio pasa por las funciones admin_* (migración 2).
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create policy profiles_read_own on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
-- Los gerentes ven el equipo (nombres y roles) para leer la auditoría; solo lectura.
create policy profiles_read_managers on public.profiles for select to authenticated
  using ((select public.has_role_at_least('gerente')));
