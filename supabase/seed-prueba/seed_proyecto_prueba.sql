-- SEMILLA PARA EL PROYECTO DE SUPABASE **DE PRUEBA**. NO ES UNA MIGRACIÓN y NO SE EJECUTA EN PRODUCCIÓN.
-- Crea productos, variantes y stock ficticios («[PRUEBA] …») para probar el punto de venta. No crea usuarios ni perfiles.
--
-- Cómo se usa (solo en el proyecto de prueba, con las migraciones ya aplicadas; ver docs/proyecto-supabase-de-prueba.md):
--   1. En el SQL Editor del proyecto de PRUEBA, pegar primero esta línea y DESPUÉS el resto del archivo, en la misma ejecución:
--        set app.confirmo_proyecto_de_prueba = 'si';
--   2. Ejecutar.
--
-- Se niega a correr si:
--   - no se declaró la línea anterior;
--   - la base ya tiene algún producto que no sea de esta semilla (parece producción);
--   - la base ya tiene ventas.
-- Es repetible: volver a correrla no duplica nada (no repone el stock que ya se vendió).

do $$
begin
  if coalesce(current_setting('app.confirmo_proyecto_de_prueba', true), '') <> 'si' then
    raise exception 'Semilla de prueba: falta confirmar con  set app.confirmo_proyecto_de_prueba = ''si'';  Si no estás seguro de estar en el proyecto de PRUEBA, no sigas.';
  end if;
  if exists (select 1 from public.products where name not like '[PRUEBA]%') then
    raise exception 'Semilla de prueba: esta base tiene productos que no son de prueba. Parece producción: no se hace nada.';
  end if;
  if exists (select 1 from public.sales) then
    raise exception 'Semilla de prueba: esta base ya tiene ventas. No se hace nada.';
  end if;
  if not exists (select 1 from public.categories where slug = 'cocina') then
    raise exception 'Semilla de prueba: faltan las categorías principales (migración 20261030000001).';
  end if;
end $$;

insert into public.products (id, name, category_id, barcode, publish_enabled) values
  ('e0e00000-0000-4000-8000-000000000001', '[PRUEBA] Balde 10 litros', (select id from public.categories where slug = 'bano'), '7799000000013', false),
  ('e0e00000-0000-4000-8000-000000000002', '[PRUEBA] Remera lisa', (select id from public.categories where slug = 'regaleria'), '7799000000020', false),
  ('e0e00000-0000-4000-8000-000000000003', '[PRUEBA] Producto agotado', (select id from public.categories where slug = 'cocina'), '7799000000037', false),
  ('e0e00000-0000-4000-8000-000000000004', '[PRUEBA] Producto sin precio', (select id from public.categories where slug = 'cocina'), '7799000000044', false),
  ('e0e00000-0000-4000-8000-000000000005', '[PRUEBA] Producto archivado', (select id from public.categories where slug = 'cocina'), '7799000000051', false)
on conflict (id) do nothing;

-- El stock inicial queda registrado como movimiento «inicial» (lo hace un disparador de la base).
insert into public.product_variants (id, product_id, size, color, price, position, stock) values
  ('e1e10000-0000-4000-8000-000000000001', 'e0e00000-0000-4000-8000-000000000001', null, null, 1000, 0, 20),
  ('e1e10000-0000-4000-8000-000000000002', 'e0e00000-0000-4000-8000-000000000002', 'M', 'Azul', 2500, 0, 10),
  ('e1e10000-0000-4000-8000-000000000003', 'e0e00000-0000-4000-8000-000000000002', 'L', 'Azul', 2600, 1, 3),
  ('e1e10000-0000-4000-8000-000000000004', 'e0e00000-0000-4000-8000-000000000003', null, null, 800, 0, 0),
  ('e1e10000-0000-4000-8000-000000000005', 'e0e00000-0000-4000-8000-000000000004', null, null, null, 0, 9),
  ('e1e10000-0000-4000-8000-000000000006', 'e0e00000-0000-4000-8000-000000000005', null, null, 700, 0, 9)
on conflict (id) do nothing;

update public.products set archived_at = coalesce(archived_at, now()) where id = 'e0e00000-0000-4000-8000-000000000005';
