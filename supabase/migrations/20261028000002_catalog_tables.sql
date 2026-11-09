-- Tablas del catálogo: categorías dinámicas, productos, variantes y fotos.
-- Precios en pesos enteros (sin centavos). Ver docs/modelo-de-datos.md.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and char_length(name) <= 80),
  -- Estable: no cambia al renombrar, para no romper enlaces ?categoria=slug.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index categories_name_unique on public.categories (lower(public.f_unaccent(name)));
create trigger categories_updated before update on public.categories
  for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and char_length(name) <= 200),
  -- Obligatoria; no se puede eliminar una categoría con productos.
  category_id uuid not null references public.categories (id) on delete restrict,
  description text check (description is null or char_length(description) <= 2000),
  brand text check (brand is null or btrim(brand) <> ''),
  -- Uso interno; no se buscan desde el catálogo público.
  sku text unique check (sku is null or (btrim(sku) <> '' and sku = btrim(sku))),
  -- Formato PROVISIONAL (8 a 14 dígitos: EAN-8, UPC, EAN-13, GTIN-14). Ajustar si el negocio usa otros códigos.
  barcode text unique check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  publish_enabled boolean not null default false,
  -- Columnas derivadas: la API filtra y ordena por columnas, no por expresiones.
  name_sort text generated always as (lower(public.f_unaccent(name))) stored,
  search_text text generated always as (
    lower(public.f_unaccent(name || ' ' || coalesce(brand, '') || ' ' || coalesce(description, '')))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);
create index products_name_sort_idx on public.products (name_sort);
create index products_search_idx on public.products using gin (search_text extensions.gin_trgm_ops);
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size text check (size is null or btrim(size) <> ''),
  color text check (color is null or btrim(color) <> ''),
  -- Pesos enteros; null = todavía sin precio (la variante no se publica).
  price bigint check (price is null or (price > 0 and price < 1000000000)),
  position int not null default 0
);
create index product_variants_product_idx on public.product_variants (product_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  -- Ruta dentro del bucket product-images, no la URL completa.
  path text not null check (btrim(path) <> ''),
  is_primary boolean not null default false,
  position int not null default 0
);
create index product_images_product_idx on public.product_images (product_id);
create unique index one_primary_image_per_product
  on public.product_images (product_id) where is_primary;

create function public.enforce_max_images() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  if (select count(*) from public.product_images
      where product_id = new.product_id and id <> new.id) >= 5 then
    raise exception 'Un producto admite como máximo 5 fotos';
  end if;
  return new;
end $$;
create trigger product_images_max before insert or update of product_id on public.product_images
  for each row execute function public.enforce_max_images();
