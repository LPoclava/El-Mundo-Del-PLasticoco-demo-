-- Pasa a los usuarios de public.staff (hoy: la cuenta corporativa de AImpulse Tech) al rol ceo.
-- No inventa usuarios ni identificadores: usa solo lo que ya está en staff y en auth.users.
-- Aborta (y no cambia nada) si staff está vacía o si no queda un CEO activo.

do $$
begin
  if not exists (select 1 from public.staff) then
    raise exception 'public.staff está vacía: no hay cuenta para asignar como CEO inicial';
  end if;

  insert into public.profiles (user_id, display_name, role, active)
  select s.user_id,
         coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
                  nullif(split_part(u.email, '@', 1), ''),
                  'Cuenta corporativa'),
         'ceo', true
  from public.staff s
  join auth.users u on u.id = s.user_id
  on conflict (user_id) do nothing;

  if not exists (select 1 from public.profiles where role = 'ceo' and active) then
    raise exception 'No quedó ningún CEO activo: se cancela la migración';
  end if;
end $$;
