-- Archivado: independiente de publish_enabled. Archivar no borra; despublicar no archiva.
-- Un producto archivado no aparece en el catálogo público aunque siga con publish_enabled.

alter table public.products add column archived_at timestamptz;
create index products_archived_idx on public.products (archived_at) where archived_at is not null;

-- Mismas columnas, mismo orden y mismos tipos que antes: el contrato público no cambia.
create or replace view public.public_catalog with (security_barrier = true) as
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
where p.publish_enabled and p.archived_at is null
group by p.id, c.slug, i.path;

revoke all on public.public_catalog, public.public_categories from public, anon, authenticated;
grant select on public.public_catalog, public.public_categories to anon, authenticated;
