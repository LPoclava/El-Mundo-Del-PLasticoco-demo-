-- Reversión de las migraciones 20261029000001 a 20261029000008 (roles, perfiles, auditoría,
-- archivado y escáner). NO es una migración: está fuera de supabase/migrations a propósito.
--
-- Vuelve a la autorización por public.staff SIN borrar datos de negocio (productos, categorías,
-- variantes, imágenes) ni usuarios de Auth. Orden pensado para no perder nunca el acceso del CEO:
-- primero se restauran las políticas viejas (la cuenta corporativa sigue en staff) y recién
-- después se quitan las nuevas.
--
-- Qué conserva por defecto: public.profiles, public.audit_log, la columna products.archived_at
-- y las funciones/tipo auxiliares. Así no se pierde auditoría ni historial de roles. El bloque
-- final (comentado) los elimina; hacerlo destruye la auditoría acumulada y no se puede deshacer.
--
-- Requisito: no haberse aplicado supabase/pending/20261029000099_close_drop_staff.sql.
-- Si ya se aplicó, staff_legacy no existe y la única vía es restaurar la copia de seguridad.

do $$
begin
  if to_regclass('public.staff_legacy') is null then
    raise exception 'public.staff_legacy no existe: el cierre ya se aplicó; restaurar desde copia de seguridad';
  end if;
  if not exists (select 1 from public.staff_legacy) then
    raise exception 'public.staff_legacy está vacía: la reversión dejaría la app sin acceso administrativo';
  end if;
end $$;

-- 1. Volver a staff y a is_staff().
alter table public.staff_legacy rename to staff;
grant execute on function public.is_staff() to authenticated;

-- 2. Restaurar las políticas viejas ANTES de quitar las nuevas.
create policy staff_all on public.categories for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.products for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.product_variants for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.product_images for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "personal lee fotos" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.is_staff());
create policy "personal sube fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_staff());
create policy "personal actualiza fotos" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_staff())
  with check (bucket_id = 'product-images' and public.is_staff());
create policy "personal elimina fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_staff());

create or replace function public.reassign_category_products(source uuid, target uuid) returns int
  language plpgsql security invoker set search_path = ''
  as $$
declare
  moved int;
begin
  if not public.is_staff() then
    raise exception 'No autorizado';
  end if;
  if source = target then
    raise exception 'Origen y destino son la misma categoría';
  end if;
  update public.products set category_id = target where category_id = source;
  get diagnostics moved = row_count;
  return moved;
end $$;

-- 3. Quitar las políticas nuevas.
drop policy categories_read on public.categories;
drop policy categories_insert on public.categories;
drop policy categories_update on public.categories;
drop policy categories_delete on public.categories;
drop policy gerente_all on public.products;
drop policy gerente_all on public.product_variants;
drop policy gerente_all on public.product_images;
drop policy "gerente lee fotos" on storage.objects;
drop policy "gerente sube fotos" on storage.objects;
drop policy "gerente actualiza fotos" on storage.objects;
drop policy "gerente elimina fotos" on storage.objects;

-- 4. Vista pública sin el filtro de archivados (la columna archived_at se conserva).
create or replace view public.public_catalog with (security_barrier = true) as
select p.id, p.name, p.brand, p.description, p.name_sort, p.search_text,
       c.slug as category_slug, i.path as image_path,
       min(v.price) as price, count(distinct v.price) > 1 as has_price_range
from public.products p
join public.categories c on c.id = p.category_id
join public.product_images i on i.product_id = p.id and i.is_primary
join public.product_variants v on v.product_id = p.id and v.price > 0
where p.publish_enabled
group by p.id, c.slug, i.path;
revoke all on public.public_catalog, public.public_categories from public, anon, authenticated;
grant select on public.public_catalog, public.public_categories to anon, authenticated;

-- 5. Funciones del escáner y de administración de usuarios.
drop function public.scan_lookup(text);
drop function public.scan_set_price(uuid, bigint);
drop function public.scan_link_barcode(uuid, text);
drop function public.scan_create_product(text, text, uuid, bigint, text);
drop function public.scan_require_employee();
drop function public.scan_normalize_barcode(text);
drop function public.admin_create_profile(uuid, text, public.app_role);
drop function public.admin_set_role(uuid, public.app_role);
drop function public.admin_set_active(uuid, boolean);
drop function public.admin_set_display_name(uuid, text);

-- 6. Triggers de auditoría del catálogo (audit_log y su historial se conservan).
drop trigger audit_categories on public.categories;
drop trigger audit_products on public.products;
drop trigger audit_product_variants on public.product_variants;
drop trigger audit_product_images on public.product_images;

-- ---------------------------------------------------------------------------------------------
-- ELIMINACIÓN TOTAL (descomentar solo si se decide abandonar el modelo de roles; pierde la auditoría):
--
-- drop trigger audit_profiles on public.profiles;
-- drop table public.audit_log;
-- drop table public.profiles;
-- drop function public.profiles_guard(), public.audit_row_change(), public.audit_log_immutable(),
--   public.has_role_at_least(public.app_role), public.current_app_role();
-- drop type public.app_role;
-- alter table public.products drop column archived_at;   -- pierde qué productos estaban archivados
-- ---------------------------------------------------------------------------------------------
