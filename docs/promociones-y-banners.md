# Categorías principales, promociones y banners

Estado: **migración `20261030000001_main_categories_and_promo_banners.sql` aplicada en la base de producción** (confirmado por el equipo; una consulta de solo lectura a las vistas públicas lo corrobora). Antes de aplicarla se probó con PostgreSQL local (PGlite). Falta verificar con uso real el flujo completo del panel y las políticas de Storage.

## 1. Qué cambia

| Parte | Qué hace |
| --- | --- |
| Catálogo público | Arriba del catálogo, el carrusel «Promociones y combos»; debajo, cuatro tarjetas grandes (Cocina, Baño, Librería, Regalería); después el buscador, las pestañas y el listado de siempre. |
| Panel | Nueva sección «Banners promocionales» (rol gerente o superior) con **sesión real de Supabase**, no la de demostración. |
| Base de datos | Jerarquía de categorías de dos niveles, tabla `promo_banners`, vista pública `public_promo_banners`, función `reorder_promo_banners`, políticas de Storage y auditoría. |

## 2. Decisiones y por qué

**Categorías: se reutiliza `categories`, no se crea otra tabla.** Se agregan `parent_id` (subcategoría → principal), `featured_position` (1 a 4: marca las principales y su orden) e `image_path` (foto de la tarjeta). Reglas en la base: máximo dos niveles, una principal no puede ser hija, una sola categoría por posición.

**Las cuatro principales tienen identificador estable.** Los slugs son `cocina`, `bano`, `libreria` y `regaleria` y no cambian al renombrar. Si ya existe una categoría con el mismo slug o el mismo nombre (sin tildes ni mayúsculas), la migración **la reutiliza**: conserva su `id` y sus productos. Es idempotente.

**No se reasigna ningún producto.** Los productos conservan su categoría. Los que queden fuera de las cuatro principales se detectan con `supabase/queries/categorias-sin-clasificar.sql` (solo lectura) y se resuelven a mano: hacerlos subcategoría de una principal o moverlos con `reassign_category_products`.

**Filtro del catálogo.** Elegir una principal muestra también los productos de sus subcategorías (`public_catalog.main_category_slug`). Las pestañas de siempre se mantienen; si la categoría elegida tiene subcategorías aparece una segunda fila.

**Categorías vacías.** `public_categories` solo lista las que tienen productos publicados (ellas o sus subcategorías). Una principal sin productos publicados **no muestra tarjeta**. Mientras no haya productos publicados, el bloque de tarjetas no aparece.

**Subcategorías desde el panel.** La base lo permite (`parent_id`) y la pantalla «Categorías» del panel ya está conectada a Supabase (`categories-section.tsx`, `lib/categories/admin.ts`; ver [estado.md](estado.md)). Falta comprobar con uso real que cubre crear subcategorías.

**Banner ≠ promoción ≠ combo.** El banner es solo una imagen con un destino. No copia productos ni precios. Para llevar a un producto o combo se usa un enlace (`/?categoria=cocina`, `/?q=balde`).

**Imágenes: se reutiliza el bucket `product-images`** (público, 5 MB, JPG/PNG/WebP) con dos carpetas nuevas, `banners/` y `categories/`. No hace falta un bucket nuevo ni cambiar `next.config.ts`. La tabla guarda la ruta, no los bytes. Un archivo pertenece a un solo banner (`image_path` único), así que borrar o reemplazar uno nunca rompe otro registro.

**Proporción fija 16:7.** Al subir, el panel exige una imagen apaisada (relación entre 2,0 y 2,6; ideal 1600 × 700 px, mínimo 800 px de ancho) y la reduce a 1920 px y la convierte a WebP en el navegador. Así ningún banner se recorta y el carrusel no mueve la página.

## 3. Seguridad

- **Lectura pública:** solo `public_promo_banners` (activos, dentro de su vigencia, sin fechas ni usuario). `anon` no tiene acceso a la tabla base.
- **Escritura:** RLS con `has_role_at_least('gerente')`. El empleado no puede leer, crear, editar ni borrar banners. Los botones ocultos del panel son comodidad, no protección.
- **Storage:** cuatro políticas nuevas para `banners/` y `categories/`, solo gerente o superior. Las de `products/` no se tocan. Si Supabase rechaza crearlas desde una migración, crearlas desde el panel de Storage con la misma condición (igual que las de la migración 6).
- **Enlaces:** la base rechaza `javascript:`, `http:`, `//dominio`, espacios y largos excesivos; el panel valida lo mismo antes de enviar, y el catálogo vuelve a comprobarlo al mostrar.
- **Auditoría:** `promo_banners` usa el mismo disparador que el catálogo; el gerente ve esos cambios. **No audita archivos de Storage** (límite ya documentado en `docs/autorizacion-roles.md`).
- **Claves:** el panel usa solo la clave pública (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). `service_role` no aparece en el frontend ni en el repositorio.

## 4. Compatibilidad con la base actual

El sitio funcionaba **antes y después** de aplicar la migración (compatibilidad que se conserva por si hay que probar en otra base):

- Sin la migración, el catálogo lee el esquema anterior (sin jerarquía) y el carrusel y las tarjetas no se muestran.
- Con la migración, todo se activa solo.

Por eso el código se pudo desplegar antes de aplicar la migración. El panel de banners, en cambio, necesita la migración.

La vista `public_catalog` se redefine en la migración conservando el filtro de archivados que agregó la migración 7. Si se agrega otro filtro a esa vista en el futuro, hay que repetirlo en ambas.

## 5. Carrusel (comportamiento)

- Avanza cada 10 s (`AUTOPLAY_MS` en `src/lib/banners/rules.ts`; eran 5 s al principio) y vuelve al primero tras el último.
- Se detiene con el cursor encima, con el foco dentro, con el dedo apoyado, con la pestaña oculta y con el botón de pausa. Con «reducir movimiento» activado en el sistema **no avanza solo** y las transiciones se desactivan.
- Controles: flechas (sobre la imagen en pantallas anchas; en la barra de abajo en celular), indicadores seleccionables, pausa, teclado (← →) y deslizamiento táctil.
- Con un solo banner no hay controles ni avance. Sin banners vigentes la sección no se dibuja.
- Los temporizadores se limpian al cambiar de estado y al desmontar.

## 6. Cómo probar

1. **Pruebas automáticas** (no tocan Supabase):
   - `cd supabase/tests && npm install && npm test` — 70 pruebas de la base, incluidas las de esta migración.
   - `node --test scripts/banner-rules.test.mjs` — reglas de enlaces, fechas, imágenes y carrusel.
2. **En un proyecto de PRUEBA de Supabase** (no el de producción): aplicar las migraciones en orden, crear un usuario en Auth, darle un perfil de gerente (`insert into public.profiles ...`, ver `docs/autorizacion-roles.md`), poner `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local`, y `npm run dev`.
3. Entrar en `/panel/login` (demostración, perfil gerente o CEO) → «Banners promocionales» → iniciar sesión con la cuenta real → subir un banner → verlo en `/`.
4. Probar con un usuario **empleado**: la sección debe decir que la cuenta no tiene permiso, y ningún intento por la API debe funcionar.

## 7. Qué no se hizo y dependencias

- **Precios promocionales y combos:** no se implementaron. Hoy el modelo es producto → variantes con un único `price`. Una estructura mínima compatible, para una etapa siguiente, sería `product_promotions (variant_id, promo_price, starts_at, ends_at)` con `promo_price < price` y vigencia, mostrada junto al precio normal solo mientras esté vigente; y `combos` + `combo_items (combo_id, product_id, quantity)` con precio propio. Ninguna toca `product_variants.price`. Requiere decidir reglas de negocio (¿por variante o por producto?, ¿el combo descuenta stock?; hoy no hay inventario) y una pantalla de gestión con los mismos permisos. Mientras tanto, un banner puede anunciar cualquier oferta con un enlace.
- **Panel de categorías real:** resuelto después de esta etapa; ver la sección de subcategorías arriba.
- **Panel de demostración:** hoy solo Usuarios, CRM y Configuración siguen con datos en memoria; el detalle está en [estado.md](estado.md).
- **Arte para celular** (migración `20261103000001`, aplicada): columna opcional `promo_banners.image_mobile_path`, de unos 1200 × 900 px (4:3), en la misma carpeta `banners/`. Sin ella, el celular usa la imagen apaisada.
- **Imágenes de las tarjetas:** sin foto cargada, cada tarjeta muestra un ícono. No se incluyeron fotos de ejemplo.
