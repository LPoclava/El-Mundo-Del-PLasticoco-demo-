-- Ficha pública de producto (/producto/[slug]).
-- Agrega DOS vistas de solo lectura para el visitante anónimo, sin tablas ni columnas nuevas:
--   - public_product_images: todas las fotos (hasta 5) de los productos publicados.
--   - public_product_variants: las variantes con precio de los productos publicados.
-- La regla de publicación NO cambia: un producto aparece solo si ya está en public_catalog
-- (habilitado, no archivado, con foto principal y al menos una variante con precio).
-- No se expone stock, SKU ni código de barras: no hay una decisión del negocio para mostrarlos.

create view public.public_product_images with (security_barrier = true) as
select i.product_id,
       i.path,
       i.is_primary,
       i.position
from public.product_images i
where exists (select 1 from public.public_catalog pc where pc.id = i.product_id);

-- Solo variantes con precio: una variante sin precio no se publica (misma regla que public_catalog).
create view public.public_product_variants with (security_barrier = true) as
select v.id,
       v.product_id,
       v.size,
       v.color,
       v.price,
       v.position
from public.product_variants v
where v.price > 0
  and exists (select 1 from public.public_catalog pc where pc.id = v.product_id);

revoke all on public.public_product_images, public.public_product_variants from public, anon, authenticated;
grant select on public.public_product_images, public.public_product_variants to anon, authenticated;
