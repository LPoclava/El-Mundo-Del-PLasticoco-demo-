-- Controles de seguridad sobre perfiles: nadie se eleva a sí mismo, el último CEO activo es
-- intocable y los cambios de rol o estado pasan solo por funciones que exigen ser CEO.

create function public.profiles_guard() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_uid uuid := auth.uid();  -- null = SQL Editor / migraciones (acceso administrativo de emergencia)
begin
  if tg_op = 'INSERT' then
    if v_uid is not null and not public.has_role_at_least('ceo') then
      raise exception 'Solo el CEO puede crear perfiles' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' and v_uid is not null then
    raise exception 'Los perfiles no se eliminan: desactivá al usuario' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id no se puede cambiar' using errcode = '42501';
    end if;
    if v_uid is not null
       and (new.role is distinct from old.role or new.active is distinct from old.active) then
      if not public.has_role_at_least('ceo') then
        raise exception 'Solo el CEO puede cambiar roles o estados' using errcode = '42501';
      end if;
      if v_uid = old.user_id then
        raise exception 'No podés cambiar tu propio rol ni tu estado' using errcode = '42501';
      end if;
    end if;
  end if;

  -- Último CEO activo: no se degrada, desactiva ni elimina. El candado serializa dos cambios
  -- simultáneos (A degrada a B mientras B degrada a A) para que no queden cero CEO.
  if old.role = 'ceo' and old.active
     and (tg_op = 'DELETE' or new.role <> 'ceo' or not new.active) then
    perform pg_advisory_xact_lock(hashtextextended('profiles:last_ceo', 0));
    if not exists (select 1 from public.profiles p
                   where p.role = 'ceo' and p.active and p.user_id <> old.user_id) then
      raise exception 'No se puede dejar la aplicación sin un CEO activo' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke execute on function public.profiles_guard() from public, anon, authenticated;

create trigger profiles_guard before insert or update or delete on public.profiles
  for each row execute function public.profiles_guard();

-- Funciones de administración: solo CEO. El trigger anterior vuelve a controlarlo.
create function public.admin_create_profile(
  p_user_id uuid, p_display_name text, p_role public.app_role
) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if not public.has_role_at_least('ceo') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'El usuario no existe en Auth: crealo primero en Supabase Auth' using errcode = 'P0002';
  end if;
  perform set_config('app.via', 'admin_create_profile', true);
  insert into public.profiles (user_id, display_name, role, created_by)
  values (p_user_id, btrim(p_display_name), p_role, auth.uid());
end $$;

create function public.admin_set_role(p_user_id uuid, p_role public.app_role) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if not public.has_role_at_least('ceo') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform set_config('app.via', 'admin_set_role', true);
  update public.profiles set role = p_role where user_id = p_user_id;
  if not found then raise exception 'Perfil no encontrado' using errcode = 'P0002'; end if;
end $$;

create function public.admin_set_active(p_user_id uuid, p_active boolean) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if not public.has_role_at_least('ceo') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform set_config('app.via', 'admin_set_active', true);
  update public.profiles set active = p_active where user_id = p_user_id;
  if not found then raise exception 'Perfil no encontrado' using errcode = 'P0002'; end if;
end $$;

create function public.admin_set_display_name(p_user_id uuid, p_display_name text) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if not public.has_role_at_least('ceo') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform set_config('app.via', 'admin_set_display_name', true);
  update public.profiles set display_name = btrim(p_display_name) where user_id = p_user_id;
  if not found then raise exception 'Perfil no encontrado' using errcode = 'P0002'; end if;
end $$;

revoke execute on function
  public.admin_create_profile(uuid, text, public.app_role),
  public.admin_set_role(uuid, public.app_role),
  public.admin_set_active(uuid, boolean),
  public.admin_set_display_name(uuid, text)
  from public, anon;
grant execute on function
  public.admin_create_profile(uuid, text, public.app_role),
  public.admin_set_role(uuid, public.app_role),
  public.admin_set_active(uuid, boolean),
  public.admin_set_display_name(uuid, text)
  to authenticated;
