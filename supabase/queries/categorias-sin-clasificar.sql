-- SOLO LECTURA. Ejecutar en el SQL Editor DESPUÉS de aplicar 20261030000001 (o antes, quitando las
-- columnas nuevas). No modifica nada.
--
-- Muestra qué categorías y productos NO quedaron dentro de una de las cuatro principales
-- (Cocina, Baño, Librería, Regalería). Esa clasificación es una decisión del negocio: la migración
-- no mueve ningún producto por su nombre o descripción. Para cada caso hay dos salidas:
--   a) Hacer subcategoría de una principal:  update public.categories set parent_id = '<id de la principal>' where id = '<id>';
--   b) Mover sus productos a otra categoría:  select public.reassign_category_products('<origen>', '<destino>');
-- (Ambas exigen rol gerente o superior; desde el SQL Editor como superusuario se pueden ejecutar igual.)

-- 1. Categorías de primer nivel que no son una de las cuatro principales, con su cantidad de productos.
select c.id,
       c.name,
       c.slug,
       count(p.id)                                    as productos,
       count(p.id) filter (where p.publish_enabled)   as publicados
from public.categories c
left join public.products p on p.category_id = c.id
where c.parent_id is null
  and c.featured_position is null
group by c.id
order by productos desc, c.name;

-- 2. Productos publicados que hoy no aparecen bajo ninguna de las cuatro principales
--    (su categoría, o la categoría padre de esta, no es una destacada).
select p.id,
       p.name        as producto,
       c.name        as categoria,
       c.slug        as categoria_slug,
       p.publish_enabled
from public.products p
join public.categories c on c.id = p.category_id
left join public.categories parent on parent.id = c.parent_id
where coalesce(parent.featured_position, c.featured_position) is null
order by c.name, p.name;

-- 3. Control de integridad: ningún producto debe quedar sin categoría ni apuntar a una inexistente.
select count(*) as productos_sin_categoria_valida
from public.products p
left join public.categories c on c.id = p.category_id
where c.id is null;
