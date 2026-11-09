-- HUELLA DE LAS TABLAS (solo lectura). Cuenta las filas y calcula un hash MD5 del contenido ordenado de cada tabla de public.
-- Uso: correrla (1) justo antes del respaldo, (2) sobre la COPIA RESTAURADA del respaldo y (3) después de la limpieza.
-- La huella (1) y la (2) deben ser IDÉNTICAS fila por fila: así se prueba que el respaldo es completo y recuperable.
-- No devuelve datos de las filas, solo conteos y hashes.
select 'audit_log' as tabla, count(*) as filas, md5(coalesce(string_agg(t::text, '|' order by t.id), '')) as huella from public.audit_log t
union all select 'categories',       count(*), md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.categories t
union all select 'payment_methods',  count(*), md5(coalesce(string_agg(t::text, '|' order by t.code), '')) from public.payment_methods t
union all select 'product_images',   count(*), md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.product_images t
union all select 'product_variants', count(*), md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.product_variants t
union all select 'products',         count(*), md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.products t
union all select 'profiles',         count(*), md5(coalesce(string_agg(t::text, '|' order by t.user_id), '')) from public.profiles t
union all select 'promo_banners',    count(*), md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.promo_banners t
union all select 'sale_items',       count(*), md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.sale_items t
union all select 'sales',            count(*), md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.sales t
union all select 'stock_movements',  count(*), md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from public.stock_movements t
order by 1;
