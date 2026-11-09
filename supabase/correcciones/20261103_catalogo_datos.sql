-- Correcciones de DATOS del catálogo (no es una migración de esquema). Revisar y ejecutar una sola vez en el SQL Editor
-- de Supabase. También se puede hacer a mano desde el panel: Banners y Productos.
-- Cada cambio se identifica por id; si la fila ya no existe, no hace nada.

begin;

-- Banner Stanley: lleva a los termos, no a Regalería.
update public.promo_banners set link_url = '/?q=termos'
where id = '205b766a-5213-4ec2-91e5-51f91f68d0f5';

-- Banner del catálogo: dibuja un cursor y hoy no lleva a ningún lado.
update public.promo_banners set link_url = '/#catalogo'
where id = 'd361afa0-5243-4306-9669-9e56e527751d';

-- Juego de Cuchillos estaba en Limpieza (slug histórico «bano»): pasa a Cocina.
update public.products set category_id = (select id from public.categories where slug = 'cocina')
where id = '599082c4-33ce-4b5a-b7ab-63896b793cc2';

-- Bolsas de residuos estaba en Regalería: pasa a Limpieza.
update public.products set category_id = (select id from public.categories where slug = 'bano')
where id = '3eb2e39e-7348-404c-8919-444f8b69a526';

-- Nombre en minúscula. (El catálogo ya lo muestra con mayúscula inicial; esto lo corrige también en el panel.)
update public.products set name = 'Palitos'
where id = '2d2a0de8-bcc9-4140-a94f-54939e560f76';

commit;
