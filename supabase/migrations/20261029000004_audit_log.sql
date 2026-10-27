-- Auditoría: quién cambió qué, cuándo, con valores anteriores y nuevos. Solo se agrega, nunca se edita.
-- Límites (ver docs/autorizacion-roles.md): no registra lecturas, ni archivos de Storage, ni
-- cambios hechos con acceso de superusuario que desactive los triggers; los cambios desde el
-- SQL Editor quedan con actor vacío y source = 'sql'.

create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  -- Sin clave foránea a propósito: el historial sobrevive aunque el usuario desaparezca.
  actor_id uuid,
  actor_role public.app_role,
  table_name text not null,
  row_id text,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  -- 'api' = usuario autenticado; 'sql' = sin usuario (SQL Editor, migraciones).
  source text not null check (source in ('api', 'sql')),
  -- Función que originó el cambio (scan_set_price, admin_set_role...); informativo.
  via text,
  db_user text not null default session_user
);
create index audit_log_actor_idx on public.audit_log (actor_id, occurred_at desc);
create index audit_log_row_idx on public.audit_log (table_name, row_id, occurred_at desc);

create function public.audit_row_change() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_uid uuid := auth.uid();
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
begin
  -- Las columnas generadas (name_sort, search_text) son ruido: se derivan de name y brand.
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old) - 'name_sort' - 'search_text';
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new) - 'name_sort' - 'search_text';
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(t.k order by t.k), '{}') into v_changed
    from jsonb_object_keys(v_new) as t(k)
    where t.k <> 'updated_at' and v_new -> t.k is distinct from v_old -> t.k;
    if cardinality(v_changed) = 0 then
      return null;  -- actualización sin cambios reales: no se registra
    end if;
  end if;

  insert into public.audit_log
    (actor_id, actor_role, table_name, row_id, operation, old_data, new_data, changed_fields, source, via)
  values (
    v_uid,
    (select p.role from public.profiles p where p.user_id = v_uid),
    tg_table_name,
    coalesce(v_new, v_old) ->> case when tg_table_name = 'profiles' then 'user_id' else 'id' end,
    tg_op, v_old, v_new, v_changed,
    case when v_uid is null then 'sql' else 'api' end,
    nullif(current_setting('app.via', true), '')
  );
  return null;
end $$;
revoke execute on function public.audit_row_change() from public, anon, authenticated;

create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function public.audit_row_change();
create trigger audit_products after insert or update or delete on public.products
  for each row execute function public.audit_row_change();
create trigger audit_product_variants after insert or update or delete on public.product_variants
  for each row execute function public.audit_row_change();
create trigger audit_product_images after insert or update or delete on public.product_images
  for each row execute function public.audit_row_change();
create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();

-- Inmutable: ni siquiera el dueño de la tabla edita o borra por accidente (un superusuario
-- podría desactivar el trigger a propósito: ese límite está documentado).
create function public.audit_log_immutable() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  raise exception 'audit_log es de solo agregado' using errcode = '42501';
end $$;
create trigger audit_log_no_change before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.audit_log_immutable();

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

-- Empleado (y superiores): su propio historial.
create policy audit_read_own on public.audit_log for select to authenticated
  using (actor_id = (select auth.uid()) and (select public.has_role_at_least('empleado')));
-- Gerente: el catálogo, de todo el equipo.
create policy audit_read_catalog on public.audit_log for select to authenticated
  using ((select public.has_role_at_least('gerente'))
         and table_name in ('categories', 'products', 'product_variants', 'product_images'));
-- CEO: todo.
create policy audit_read_all on public.audit_log for select to authenticated
  using ((select public.has_role_at_least('ceo')));
