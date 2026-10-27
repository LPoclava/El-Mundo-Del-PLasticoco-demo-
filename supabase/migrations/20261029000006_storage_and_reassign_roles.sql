-- Storage y reasignación de categorías por rol; retira las dependencias de is_staff().
--
-- Si Supabase rechaza modificar políticas de storage.objects desde una migración (mismo caso
-- que la migración 5), crear estas cuatro políticas desde el panel de Storage con la misma
-- condición y borrar las cuatro "personal ..." viejas. No dejar ambas juegos activos a la vez:
-- las políticas permisivas se combinan con OR.

-- Fotos: solo gerente o superior puede ver, subir, actualizar y borrar, y solo bajo products/.
-- (El bucket es público: las URLs de las fotos se ven sin iniciar sesión; esto controla la escritura.)
create policy "gerente lee fotos" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and name like 'products/%'
         and (select public.has_role_at_least('gerente')));
create policy "gerente sube fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and name like 'products/%'
              and (select public.has_role_at_least('gerente')));
create policy "gerente actualiza fotos" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and name like 'products/%'
         and (select public.has_role_at_least('gerente')))
  with check (bucket_id = 'product-images' and name like 'products/%'
              and (select public.has_role_at_least('gerente')));
create policy "gerente elimina fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and name like 'products/%'
         and (select public.has_role_at_least('gerente')));

drop policy "personal lee fotos" on storage.objects;
drop policy "personal sube fotos" on storage.objects;
drop policy "personal actualiza fotos" on storage.objects;
drop policy "personal elimina fotos" on storage.objects;

-- Misma firma que antes; ahora exige gerente en vez de is_staff().
create or replace function public.reassign_category_products(source uuid, target uuid) returns int
  language plpgsql security invoker set search_path = ''
  as $$
declare
  moved int;
begin
  if not public.has_role_at_least('gerente') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if source = target then
    raise exception 'Origen y destino son la misma categoría';
  end if;
  perform set_config('app.via', 'reassign_category_products', true);
  update public.products set category_id = target where category_id = source;
  get diagnostics moved = row_count;
  return moved;
end $$;

-- Con todo lo anterior reemplazado, nada depende ya de is_staff() ni de staff.
-- staff se conserva como staff_legacy hasta verificar la transición; el borrado está en
-- supabase/pending/ y NO es parte de esta tanda.
revoke execute on function public.is_staff() from authenticated;
alter table public.staff rename to staff_legacy;
