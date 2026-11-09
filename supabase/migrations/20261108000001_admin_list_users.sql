-- Listado de usuarios para la pantalla «Usuarios y permisos» del panel.
-- El correo vive en auth.users y la API no puede leerlo: esta función lo expone SOLO al CEO activo, junto con el perfil
-- (rol, estado, nombre). Incluye las cuentas de Auth que todavía no tienen perfil, para que el CEO pueda asignarles uno
-- con admin_create_profile. Solo agrega una función: no cambia tablas, políticas ni permisos existentes.
-- No devuelve contraseñas, tokens ni metadatos: solo correo, fechas y lo que ya guarda public.profiles.

create function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role public.app_role,
  active boolean,
  has_profile boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
  language plpgsql stable security definer set search_path = ''
  as $$
begin
  if not public.has_role_at_least('ceo') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
    select u.id,
           u.email::text,
           p.display_name,
           p.role,
           p.active,
           p.user_id is not null,
           u.created_at,
           u.last_sign_in_at
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    order by (p.user_id is null), p.role desc nulls last, lower(coalesce(p.display_name, u.email::text));
end $$;

revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
