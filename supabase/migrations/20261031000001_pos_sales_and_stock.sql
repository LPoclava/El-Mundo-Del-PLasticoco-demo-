-- Punto de venta: stock por variante, movimientos de inventario, medios de pago y ventas.
-- Solo AGREGA objetos y una columna; no modifica productos, precios ni políticas existentes.
-- Ver docs/pos-ventas.md.
--
-- Depende de las migraciones de roles (has_role_at_least, scan_require_employee, audit_row_change).
-- Ningún producto existente es vendible hasta que se le cargue stock (la columna nueva vale 0).

-- 1. Stock por variante -----------------------------------------------------------------------
-- El precio ya vive en la variante, así que el stock también: una venta descuenta de la variante
-- exacta que se cobró. La base impide el stock negativo aunque alguien escriba directo.
alter table public.product_variants
  add column stock integer not null default 0 check (stock >= 0 and stock <= 1000000);

-- 2. Medios de pago ---------------------------------------------------------------------------
-- Una tabla en lugar de una lista fija: agregar o habilitar un medio no toca la lógica de venta.
create table public.payment_methods (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,29}$'),
  label text not null check (btrim(label) <> '' and char_length(label) <= 40),
  enabled boolean not null default true,
  position int not null default 0
);
insert into public.payment_methods (code, label, enabled, position) values
  ('efectivo', 'Efectivo', true, 1),
  ('transferencia', 'Transferencia', true, 2),
  ('debito', 'Tarjeta de débito', true, 3),
  ('credito', 'Tarjeta de crédito', true, 4),
  -- Solo se usa si la administración lo habilita.
  ('otro', 'Otro medio', false, 5);

-- 3. Ventas y detalle -------------------------------------------------------------------------
-- Cada línea guarda una COPIA del nombre, el código y el precio vigentes al vender: cambiar o
-- borrar el producto después no altera el historial. Nadie escribe estas tablas directo: solo
-- confirm_sale() (ver abajo), y ni siquiera ella puede modificar lo ya registrado.
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  -- Número legible para el ticket. Puede tener saltos si una venta se revierte.
  number bigint generated always as identity unique,
  created_at timestamptz not null default now(),
  -- Sin clave foránea a propósito (igual que audit_log): la venta sobrevive al usuario.
  user_id uuid not null,
  user_name text not null,
  payment_method text not null references public.payment_methods (code) on delete restrict on update restrict,
  total bigint not null check (total > 0),
  -- Hoy solo existen ventas confirmadas. Una anulación futura será un registro compensatorio nuevo.
  status text not null default 'confirmada' check (status in ('confirmada')),
  -- Clave que genera el navegador por intento de venta: un reintento no duplica la venta.
  idempotency_key uuid not null,
  unique (user_id, idempotency_key)
);
create index sales_created_idx on public.sales (created_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete restrict,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  barcode text,
  product_name text not null,
  variant_label text,
  unit_price bigint not null check (unit_price > 0 and unit_price < 1000000000),
  quantity integer not null check (quantity > 0 and quantity <= 9999),
  subtotal bigint generated always as (unit_price * quantity) stored
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_variant_idx on public.sale_items (variant_id);

-- 4. Movimientos de inventario ----------------------------------------------------------------
create table public.stock_movements (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  variant_id uuid references public.product_variants (id) on delete set null,
  delta integer not null check (delta <> 0),
  stock_after integer not null check (stock_after >= 0),
  reason text not null check (reason in ('venta', 'ajuste', 'inicial')),
  sale_id uuid references public.sales (id) on delete restrict,
  user_id uuid,
  note text check (note is null or char_length(note) <= 200)
);
create index stock_movements_variant_idx on public.stock_movements (variant_id, created_at desc);
create index stock_movements_sale_idx on public.stock_movements (sale_id);

-- Todo cambio de stock deja un movimiento, venga de una venta, de adjust_stock() o de una
-- edición directa de un gerente. La razón sale de app.via (igual que en audit_log).
create function public.log_stock_change() returns trigger
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
    case when v_via = 'confirm_sale' then 'venta' when tg_op = 'INSERT' then 'inicial' else 'ajuste' end,
    v_sale, auth.uid(), nullif(current_setting('app.note', true), '')
  );
  return null;
end $$;
revoke execute on function public.log_stock_change() from public, anon, authenticated;
create trigger product_variants_stock_log after insert or update of stock on public.product_variants
  for each row execute function public.log_stock_change();

-- 5. Solo agregar: ni el dueño de las tablas edita o borra por accidente -----------------------
-- Excepción: una clave a producto o variante puede pasar a null cuando se borra ese producto (el
-- historial conserva el nombre y el precio copiados). Cualquier otro cambio se rechaza.
create function public.ledger_no_change() returns trigger
  language plpgsql set search_path = ''
  as $$
declare
  col text;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'UPDATE' then
    -- subtotal es una columna generada: en un disparador BEFORE todavía no está recalculada en NEW.
    v_old := to_jsonb(old) - 'subtotal';
    v_new := to_jsonb(new) - 'subtotal';
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

create trigger sales_no_change before update or delete on public.sales
  for each row execute function public.ledger_no_change();
create trigger sale_items_no_change before update or delete on public.sale_items
  for each row execute function public.ledger_no_change('variant_id', 'product_id');
create trigger stock_movements_no_change before update or delete on public.stock_movements
  for each row execute function public.ledger_no_change('variant_id');
create trigger sales_no_truncate before truncate on public.sales
  for each statement execute function public.ledger_no_change();
create trigger sale_items_no_truncate before truncate on public.sale_items
  for each statement execute function public.ledger_no_change();
create trigger stock_movements_no_truncate before truncate on public.stock_movements
  for each statement execute function public.ledger_no_change();

-- 6. Permisos y RLS ---------------------------------------------------------------------------
alter table public.payment_methods enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
revoke all on public.payment_methods, public.sales, public.sale_items, public.stock_movements
  from anon, authenticated;

-- Medios de pago: los ve todo el personal; los administra gerente o superior.
grant select, insert, update, delete on public.payment_methods to authenticated;
create policy payment_methods_read on public.payment_methods for select to authenticated
  using ((select public.has_role_at_least('empleado')));
create policy payment_methods_insert on public.payment_methods for insert to authenticated
  with check ((select public.has_role_at_least('gerente')));
create policy payment_methods_update on public.payment_methods for update to authenticated
  using ((select public.has_role_at_least('gerente')))
  with check ((select public.has_role_at_least('gerente')));
create policy payment_methods_delete on public.payment_methods for delete to authenticated
  using ((select public.has_role_at_least('gerente')));

-- Ventas: solo lectura. El empleado ve las suyas; el gerente y el CEO, todas. Sin permisos de
-- escritura para nadie: se registran únicamente con confirm_sale().
grant select on public.sales, public.sale_items, public.stock_movements to authenticated;
create policy sales_read_own on public.sales for select to authenticated
  using (user_id = (select auth.uid()) and (select public.has_role_at_least('empleado')));
create policy sales_read_all on public.sales for select to authenticated
  using ((select public.has_role_at_least('gerente')));
-- El detalle se ve exactamente cuando se ve la venta (la subconsulta aplica las políticas de arriba).
create policy sale_items_read on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));
create policy stock_movements_read on public.stock_movements for select to authenticated
  using ((select public.has_role_at_least('gerente')));

-- 7. Búsqueda de productos para vender ---------------------------------------------------------
-- El empleado no tiene permisos sobre las tablas: esta función le devuelve solo lo necesario para
-- vender (nombre, código, foto, variantes con precio y stock). Por código exacto o por nombre.
create function public.pos_find(p_term text) returns jsonb
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

-- 8. Comprobante ------------------------------------------------------------------------------
create function public.sale_receipt(p_sale_id uuid) returns jsonb
  language sql stable security definer set search_path = ''
  as $$
  select jsonb_build_object(
    'id', s.id,
    'number', s.number,
    'created_at', s.created_at,
    'user_name', s.user_name,
    'payment_method', s.payment_method,
    'payment_label', coalesce((select pm.label from public.payment_methods pm where pm.code = s.payment_method), s.payment_method),
    'total', s.total,
    'status', s.status,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', i.product_name,
        'variant_label', i.variant_label,
        'barcode', i.barcode,
        'unit_price', i.unit_price,
        'quantity', i.quantity,
        'subtotal', i.subtotal,
        'stock_after', (select m.stock_after from public.stock_movements m where m.sale_id = s.id and m.variant_id = i.variant_id limit 1)
      ) order by i.product_name, i.id)
      from public.sale_items i where i.sale_id = s.id), '[]'::jsonb),
    'stock_updated', true
  )
  from public.sales s where s.id = p_sale_id
$$;
revoke execute on function public.sale_receipt(uuid) from public, anon, authenticated;

-- 9. Confirmar una venta (atómica) ------------------------------------------------------------
-- Una sola transacción: valida permisos, medio de pago, productos, precios y stock; registra la
-- venta, su detalle, el descuento de stock y los movimientos; o no registra NADA.
--  * El total se calcula acá con los precios de la base; el navegador solo puede enviar el precio
--    que vio (expected_price) para que, si cambió, la venta se rechace y se muestre el nuevo.
--  * Las variantes se bloquean (FOR UPDATE, en orden) antes de comprobar el stock: dos ventas
--    simultáneas del mismo artículo se serializan y la segunda ve el stock ya descontado.
--  * p_idempotency_key: repetir la misma clave devuelve la venta ya registrada (replayed = true)
--    en lugar de crear otra y de descontar dos veces.
-- Los rechazos devuelven SALE_REJECTED con un JSON en "details": { problems: [{ reason, ... }] }.
create function public.confirm_sale(p_idempotency_key uuid, p_payment_method text, p_items jsonb)
returns jsonb
  language plpgsql security definer set search_path = ''
  as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_method public.payment_methods%rowtype;
  v_existing uuid;
  v_sale_id uuid;
  v_elem jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_problems jsonb := '[]'::jsonb;
  v_total bigint := 0;
  r record;
begin
  perform public.scan_require_employee();
  if p_idempotency_key is null then
    raise exception 'Falta la clave de la operación' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'La venta debe tener entre 1 y 100 líneas' using errcode = '22023';
  end if;

  -- Serializa los reintentos del mismo usuario con la misma clave.
  perform pg_advisory_xact_lock(hashtextextended('sale:' || v_uid::text || ':' || p_idempotency_key::text, 0));
  select s.id into v_existing from public.sales s
   where s.user_id = v_uid and s.idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return public.sale_receipt(v_existing) || jsonb_build_object('replayed', true);
  end if;

  select * into v_method from public.payment_methods where code = p_payment_method;
  if not found or not v_method.enabled then
    raise exception 'SALE_REJECTED' using errcode = 'P0001',
      detail = '{"problems":[{"reason":"PAYMENT_METHOD"}]}';
  end if;

  for v_elem in select e from jsonb_array_elements(p_items) as e loop
    if jsonb_typeof(v_elem) <> 'object'
       or coalesce(v_elem ->> 'variant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(v_elem ->> 'quantity', '') !~ '^[1-9][0-9]{0,3}$'
       or ((v_elem ->> 'expected_price') is not null and (v_elem ->> 'expected_price') !~ '^[1-9][0-9]{0,8}$') then
      raise exception 'Línea de venta inválida' using errcode = '22023';
    end if;
  end loop;

  -- Bloqueo ordenado de todas las variantes de la venta (evita bloqueos cruzados entre ventas).
  perform 1
    from public.product_variants v
   where v.id in (select (e ->> 'variant_id')::uuid from jsonb_array_elements(p_items) as e)
   order by v.id
     for update;

  for r in
    select l.variant_id, l.qty, l.expected,
           v.id as found_id, v.price, v.stock, v.size, v.color,
           p.id as product_id, p.name, p.barcode, p.archived_at
      from (select (e ->> 'variant_id')::uuid as variant_id,
                   sum((e ->> 'quantity')::int)::int as qty,
                   max((e ->> 'expected_price')::bigint) as expected
              from jsonb_array_elements(p_items) as e
             group by 1) l
      left join public.product_variants v on v.id = l.variant_id
      left join public.products p on p.id = v.product_id
     order by l.variant_id
  loop
    if r.found_id is null then
      v_problems := v_problems || jsonb_build_object('reason', 'NOT_FOUND', 'variant_id', r.variant_id);
    elsif r.archived_at is not null then
      v_problems := v_problems || jsonb_build_object('reason', 'ARCHIVED', 'variant_id', r.variant_id, 'name', r.name);
    elsif r.price is null or r.price <= 0 then
      v_problems := v_problems || jsonb_build_object('reason', 'NO_PRICE', 'variant_id', r.variant_id, 'name', r.name);
    elsif r.expected is not null and r.expected <> r.price then
      v_problems := v_problems || jsonb_build_object('reason', 'PRICE_CHANGED', 'variant_id', r.variant_id, 'name', r.name, 'price', r.price);
    elsif r.qty > 9999 then
      v_problems := v_problems || jsonb_build_object('reason', 'QUANTITY', 'variant_id', r.variant_id, 'name', r.name);
    elsif r.stock < r.qty then
      v_problems := v_problems || jsonb_build_object('reason', 'INSUFFICIENT_STOCK', 'variant_id', r.variant_id, 'name', r.name,
                                                     'available', r.stock, 'requested', r.qty);
    else
      v_total := v_total + r.price * r.qty;
      v_lines := v_lines || jsonb_build_object(
        'variant_id', r.variant_id, 'product_id', r.product_id, 'name', r.name, 'barcode', r.barcode,
        'label', nullif(concat_ws(' · ', r.size, r.color), ''), 'price', r.price, 'qty', r.qty);
    end if;
  end loop;

  if jsonb_array_length(v_problems) > 0 then
    raise exception 'SALE_REJECTED' using errcode = 'P0001',
      detail = jsonb_build_object('problems', v_problems)::text;
  end if;

  select pr.display_name into v_name from public.profiles pr where pr.user_id = v_uid;

  insert into public.sales (user_id, user_name, payment_method, total, idempotency_key)
  values (v_uid, coalesce(v_name, ''), v_method.code, v_total, p_idempotency_key)
  returning id into v_sale_id;

  perform set_config('app.via', 'confirm_sale', true);
  perform set_config('app.sale_id', v_sale_id::text, true);

  for v_elem in select e from jsonb_array_elements(v_lines) as e loop
    insert into public.sale_items (sale_id, variant_id, product_id, barcode, product_name, variant_label, unit_price, quantity)
    values (v_sale_id, (v_elem ->> 'variant_id')::uuid, (v_elem ->> 'product_id')::uuid, v_elem ->> 'barcode',
            v_elem ->> 'name', v_elem ->> 'label', (v_elem ->> 'price')::bigint, (v_elem ->> 'qty')::int);

    update public.product_variants
       set stock = stock - (v_elem ->> 'qty')::int
     where id = (v_elem ->> 'variant_id')::uuid
       and stock >= (v_elem ->> 'qty')::int;
    if not found then
      -- No debería pasar (las filas están bloqueadas), pero ante la duda se revierte todo.
      raise exception 'SALE_REJECTED' using errcode = 'P0001',
        detail = jsonb_build_object('problems', jsonb_build_array(
          jsonb_build_object('reason', 'INSUFFICIENT_STOCK', 'variant_id', v_elem ->> 'variant_id')))::text;
    end if;
  end loop;

  perform set_config('app.via', '', true);
  perform set_config('app.sale_id', '', true);

  return public.sale_receipt(v_sale_id) || jsonb_build_object('replayed', false);
end $$;

-- 10. Ajuste de stock por gerente o superior ---------------------------------------------------
-- Corre con los permisos de quien llama (RLS) y deja el movimiento con su nota.
create function public.adjust_stock(p_variant_id uuid, p_delta integer, p_note text default null)
returns integer
  language plpgsql security invoker set search_path = ''
  as $$
declare
  v_new integer;
begin
  if not public.has_role_at_least('gerente') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 1000000 then
    raise exception 'Ajuste inválido' using errcode = '22023';
  end if;
  perform set_config('app.via', 'adjust_stock', true);
  perform set_config('app.note', coalesce(left(btrim(p_note), 200), ''), true);
  update public.product_variants set stock = stock + p_delta where id = p_variant_id returning stock into v_new;
  if not found then
    raise exception 'Variante no encontrada' using errcode = 'P0002';
  end if;
  perform set_config('app.via', '', true);
  perform set_config('app.note', '', true);
  return v_new;
end $$;

revoke execute on function public.pos_find(text), public.confirm_sale(uuid, text, jsonb),
  public.adjust_stock(uuid, integer, text) from public, anon;
grant execute on function public.pos_find(text), public.confirm_sale(uuid, text, jsonb),
  public.adjust_stock(uuid, integer, text) to authenticated;
