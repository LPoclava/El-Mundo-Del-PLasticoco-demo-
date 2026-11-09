-- Arte para celular de los banners promocionales.
-- Columna opcional: sin imagen móvil, el celular sigue usando la imagen apaisada. No cambia RLS ni las políticas de
-- Storage: el archivo vive en la misma carpeta banners/ que ya cubren. El sitio y el panel funcionan antes y después de
-- aplicar esta migración (detectan si la columna existe).

alter table public.promo_banners
  add column image_mobile_path text unique
    check (image_mobile_path is null
           or (image_mobile_path ~ '^banners/[A-Za-z0-9._-]+$' and char_length(image_mobile_path) <= 120));

comment on column public.promo_banners.image_mobile_path is
  'Imagen para celular (unos 1200 x 900 px) dentro del bucket product-images. Null: se usa image_path.';

-- La columna nueva va al final: create or replace conserva los permisos y las opciones de la vista.
create or replace view public.public_promo_banners with (security_barrier = true) as
select b.id, b.title, b.body, b.badge, b.cta_label, b.link_url, b.image_path, b.image_alt, b.position, b.image_mobile_path
from public.promo_banners b
where b.is_active
  and (b.starts_at is null or b.starts_at <= now())
  and (b.ends_at is null or b.ends_at > now());
