-- Categorías principales (jerarquía de dos niveles) y banners promocionales.
-- Solo AGREGA objetos y columnas nuevas; no reasigna ni borra productos. Ver docs/promociones-y-banners.md.
--
-- Orden de aplicación: esta migración va DESPUÉS de las de roles y auditoría (20261029...),
-- porque usa has_role_at_least(), audit_row_change() y la política audit_read_catalog.
--
-- Compatibilidad: el sitio público funciona antes y después de aplicarla (si faltan las columnas
-- nuevas, lee el esquema anterior). Se puede desplegar el código primero.

-- 1. Jerarquía de categorías --------------------------------------------------------------------
-- parent_id: la subcategoría apunta a su categoría principal. featured_position (1 a 4): marca las
-- cuatro categorías principales del catálogo y su orden. image_path: foto de la tarjeta (ruta en
-- el bucket product-images, bajo categories/); si es null, la tarjeta muestra un ícono.
alter table public.categories
  add column parent_id uuid references public.categories (id) on delete restrict,
  add column featured_position smallint check (featured_position between 1 and 4),
  add column image_path text check (
    image_path is null
    or (image_path ~ '^categories/[A-Za-z0-9._-]+$' and char_length(image_path) <= 120)
  ),
  add constraint categories_not_own_parent check (parent_id is null or parent_id <> id),
  -- Una categoría principal destacada no puede ser subcategoría de otra.
  add constraint categories_featured_is_top check (featured_position is null or parent_id is null);

create unique index categories_featured_position_unique
  on public.categories (featured_position) where featured_position is not null;
create index categories_parent_idx on public.categories (parent_id);

-- Máximo dos niveles: sin esto un ciclo o una cadena larga haría ambiguo el filtro del catálogo.
create function public.enforce_category_depth() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.categories where id = new.parent_id and parent_id is not null) then
      raise exception 'Una subcategoría no puede tener subcategorías' using errcode = '23514';
    end if;
    if exists (select 1 from public.categories where parent_id = new.id) then
      raise exception 'Una categoría que tiene subcategorías no puede depender de otra' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger categories_depth before insert or update of parent_id on public.categories
  for each row execute function public.enforce_category_depth();

-- Alta de las cuatro categorías principales. Si ya existe una con el mismo slug o el mismo nombre
-- (sin distinguir mayúsculas ni tildes) se REUTILIZA: conserva su id y sus productos. Es idempotente.
do $$
declare
  rec record;
  v_id uuid;
begin
  for rec in
    select * from (values
      (1, 'Cocina', 'cocina'),
      (2, 'Baño', 'bano'),
      (3, 'Librería', 'libreria'),
      (4, 'Regalería', 'regaleria')
    ) as t(pos, name, slug)
  loop
    select c.id into v_id
    from public.categories c
    where c.slug = rec.slug
       or lower(public.f_unaccent(c.name)) = lower(public.f_unaccent(rec.name))
    order by (c.slug = rec.slug) desc
    limit 1;

    if v_id is null then
      insert into public.categories (name, slug, featured_position)
      values (rec.name, rec.slug, rec.pos);
    else
      update public.categories set featured_position = rec.pos where id = v_id;
    end if;
  end loop;
end $$;

-- 2. Vistas públicas ----------------------------------------------------------------------------
-- Solo se AGREGAN columnas al final: las que ya usa el sitio no cambian.
-- main_category_slug: la categoría principal del producto (la suya si no tiene padre).
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
       count(distinct v.price) > 1 as has_price_range,
       coalesce(pc.slug, c.slug) as main_category_slug
from public.products p
join public.categories c on c.id = p.category_id
left join public.categories pc on pc.id = c.parent_id
join public.product_images i on i.product_id = p.id and i.is_primary
join public.product_variants v on v.product_id = p.id and v.price > 0
where p.publish_enabled and p.archived_at is null
group by p.id, c.slug, i.path, pc.slug;

-- Una categoría aparece solo si ella o alguna de sus subcategorías tiene productos publicados.
create or replace view public.public_categories with (security_barrier = true) as
select c.slug,
       c.name,
       pc.slug as parent_slug,
       c.featured_position,
       c.image_path
from public.categories c
left join public.categories pc on pc.id = c.parent_id
where exists (
  select 1 from public.public_catalog p
  where p.category_slug = c.slug or p.main_category_slug = c.slug
);

-- 3. Banners promocionales ----------------------------------------------------------------------
-- El banner es solo la imagen del carrusel y a dónde lleva. No copia datos de productos ni precios.
create table public.promo_banners (
  id uuid primary key default gen_random_uuid(),
  title text check (title is null or (btrim(title) <> '' and char_length(title) <= 80)),
  body text check (body is null or (btrim(body) <> '' and char_length(body) <= 240)),
  badge text check (badge is null or (btrim(badge) <> '' and char_length(badge) <= 24)),
  cta_label text check (cta_label is null or (btrim(cta_label) <> '' and char_length(cta_label) <= 30)),
  -- Ruta interna ("/?categoria=cocina") o dirección https. Sin javascript:, http: ni "//dominio".
  link_url text check (
    link_url is null
    or (char_length(link_url) <= 500
        and link_url !~ '[[:space:]]'
        and (link_url ~ '^/([^/\\].*)?$' or link_url ~* '^https://[^/?#]+'))
  ),
  -- Ruta dentro del bucket product-images, no la URL: banners/{uuid}.webp. Un archivo, un banner.
  image_path text not null unique check (image_path ~ '^banners/[A-Za-z0-9._-]+$' and char_length(image_path) <= 120),
  image_alt text check (image_alt is null or (btrim(image_alt) <> '' and char_length(image_alt) <= 140)),
  is_active boolean not null default false,
  position int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Sin clave foránea a propósito (igual que audit_log): el dato sobrevive aunque cambie el usuario.
  updated_by uuid,
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);
create index promo_banners_order_idx on public.promo_banners (position, created_at);

create function public.promo_banners_stamp() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger promo_banners_stamp before insert or update on public.promo_banners
  for each row execute function public.promo_banners_stamp();

create trigger audit_promo_banners after insert or update or delete on public.promo_banners
  for each row execute function public.audit_row_change();

-- Gerente o superior administra los banners; el empleado no. La RLS es la protección real.
alter table public.promo_banners enable row level security;
revoke all on public.promo_banners from anon, authenticated;
grant select, insert, update, delete on public.promo_banners to authenticated;
create policy promo_banners_manage on public.promo_banners for all to authenticated
  using ((select public.has_role_at_least('gerente')))
  with check ((select public.has_role_at_least('gerente')));

-- Reordenar en una sola operación: recibe los ids en el orden deseado.
create function public.reorder_promo_banners(ids uuid[]) returns void
  language plpgsql security invoker set search_path = ''
  as $$
begin
  if not public.has_role_at_least('gerente') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  perform set_config('app.via', 'reorder_promo_banners', true);
  update public.promo_banners b
     set position = o.ord::int
    from unnest(ids) with ordinality as o(id, ord)
   where b.id = o.id;
end $$;
revoke execute on function public.reorder_promo_banners(uuid[]) from public, anon;
grant execute on function public.reorder_promo_banners(uuid[]) to authenticated;

-- Lectura pública: solo banners activos y dentro de su vigencia, con las columnas que se muestran.
create view public.public_promo_banners with (security_barrier = true) as
select b.id, b.title, b.body, b.badge, b.cta_label, b.link_url, b.image_path, b.image_alt, b.position
from public.promo_banners b
where b.is_active
  and (b.starts_at is null or b.starts_at <= now())
  and (b.ends_at is null or b.ends_at > now());
revoke all on public.public_promo_banners from public, anon, authenticated;
grant select on public.public_promo_banners to anon, authenticated;

-- 4. Auditoría: el gerente también ve los cambios de banners ------------------------------------
drop policy audit_read_catalog on public.audit_log;
create policy audit_read_catalog on public.audit_log for select to authenticated
  using ((select public.has_role_at_least('gerente'))
         and table_name in ('categories', 'products', 'product_variants', 'product_images', 'promo_banners'));

-- 5. Storage ------------------------------------------------------------------------------------
-- Se reutiliza el bucket público product-images (mismos límites: 5 MB, JPG/PNG/WebP) con dos
-- carpetas nuevas: banners/ y categories/. Las políticas existentes cubren solo products/.
-- Si Supabase rechaza crear políticas sobre storage.objects desde una migración, crear estas
-- cuatro desde el panel de Storage con la misma condición.
create policy "gerente lee imagenes del sitio" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (name like 'banners/%' or name like 'categories/%')
         and (select public.has_role_at_least('gerente')));
create policy "gerente sube imagenes del sitio" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (name like 'banners/%' or name like 'categories/%')
              and (select public.has_role_at_least('gerente')));
create policy "gerente actualiza imagenes del sitio" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (name like 'banners/%' or name like 'categories/%')
         and (select public.has_role_at_least('gerente')))
  with check (bucket_id = 'product-images' and (name like 'banners/%' or name like 'categories/%')
              and (select public.has_role_at_least('gerente')));
create policy "gerente elimina imagenes del sitio" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (name like 'banners/%' or name like 'categories/%')
         and (select public.has_role_at_least('gerente')));
