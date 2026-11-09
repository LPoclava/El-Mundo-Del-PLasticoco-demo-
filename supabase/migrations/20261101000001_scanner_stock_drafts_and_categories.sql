-- Escáner como centro de operaciones: entradas y ajustes de stock con motivo, alta rápida de productos
-- incompletos, resúmenes para el inicio y administración de las categorías principales.
-- Solo AGREGA o reemplaza funciones propias de las migraciones 20261030 y 20261031; no toca datos.

-- 1. Movimientos de inventario: stock anterior y tipo «entrada» --------------------------------
alter table public.stock_movements drop constraint stock_movements_reason_check;
alter table public.stock_movements add constraint stock_movements_reason_check
  check (reason in ('venta', 'ajuste', 'inicial', 'entrada'));
-- Stock previo al movimiento (el resultante ya se guardaba). Es una columna generada: no se puede falsear.
alter table public.stock_movements add column stock_before integer generated always as (stock_after - delta) stored;

-- La columna generada todavía no está recalculada en NEW dentro de un disparador BEFORE: se la ignora al comparar.
create or replace function public.ledger_no_change() returns trigger
  language plpgsql set search_path = ''
  as $$
declare
  col text;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old) - 'subtotal' - 'stock_before';
    v_new := to_jsonb(new) - 'subtotal' - 'stock_before';
    foreach col in array coalesce(tg_argv, '{}'::text[]) loop
      if v_new -> col = 'null'::jsonb then
        v_old := v_old - col;
        v_new := v_new - col;
      end if;
    end loop;
    if v_old = v_new then
      return new;
    end if;
  end if;
  raise exception '% es de solo agregado: no se edita ni se borra', tg_table_name using errcode = '42501';
end $$;

-- La razón sale de app.via: venta, entrada de mercadería, ajuste con motivo, alta inicial o edición directa.
create or replace function public.log_stock_change() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_via text := nullif(current_setting('app.via', true), '');
  v_sale uuid;
  v_delta integer;
begin
  if tg_op = 'INSERT' then
    v_delta := new.stock;
  else
    v_delta := new.stock - old.stock;
  end if;
  if v_delta = 0 then
    return null;
  end if;
  if v_via = 'confirm_sale' then
    v_sale := nullif(current_setting('app.sale_id', true), '')::uuid;
  end if;
  insert into public.stock_movements (variant_id, delta, stock_after, reason, sale_id, user_id, note)
  values (
    new.id, v_delta, new.stock,
    case
      when v_via = 'confirm_sale' then 'venta'
      when v_via = 'receive_stock' then 'entrada'
      when tg_op = 'INSERT' then 'inicial'
      else 'ajuste'
    end,
    v_sale, auth.uid(), nullif(current_setting('app.note', true), '')
  );
  return null;
end $$;

-- 2. Quién puede tocar el stock ----------------------------------------------------------------
-- Un único lugar para cambiar el criterio. Hoy: gerente o superior. Un empleado no puede por ningún
-- camino de la API; si el negocio decide darle permiso, se cambia solo esta función.
create function public.can_manage_stock() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select coalesce(public.has_role_at_least('gerente'), false) $$;
revoke execute on function public.can_manage_stock() from public, anon;
grant execute on function public.can_manage_stock() to authenticated;

-- Entrada de mercadería: suma unidades recibidas. Corre con los permisos de quien llama (RLS).
create function public.receive_stock(p_variant_id uuid, p_quantity integer, p_note text default null)
returns integer
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_new integer;
begin
  if not public.can_manage_stock() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 1000000 then
    raise exception 'La cantidad recibida debe ser un entero de 1 en adelante' using errcode = '22023';
  end if;
  perform set_config('app.via', 'receive_stock', true);
  perform set_config('app.note', coalesce(left(btrim(p_note), 200), ''), true);
  update public.product_variants set stock = stock + p_quantity where id = p_variant_id returning stock into v_new;
  if not found then
    raise exception 'Variante no encontrada' using errcode = 'P0002';
  end if;
  perform set_config('app.via', '', true);
  perform set_config('app.note', '', true);
  return v_new;
end $$;

-- Ajuste de inventario (suma o resta): ahora EXIGE el motivo.
create or replace function public.adjust_stock(p_variant_id uuid, p_delta integer, p_note text default null)
returns integer
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_new integer;
begin
  if not public.can_manage_stock() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 1000000 then
    raise exception 'Ajuste inválido' using errcode = '22023';
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'Indicá el motivo del ajuste' using errcode = '22023';
  end if;
  perform set_config('app.via', 'adjust_stock', true);
  perform set_config('app.note', left(btrim(p_note), 200), true);
  update public.product_variants set stock = stock + p_delta where id = p_variant_id returning stock into v_new;
  if not found then
    raise exception 'Variante no encontrada' using errcode = 'P0002';
  end if;
  perform set_config('app.via', '', true);
  perform set_config('app.note', '', true);
  return v_new;
end $$;

revoke execute on function public.receive_stock(uuid, integer, text) from public, anon;
grant execute on function public.receive_stock(uuid, integer, text) to authenticated;

-- 3. Alta rápida de un producto incompleto -----------------------------------------------------
alter table public.products add column created_by uuid default auth.uid();

-- Crea el producto SIN publicar y SIN variantes: no tiene precio ni stock, así que no se puede vender,
-- no aparece en el catálogo público y no admite movimientos de stock hasta que un gerente lo complete.
create function public.scan_create_draft(p_barcode text, p_name text, p_category_id uuid, p_description text default null)
returns uuid
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_code text;
  v_name text := btrim(p_name);
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_id uuid;
begin
  perform public.scan_require_employee();
  v_code := public.scan_normalize_barcode(p_barcode);
  if v_name is null or v_name = '' or char_length(v_name) > 200 then
    raise exception 'Nombre inválido' using errcode = '22023';
  end if;
  if v_desc is not null and char_length(v_desc) > 2000 then
    raise exception 'La descripción es demasiado larga' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categories where id = p_category_id and parent_id is null) then
    raise exception 'Elegí una categoría principal' using errcode = '22023';
  end if;

  perform set_config('app.via', 'scan_create_draft', true);
  perform pg_advisory_xact_lock(hashtextextended('barcode:' || v_code, 0));
  if exists (select 1 from public.products where barcode = v_code) then
    raise exception 'El código ya existe' using errcode = '23505';
  end if;

  insert into public.products (name, category_id, description, barcode, publish_enabled, created_by)
  values (v_name, p_category_id, v_desc, v_code, false, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.scan_create_draft(text, text, uuid, text) from public, anon;
grant execute on function public.scan_create_draft(text, text, uuid, text) to authenticated;

-- La búsqueda para vender ahora devuelve también la descripción.
create or replace function public.pos_find(p_term text) returns jsonb
  language plpgsql stable security definer set search_path = ''
  as $$
declare
  v_term text := btrim(coalesce(p_term, ''));
  v_like text;
begin
  perform public.scan_require_employee();
  if char_length(v_term) < 2 or char_length(v_term) > 80 then
    raise exception 'Escribí entre 2 y 80 caracteres' using errcode = '22023';
  end if;
  v_like := '%' || replace(replace(replace(lower(public.f_unaccent(v_term)), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return coalesce((
    select jsonb_agg(q.item order by q.sort_name)
    from (
      select p.name_sort as sort_name,
             jsonb_build_object(
               'product_id', p.id,
               'name', p.name,
               'brand', p.brand,
               'description', p.description,
               'barcode', p.barcode,
               'image_path', (select i.path from public.product_images i where i.product_id = p.id and i.is_primary limit 1),
               'archived', p.archived_at is not null,
               'variants', coalesce((
                 select jsonb_agg(jsonb_build_object('id', v.id, 'size', v.size, 'color', v.color, 'price', v.price, 'stock', v.stock)
                                  order by v.position, v.id)
                 from public.product_variants v where v.product_id = p.id), '[]'::jsonb)
             ) as item
      from public.products p
      where p.barcode = v_term or p.search_text like v_like
      order by (p.barcode = v_term) desc nulls last, p.name_sort
      limit 12
    ) q
  ), '[]'::jsonb);
end $$;

-- 4. Categorías principales: descripción, activar o desactivar, orden y borrado seguro ---------
alter table public.categories
  add column description text check (description is null or (btrim(description) <> '' and char_length(description) <= 200)),
  add column active boolean not null default true;

-- Una categoría desactivada deja de mostrarse como acceso. Sus productos NO se tocan ni cambian la regla
-- de publicación: siguen en el listado general.
create or replace view public.public_categories with (security_barrier = true) as
select c.slug,
       c.name,
       pc.slug as parent_slug,
       c.featured_position,
       c.image_path,
       c.description
from public.categories c
left join public.categories pc on pc.id = c.parent_id
where c.active
  and exists (
    select 1 from public.public_catalog p
    where p.category_slug = c.slug or p.main_category_slug = c.slug
  );

-- Reordena las categorías principales de una vez (la posición es única, por eso no se puede
-- intercambiar con dos UPDATE sueltos). Recibe los ids en el orden deseado y exige el mismo conjunto.
create function public.reorder_main_categories(p_ids uuid[]) returns void
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_current uuid[];
begin
  if not public.has_role_at_least('gerente') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select coalesce(array_agg(id order by id), '{}') into v_current from public.categories where featured_position is not null;
  if cardinality(p_ids) <> cardinality(v_current)
     or (select array_agg(x order by x) from unnest(p_ids) as x) is distinct from v_current then
    raise exception 'La lista debe contener exactamente las categorías principales' using errcode = '22023';
  end if;
  perform set_config('app.via', 'reorder_main_categories', true);
  update public.categories set featured_position = null where id = any(p_ids);
  update public.categories c set featured_position = o.ord::smallint
    from unnest(p_ids) with ordinality as o(id, ord) where c.id = o.id;
end $$;

-- Borrado seguro: no deja productos sin categoría ni subcategorías huérfanas, y todo en una transacción.
create function public.delete_category_safe(p_id uuid, p_reassign_to uuid default null) returns integer
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_moved integer := 0;
begin
  if not public.has_role_at_least('gerente') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.categories where id = p_id) then
    raise exception 'La categoría no existe' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.categories where parent_id = p_id) then
    raise exception 'Tiene subcategorías: movelas o eliminalas antes' using errcode = '23503';
  end if;
  if exists (select 1 from public.products where category_id = p_id) then
    if p_reassign_to is null or p_reassign_to = p_id
       or not exists (select 1 from public.categories where id = p_reassign_to) then
      raise exception 'Tiene productos: elegí a qué categoría pasarlos' using errcode = '23503';
    end if;
    v_moved := public.reassign_category_products(p_id, p_reassign_to);
  end if;
  delete from public.categories where id = p_id;
  return v_moved;
end $$;

revoke execute on function public.reorder_main_categories(uuid[]), public.delete_category_safe(uuid, uuid)
  from public, anon;
grant execute on function public.reorder_main_categories(uuid[]), public.delete_category_safe(uuid, uuid)
  to authenticated;

-- 5. Resúmenes para el inicio ------------------------------------------------------------------
-- Corren con los permisos de quien llama: el empleado ve solo sus ventas; el gerente y el CEO, las de todos.
create function public.sales_summary(p_from timestamptz, p_to timestamptz) returns jsonb
  language sql stable security invoker set search_path = ''
  as $$
  with s as (
    select id, total from public.sales where created_at >= p_from and created_at < p_to
  ), i as (
    select si.product_name, si.variant_label, si.quantity
    from public.sale_items si join s on s.id = si.sale_id
  )
  select jsonb_build_object(
    'sales_count', (select count(*) from s),
    'revenue', (select coalesce(sum(total), 0) from s),
    'units', (select coalesce(sum(quantity), 0) from i),
    'top_products', coalesce((
      select jsonb_agg(t order by t.units desc, t.name)
      from (
        select product_name as name, variant_label as variant, sum(quantity)::int as units
        from i group by product_name, variant_label order by sum(quantity) desc, product_name limit 5
      ) t
    ), '[]'::jsonb)
  )
$$;

-- Variantes con poco stock (solo gerente o superior; la RLS ya oculta las tablas al empleado).
create function public.low_stock_variants(p_threshold integer default 5) returns jsonb
  language plpgsql stable security invoker set search_path = ''
  as $$
begin
  if not public.has_role_at_least('gerente') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(t order by t.stock, t.name)
    from (
      select p.name, nullif(concat_ws(' · ', v.size, v.color), '') as variant, v.stock
      from public.product_variants v join public.products p on p.id = v.product_id
      where p.archived_at is null and v.stock <= greatest(p_threshold, 0)
      order by v.stock, p.name limit 12
    ) t
  ), '[]'::jsonb);
end $$;

revoke execute on function public.sales_summary(timestamptz, timestamptz), public.low_stock_variants(integer)
  from public, anon;
grant execute on function public.sales_summary(timestamptz, timestamptz), public.low_stock_variants(integer)
  to authenticated;
