-- Políticas del catálogo por rol. Reemplazan a staff_all (basada en public.staff).
--
-- IMPORTANTE: las políticas PERMISIVAS (las de por defecto) se combinan con OR, no con Y.
-- Si staff_all siguiera junto a las nuevas, cualquiera que figurara en staff conservaría acceso
-- total aunque su perfil esté inactivo o sea empleado. Por eso se crean las nuevas y se borra
-- staff_all dentro de esta misma migración (una sola transacción).
--
-- Empleado: no escribe ni lee productos directamente; lo hace con las funciones scan_* (migración 8).
-- Solo puede LEER categorías, para elegir una al crear un producto desde el escáner.

create policy categories_read on public.categories for select to authenticated
  using ((select public.has_role_at_least('empleado')));
create policy categories_insert on public.categories for insert to authenticated
  with check ((select public.has_role_at_least('gerente')));
create policy categories_update on public.categories for update to authenticated
  using ((select public.has_role_at_least('gerente')))
  with check ((select public.has_role_at_least('gerente')));
create policy categories_delete on public.categories for delete to authenticated
  using ((select public.has_role_at_least('gerente')));

create policy gerente_all on public.products for all to authenticated
  using ((select public.has_role_at_least('gerente')))
  with check ((select public.has_role_at_least('gerente')));
create policy gerente_all on public.product_variants for all to authenticated
  using ((select public.has_role_at_least('gerente')))
  with check ((select public.has_role_at_least('gerente')));
create policy gerente_all on public.product_images for all to authenticated
  using ((select public.has_role_at_least('gerente')))
  with check ((select public.has_role_at_least('gerente')));

drop policy staff_all on public.categories;
drop policy staff_all on public.products;
drop policy staff_all on public.product_variants;
drop policy staff_all on public.product_images;
