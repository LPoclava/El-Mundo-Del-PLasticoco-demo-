-- Fotos de productos: bucket PÚBLICO. Una URL directa es accesible aunque el producto no esté publicado
-- (decisión aceptada); los archivos usan nombres aleatorios y el público no puede listar el bucket.
-- Convención de ruta: products/{product_id}/{uuid}.webp
-- Límite PROVISIONAL: 5 MB por archivo, JPG/PNG/WebP.
--
-- Si Supabase rechaza crear políticas sobre storage.objects desde una migración,
-- crear las cuatro políticas de abajo desde el panel de Storage con la misma condición.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Sin política de lectura para anon: las URLs públicas funcionan, pero no se puede listar el bucket.
create policy "personal lee fotos" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.is_staff());
create policy "personal sube fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_staff());
create policy "personal actualiza fotos" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_staff())
  with check (bucket_id = 'product-images' and public.is_staff());
create policy "personal elimina fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_staff());
