-- Lectura pública: solo estas vistas. Corren con permisos del dueño A PROPÓSITO
-- (exponen únicamente las columnas elegidas); Supabase puede mostrar una advertencia por eso.
--
-- Regla de publicación: habilitado + foto principal + al menos una variante con precio válido.
-- Las variantes sin precio no cuentan.

create view public.public_catalog with (security_barrier = true) as
select p.id,
       p.name,
       p.brand,
       p.description,
       p.name_sort,
       p.search_text,
       c.slug as category_slug,
       i.path as image_path,
       min(v.price) as price,
       count(distinct v.price) > 1 as has_price_range
from public.products p
join public.categories c on c.id = p.category_id
join public.product_images i on i.product_id = p.id and i.is_primary
join public.product_variants v on v.product_id = p.id and v.price > 0
where p.publish_enabled
group by p.id, c.slug, i.path;

-- Solo categorías con al menos un producto publicado: sin filtros inútiles.
create view public.public_categories with (security_barrier = true) as
select c.slug, c.name
from public.categories c
where exists (select 1 from public.public_catalog pc where pc.category_slug = c.slug);

revoke all on public.public_catalog, public.public_categories from public, anon, authenticated;
grant select on public.public_catalog, public.public_categories to anon, authenticated;
