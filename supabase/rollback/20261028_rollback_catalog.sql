-- Reversión de las migraciones 20261028000001 a 20261028000005.
-- NO es una migración: está fuera de supabase/migrations a propósito. Borra todos los datos del catálogo.
-- Los archivos del bucket product-images se eliminan aparte desde Storage.

drop policy if exists "personal lee fotos" on storage.objects;
drop policy if exists "personal sube fotos" on storage.objects;
drop policy if exists "personal actualiza fotos" on storage.objects;
drop policy if exists "personal elimina fotos" on storage.objects;

drop view if exists public.public_categories, public.public_catalog;
drop function if exists public.reassign_category_products(uuid, uuid);
drop table if exists public.product_images, public.product_variants, public.products, public.categories;
drop function if exists public.enforce_max_images();
drop function if exists public.is_staff();
drop table if exists public.staff;
drop function if exists public.set_updated_at();
drop function if exists public.f_unaccent(text);
-- Las extensiones unaccent y pg_trgm se dejan instaladas.
