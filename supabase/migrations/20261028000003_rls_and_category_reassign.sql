-- Permisos y RLS: el público no accede a las tablas; solo el personal las administra.

revoke all on public.categories, public.products, public.product_variants,
  public.product_images, public.staff from anon, authenticated;

grant select, insert, update, delete on public.categories, public.products,
  public.product_variants, public.product_images to authenticated;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;

create policy staff_all on public.categories for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.products for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.product_variants for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy staff_all on public.product_images for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Reasignar productos antes de eliminar una categoría (la base bloquea eliminar una categoría con productos).
-- Corre con los permisos de quien llama, así que además de is_staff() aplica RLS.
create function public.reassign_category_products(source uuid, target uuid) returns int
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

revoke execute on function public.reassign_category_products(uuid, uuid) from public, anon;
grant execute on function public.reassign_category_products(uuid, uuid) to authenticated;
