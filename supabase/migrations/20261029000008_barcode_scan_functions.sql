-- Flujo de escaneo del empleado. Cada operación es una función: el empleado no tiene permisos
-- sobre las tablas y por eso no puede tocar otros campos. Todas validan el rol dentro de la
-- función, usan search_path fijo y dejan rastro en audit_log por los triggers de las tablas.

create function public.scan_require_employee() returns void
  language plpgsql stable security definer set search_path = ''
  as $$
begin
  if not public.has_role_at_least('empleado') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
end $$;

-- Formato PROVISIONAL, igual al de products.barcode (8 a 14 dígitos).
create function public.scan_normalize_barcode(p_barcode text) returns text
  language plpgsql immutable set search_path = ''
  as $$
declare
  v text := btrim(p_barcode);
begin
  if v is null or v !~ '^[0-9]{8,14}$' then
    raise exception 'Código de barras inválido: se esperan de 8 a 14 dígitos' using errcode = '22023';
  end if;
  return v;
end $$;

revoke execute on function public.scan_require_employee(), public.scan_normalize_barcode(text)
  from public, anon, authenticated;

-- 1 y 2. Busca el código y devuelve solo lo que el empleado puede ver (null si no existe).
create function public.scan_lookup(p_barcode text) returns jsonb
  language plpgsql stable security definer set search_path = ''
  as $$
declare
  v_code text;
begin
  perform public.scan_require_employee();
  v_code := public.scan_normalize_barcode(p_barcode);
  return (
    select jsonb_build_object(
      'product_id', p.id,
      'name', p.name,
      'brand', p.brand,
      'barcode', p.barcode,
      'category_id', p.category_id,
      'category', c.name,
      'published', p.publish_enabled,
      'archived', p.archived_at is not null,
      'variants', coalesce((
        select jsonb_agg(jsonb_build_object('id', v.id, 'size', v.size, 'color', v.color, 'price', v.price)
                         order by v.position, v.id)
        from public.product_variants v where v.product_id = p.id), '[]'::jsonb))
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.barcode = v_code
  );
end $$;

-- 3. Cambia solo el precio de una variante existente (no de productos archivados).
create function public.scan_set_price(p_variant_id uuid, p_price bigint) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  perform public.scan_require_employee();
  if p_price is null or p_price <= 0 or p_price >= 1000000000 then
    raise exception 'Precio inválido' using errcode = '22023';
  end if;
  perform set_config('app.via', 'scan_set_price', true);
  update public.product_variants v set price = p_price
  from public.products p
  where v.id = p_variant_id and p.id = v.product_id and p.archived_at is null;
  if not found then
    raise exception 'Variante no encontrada o producto archivado' using errcode = 'P0002';
  end if;
end $$;

-- 4. Vincula o corrige el código de un producto existente no archivado. No permite borrarlo (null).
-- Si el código ya es de otro producto, se rechaza.
create function public.scan_link_barcode(p_product_id uuid, p_barcode text) returns void
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_code text;
begin
  perform public.scan_require_employee();
  v_code := public.scan_normalize_barcode(p_barcode);
  perform set_config('app.via', 'scan_link_barcode', true);
  perform pg_advisory_xact_lock(hashtextextended('barcode:' || v_code, 0));
  if exists (select 1 from public.products where barcode = v_code and id <> p_product_id) then
    raise exception 'El código ya está asignado a otro producto' using errcode = '23505';
  end if;
  update public.products set barcode = v_code where id = p_product_id and archived_at is null;
  if not found then
    raise exception 'Producto no encontrado o archivado' using errcode = 'P0002';
  end if;
end $$;

-- 5 a 7. Crea un producto mínimo (nombre, categoría, precio, código) SIN publicar y sin fotos.
-- El candado por código y el índice único de products.barcode evitan duplicados concurrentes:
-- la segunda solicitud espera, ve el producto ya creado y falla.
create function public.scan_create_product(
  p_barcode text, p_name text, p_category_id uuid, p_price bigint, p_brand text default null
) returns uuid
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_code text;
  v_name text := btrim(p_name);
  v_id uuid;
begin
  perform public.scan_require_employee();
  v_code := public.scan_normalize_barcode(p_barcode);
  if v_name is null or v_name = '' or char_length(v_name) > 200 then
    raise exception 'Nombre inválido' using errcode = '22023';
  end if;
  if p_price is null or p_price <= 0 or p_price >= 1000000000 then
    raise exception 'Precio inválido' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'Categoría inexistente' using errcode = '22023';
  end if;

  perform set_config('app.via', 'scan_create_product', true);
  perform pg_advisory_xact_lock(hashtextextended('barcode:' || v_code, 0));
  if exists (select 1 from public.products where barcode = v_code) then
    raise exception 'El código ya existe: usá scan_lookup' using errcode = '23505';
  end if;

  insert into public.products (name, category_id, brand, barcode, publish_enabled)
  values (v_name, p_category_id, nullif(btrim(p_brand), ''), v_code, false)
  returning id into v_id;
  insert into public.product_variants (product_id, price, position) values (v_id, p_price, 0);
  return v_id;
end $$;

revoke execute on function
  public.scan_lookup(text), public.scan_set_price(uuid, bigint),
  public.scan_link_barcode(uuid, text), public.scan_create_product(text, text, uuid, bigint, text)
  from public, anon;
grant execute on function
  public.scan_lookup(text), public.scan_set_price(uuid, bigint),
  public.scan_link_barcode(uuid, text), public.scan_create_product(text, text, uuid, bigint, text)
  to authenticated;
