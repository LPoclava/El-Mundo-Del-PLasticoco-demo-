-- =====================================================================================================================
-- PROPUESTA DE LIMPIEZA DE DATOS DE PRUEBA EN PRODUCCIÓN  —  NO EJECUTAR SIN APROBACIÓN EXPLÍCITA DEL USUARIO
-- Proyecto de Supabase: nogufedcmkjphiqyyriz.  Preparado el 9 de noviembre de 2026.  Documento: docs/plan-limpieza-produccion.md
--
-- Qué hace (alcance S2, autorizado por el usuario el 9 de noviembre de 2026: todo es dato de prueba):
--   * Borra las 5 ventas de prueba, sus 5 detalles y los 10 movimientos de stock, y los 10 productos (con sus variantes y
--     fotos, por cascada).
--   * Conserva: estructura, RLS, políticas, funciones, categorías, medios de pago, la cuenta administrativa, Auth,
--     Storage (estructura), TODO el audit_log (y suma filas: los borrados de catálogo quedan auditados + una fila de constancia).
--   * NO crea esquemas ni tablas permanentes en producción y NO reinicia secuencias (la numeración de ventas y de movimientos
--     continúa: la próxima venta será la n.º 6 y el próximo movimiento el id 11). El respaldo es EXTERNO (docs/registro-respaldo-limpieza.md).
--
-- EXCEPCIÓN DELIBERADA A LA PROTECCIÓN «SOLO AGREGADO» (hay que aprobarla por separado):
--   Las tablas sales, sale_items y stock_movements tienen triggers BEFORE DELETE/UPDATE que lo impiden para TODOS los roles
--   (también el propietario). Con los mecanismos normales esas 20 filas NO se pueden borrar. Este script deshabilita SOLO
--   los tres triggers *_no_change, DENTRO de una única transacción, y los vuelve a habilitar antes de terminar. Si algo
--   falla, PostgreSQL deshace todo (incluido el ALTER TABLE ... DISABLE TRIGGER). Los triggers *_no_truncate, el RLS, las
--   políticas y el audit_log NO se tocan.
--
-- CÓMO USARLO:
--   1. Tener el respaldo externo verificado (docs/registro-respaldo-limpieza.md) y comprobar que producción coincide con él (huella_tablas.sql).
--   2. Ejecutar este archivo TAL CUAL: termina en ROLLBACK (simulacro). Debe mostrar los avisos de validación sin error.
--   3. Con aprobación explícita, reemplazar la última línea «rollback;» por «commit;» y ejecutar de nuevo.
--   4. Hacer las validaciones posteriores (plan §6) y las operaciones de Storage (plan §7).
-- =====================================================================================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ---------------------------------------------------------------------------------------------------------------------
-- 0. PARÁMETROS (ids exactos tomados del inventario del 9 de noviembre de 2026). Editar solo con aprobación.
-- ---------------------------------------------------------------------------------------------------------------------
-- >>> INICIO DE PARÁMETROS
create temp table _lim_ventas (id uuid primary key) on commit drop;
insert into _lim_ventas values
  ('8f4ffa22-1078-416d-9684-53fb5ab640dc'),  -- n.º 1, 30 oct, efectivo, 8.000
  ('3aba0682-3f23-4044-82df-c2fb3a113143'),  -- n.º 2, 1 nov, efectivo, 15.000
  ('e5d63465-1215-44ae-8a75-d6132aa7cbc5'),  -- n.º 3, 2 nov, efectivo, 30.000
  ('b60083e7-3efd-4b3f-9100-351d60216c4b'),  -- n.º 4, 2 nov, crédito, 27.750
  ('63a555bd-7fcf-4dbd-a106-ba0e2521081c');  -- n.º 5, 5 nov, efectivo, 5.000

create temp table _lim_productos (id uuid primary key) on commit drop;
insert into _lim_productos values
  -- Grupo A: usados en las 5 ventas de prueba
  ('bc610492-75ee-435b-999c-984ff8f27b61'),  -- Medicamentos
  ('3eb2e39e-7348-404c-8919-444f8b69a526'),  -- Bolsas de residuos 80x90
  ('2d2a0de8-bcc9-4140-a94f-54939e560f76'),  -- Palitos
  ('f2e81007-de91-423a-88f3-b4c202097078'),  -- Mermelada
  -- Grupo B: con stock cargado en pruebas, sin ventas
  ('7a812f1c-9424-47a3-aa2f-db31073ca007'),  -- Gatorade 1.25L
  -- Grupo C: material de prueba por criterio general (autorizado S2)
  ('599082c4-33ce-4b5a-b7ab-63896b793cc2'),  -- Juego de Cuchillos (su foto de Storage se quita aparte, ver plan §7)
  ('cd920d94-7041-40f4-9fe3-90f32778c93a'),  -- Termos 700ml
  -- Grupo D: autorizados por el usuario en el alcance S2
  ('65a14d62-2abb-4ac5-ab11-ebf8b98892ee'),  -- Libro Stephen king (archivado)
  ('f5153e9e-a5a9-49af-8bde-e3220806b5c6'),  -- Galletas oreo
  ('a30513a5-9ac3-4796-94cd-371c82d4b5da');  -- Bebida Gatorade

-- Estado esperado ANTES de limpiar (inventario). Si no coincide, el script aborta sin cambiar nada.
create temp table _lim_esperado (clave text primary key, valor bigint not null) on commit drop;
insert into _lim_esperado values
  ('ventas', 5), ('detalles', 5), ('movimientos', 10), ('suma_total_ventas', 85750),
  ('productos_total', 10), ('productos_a_borrar', 10), ('fotos', 1), ('categorias', 4), ('medios_pago', 5), ('perfiles', 1),
  ('politicas_public', 21), ('politicas_storage', 8), ('audit_log_min', 111);
-- <<< FIN DE PARÁMETROS

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. VALIDACIONES PREVIAS (solo lectura). Cualquier diferencia aborta todo.
-- ---------------------------------------------------------------------------------------------------------------------
do $$
declare
  e record;
  v_actual bigint;
  v_mal int;
begin
  for e in select * from _lim_esperado loop
    v_actual := case e.clave
      when 'ventas'            then (select count(*) from public.sales)
      when 'detalles'          then (select count(*) from public.sale_items)
      when 'movimientos'       then (select count(*) from public.stock_movements)
      when 'suma_total_ventas' then (select coalesce(sum(total), 0) from public.sales)
      when 'productos_total'   then (select count(*) from public.products)
      when 'categorias'        then (select count(*) from public.categories)
      when 'medios_pago'       then (select count(*) from public.payment_methods)
      when 'perfiles'          then (select count(*) from public.profiles)
      when 'audit_log_min'     then (select count(*) from public.audit_log)
      when 'productos_a_borrar' then (select count(*) from _lim_productos)
      when 'fotos'             then (select count(*) from public.product_images)
      when 'politicas_public'  then (select count(*) from pg_policies where schemaname = 'public')
      when 'politicas_storage' then (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects')
    end;
    if e.clave = 'audit_log_min' then
      if v_actual < e.valor then raise exception 'Guarda: audit_log tiene % filas y se esperaban al menos %', v_actual, e.valor; end if;
    elsif v_actual <> e.valor then
      raise exception 'Guarda: % es % y se esperaba % (el estado cambió desde el inventario)', e.clave, v_actual, e.valor;
    end if;
  end loop;

  -- Las ventas a borrar son exactamente todas las que existen.
  if exists (select 1 from public.sales s where s.id not in (select id from _lim_ventas))
     or exists (select 1 from _lim_ventas l where l.id not in (select id from public.sales)) then
    raise exception 'Guarda: la lista de ventas no coincide con la tabla sales';
  end if;
  -- Todos los productos de la lista existen.
  if (select count(*) from _lim_productos) <> (select count(*) from public.products p where p.id in (select id from _lim_productos)) then
    raise exception 'Guarda: algún producto de la lista no existe';
  end if;
  -- Todo producto vendido figura en la lista (si no, su detalle quedaría huérfano y la limpieza sería parcial).
  if exists (select 1 from public.sale_items si where si.product_id is not null and si.product_id not in (select id from _lim_productos)) then
    raise exception 'Guarda: hay productos vendidos que no están en la lista de limpieza';
  end if;
  -- Coherencia previa del libro: el stock de cada variante = suma de sus movimientos.
  select count(*) into v_mal from public.product_variants v
   where v.stock <> coalesce((select sum(m.delta) from public.stock_movements m where m.variant_id = v.id), 0);
  if v_mal > 0 then raise exception 'Guarda: % variante(s) con stock distinto de la suma de sus movimientos', v_mal; end if;
  -- Nadie más debe tener perfil: una sola cuenta CEO activa.
  if not exists (select 1 from public.profiles where role = 'ceo' and active) then raise exception 'Guarda: no hay CEO activo'; end if;
  -- Los tres triggers a deshabilitar deben existir y estar habilitados ahora.
  if (select count(*) from pg_trigger t where not t.tgisinternal and t.tgenabled = 'O'
        and t.tgname in ('sales_no_change', 'sale_items_no_change', 'stock_movements_no_change')) <> 3 then
    raise exception 'Guarda: los triggers de solo agregado no están todos habilitados';
  end if;
  raise notice 'Validaciones previas: OK';
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1 bis. Instantánea de la estructura (se compara al final: la limpieza no puede cambiarla).
create temp table _lim_estructura on commit drop as
select (select count(*) from pg_policies where schemaname in ('public', 'storage')) as politicas,
       (select md5(string_agg(schemaname || tablename || policyname || cmd || coalesce(qual, '') || coalesce(with_check, ''), ',' order by schemaname, tablename, policyname)) from pg_policies where schemaname in ('public', 'storage')) as huella_politicas,
       (select count(*) from pg_proc where pronamespace = 'public'::regnamespace) as funciones,
       (select md5(string_agg(pg_get_functiondef(oid), ',' order by oid::regprocedure::text)) from pg_proc where pronamespace = 'public'::regnamespace) as huella_funciones,
       (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not t.tgisinternal) as triggers,
       (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relrowsecurity) as tablas_con_rls,
       (select count(*) from public.categories) as categorias,
       (select md5(string_agg(c::text, '|' order by c.id)) from public.categories c) as huella_categorias,
       (select md5(string_agg(p::text, '|' order by p.code)) from public.payment_methods p) as huella_medios_pago,
       (select md5(string_agg(p::text, '|' order by p.user_id)) from public.profiles p) as huella_perfiles,
       (select count(*) from public.audit_log) as audit_filas,
       (select max(id) from public.audit_log) as audit_max,
       (select md5(string_agg(a::text, '|' order by a.id)) from public.audit_log a) as huella_audit;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. CONTEOS PREVIOS para la constancia (tabla temporal: desaparece al terminar la transacción; no deja nada en producción).
-- ---------------------------------------------------------------------------------------------------------------------
create temp table _lim_conteos on commit drop as
select (select count(*) from public.sales) as ventas,
       (select count(*) from public.sale_items) as detalles,
       (select count(*) from public.stock_movements) as movimientos,
       (select count(*) from public.products where id in (select id from _lim_productos)) as productos,
       (select count(*) from public.product_variants where product_id in (select id from _lim_productos)) as variantes,
       (select count(*) from public.product_images where product_id in (select id from _lim_productos)) as fotos;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. EXCEPCIÓN CONTROLADA: deshabilitar SOLO los tres triggers *_no_change (se rehabilitan en el paso 5).
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.sale_items      disable trigger sale_items_no_change;
alter table public.stock_movements disable trigger stock_movements_no_change;
alter table public.sales           disable trigger sales_no_change;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. BORRADO, en orden de dependencias (hijos antes que padres).
-- ---------------------------------------------------------------------------------------------------------------------
delete from public.sale_items where sale_id in (select id from _lim_ventas);
delete from public.stock_movements
 where sale_id in (select id from _lim_ventas)
    or variant_id in (select v.id from public.product_variants v where v.product_id in (select id from _lim_productos));
delete from public.sales where id in (select id from _lim_ventas);
-- Productos: las variantes y las fotos (filas) se borran por ON DELETE CASCADE; el audit_log registra cada borrado.
delete from public.products where id in (select id from _lim_productos);

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. REHABILITAR la protección (antes de cualquier otra cosa).
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.sale_items      enable trigger sale_items_no_change;
alter table public.stock_movements enable trigger stock_movements_no_change;
alter table public.sales           enable trigger sales_no_change;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Numeración: NO se reinician las secuencias (no hay necesidad técnica demostrada). Las ventas y los movimientos nuevos
--    continúan con los números siguientes; el historial queda sin reutilizar números.
-- ---------------------------------------------------------------------------------------------------------------------

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. CONSTANCIA en el audit_log (solo agrega; el audit_log no se borra ni se edita).
-- ---------------------------------------------------------------------------------------------------------------------
insert into public.audit_log (table_name, row_id, operation, old_data, new_data, source, via)
select 'limpieza_produccion', null, 'DELETE',
       jsonb_build_object('ventas', c.ventas, 'detalles', c.detalles, 'movimientos', c.movimientos,
                          'productos', c.productos, 'variantes', c.variantes, 'fotos', c.fotos,
                          'respaldo_externo', 'mundo-del-plastico_limpieza_respaldo_2026-11-09.tar.gz',
                          'respaldo_sha256', 'f8fedd8b2cff164d6912db9237612df0118f6e65492a36f4ea2bfc1fcf173880'),
       jsonb_build_object('motivo', 'limpieza de datos de prueba confirmados por el usuario el 2026-11-09'),
       'sql', 'limpieza_produccion_20261109'
from _lim_conteos c;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. VALIDACIONES POSTERIORES (aún dentro de la transacción; si algo falla, se deshace todo).
-- ---------------------------------------------------------------------------------------------------------------------
do $$
declare v_mal int; v_quedan int;
begin
  if exists (select 1 from public.sales) or exists (select 1 from public.sale_items) or exists (select 1 from public.stock_movements) then
    raise exception 'Post: el libro de ventas/movimientos no quedó vacío';
  end if;
  if (select count(*) from public.products p where p.id in (select id from _lim_productos)) <> 0 then
    raise exception 'Post: quedaron productos de la lista';
  end if;
  select (select count(*) from public.products) into v_quedan;
  if v_quedan <> (select valor from _lim_esperado where clave = 'productos_total') - (select count(*) from _lim_productos) then
    raise exception 'Post: la cantidad de productos restantes no es la esperada (%)', v_quedan;
  end if;
  if (select count(*) from public.categories) <> (select valor from _lim_esperado where clave = 'categorias')
     or (select count(*) from public.payment_methods) <> (select valor from _lim_esperado where clave = 'medios_pago')
     or (select count(*) from public.profiles) <> (select valor from _lim_esperado where clave = 'perfiles') then
    raise exception 'Post: cambió algo que debía conservarse (categorías, medios de pago o perfiles)';
  end if;
  -- Consistencia stock = suma de movimientos para las variantes que quedan.
  select count(*) into v_mal from public.product_variants v
   where v.stock <> coalesce((select sum(m.delta) from public.stock_movements m where m.variant_id = v.id), 0);
  if v_mal > 0 then raise exception 'Post: % variante(s) restantes con stock distinto de la suma de movimientos', v_mal; end if;
  -- La protección quedó de nuevo activa.
  if (select count(*) from pg_trigger t where not t.tgisinternal and t.tgenabled = 'O'
        and t.tgname in ('sales_no_change', 'sale_items_no_change', 'stock_movements_no_change',
                         'sales_no_truncate', 'sale_items_no_truncate', 'stock_movements_no_truncate',
                         'audit_log_no_change', 'audit_log_no_truncate')) <> 8 then
    raise exception 'Post: los triggers de protección no están todos habilitados';
  end if;
  if (select count(*) from public.audit_log) < (select valor from _lim_esperado where clave = 'audit_log_min') then
    raise exception 'Post: el audit_log perdió filas';
  end if;
  -- RLS intacto en todas las tablas de public.
  if exists (select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity) then
    raise exception 'Post: hay una tabla de public sin RLS';
  end if;
  -- La estructura no cambió: políticas, funciones, triggers y RLS iguales a la instantánea.
  if exists (select 1 from _lim_estructura s where
       s.politicas <> (select count(*) from pg_policies where schemaname in ('public', 'storage'))
    or s.huella_politicas <> (select md5(string_agg(schemaname || tablename || policyname || cmd || coalesce(qual, '') || coalesce(with_check, ''), ',' order by schemaname, tablename, policyname)) from pg_policies where schemaname in ('public', 'storage'))
    or s.funciones <> (select count(*) from pg_proc where pronamespace = 'public'::regnamespace)
    or s.huella_funciones <> (select md5(string_agg(pg_get_functiondef(oid), ',' order by oid::regprocedure::text)) from pg_proc where pronamespace = 'public'::regnamespace)
    or s.triggers <> (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not t.tgisinternal)
    or s.tablas_con_rls <> (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relrowsecurity)) then
    raise exception 'Post: cambió la estructura (políticas, funciones, triggers o RLS)';
  end if;
  -- Categorías, medios de pago y perfiles: contenido idéntico.
  if exists (select 1 from _lim_estructura s where
       s.huella_categorias <> (select md5(string_agg(c::text, '|' order by c.id)) from public.categories c)
    or s.huella_medios_pago <> (select md5(string_agg(p::text, '|' order by p.code)) from public.payment_methods p)
    or s.huella_perfiles <> (select md5(string_agg(p::text, '|' order by p.user_id)) from public.profiles p)) then
    raise exception 'Post: cambió el contenido de categorías, medios de pago o perfiles';
  end if;
  -- audit_log: las filas originales siguen idénticas (solo se agregaron filas al final).
  if exists (select 1 from _lim_estructura s where
       s.huella_audit <> (select md5(string_agg(a::text, '|' order by a.id)) from public.audit_log a where a.id <= s.audit_max)) then
    raise exception 'Post: cambiaron filas originales del audit_log';
  end if;
  -- Productos, variantes y fotos de la lista: ninguna quedó.
  if exists (select 1 from public.product_variants v where v.product_id in (select id from _lim_productos))
     or exists (select 1 from public.product_images i where i.product_id in (select id from _lim_productos)) then
    raise exception 'Post: quedaron variantes o fotos de los productos eliminados';
  end if;
  raise notice 'Validaciones posteriores: OK';
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- FIN. Por defecto es un SIMULACRO: deshace todo. Para aplicar de verdad (solo con aprobación explícita),
-- reemplazar la línea siguiente por «commit;».
-- ---------------------------------------------------------------------------------------------------------------------
rollback;
