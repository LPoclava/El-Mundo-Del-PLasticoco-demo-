# Modelo de datos — Mundo del Plástico

Estado: **modelo aprobado; todas las migraciones de `supabase/migrations` están aplicadas en la base de producción** (confirmado por el usuario el 4 de noviembre de 2026; ver [estado.md](estado.md)). La tabla de la sección 7 conserva solo las del modelo original; las posteriores (roles, banners, ventas) están en sus propios documentos.

> **Autorización:** las secciones de este documento que mencionan `public.staff` e `is_staff()` describen el modelo original, **ya reemplazado** por tres roles (`empleado`, `gerente`, `ceo`), perfiles y auditoría, aplicados en producción: ver [autorizacion-roles.md](autorizacion-roles.md). `staff` quedó como `staff_legacy` hasta el cierre pendiente.

> **Categorías y banners:** la migración `20261030000001` agrega subcategorías (un nivel), las cuatro categorías principales y los banners promocionales. Las secciones 3 y 4 de este documento ("sin subcategorías") describen el modelo original; el modelo vigente está en [promociones-y-banners.md](promociones-y-banners.md). Aplicada en la base de producción.

## 1. Decisiones confirmadas

| Tema | Decisión |
| --- | --- |
| Catálogo público | Sin inicio de sesión |
| Orden del listado | Alfabético por nombre del producto (sin distinguir mayúsculas ni tildes) |
| Búsqueda pública | Por nombre, marca y descripción. SKU y código de barras **no** se buscan públicamente |
| Precios | Manuales, cargados por el personal, **solo enteros** (la base rechaza centavos) |
| Personal | 1 o 2 personas; cuentas creadas a mano en Supabase Auth, con su perfil y rol en `public.profiles` |
| Fotos | Bucket **público** de Storage; una URL directa puede ser accesible aunque el producto no esté publicado |
| Categorías | Dinámicas, administradas por el personal; una categoría por producto. Un nivel de subcategorías y cuatro principales: ver [promociones-y-banners.md](promociones-y-banners.md) |
| Fuera de alcance | Carrito y pagos en línea, pedidos, compras a proveedores, alquileres. (Ventas e inventario se agregaron después: ver [pos-ventas.md](pos-ventas.md)) |

## 2. Estado de cada campo

| Campo | Estado |
| --- | --- |
| Producto: nombre, categoría, estado de publicación, fechas | Confirmado |
| Marca, descripción | Confirmado (se usan en la búsqueda pública) |
| SKU, código de barras | Confirmado como uso interno. **Formato del código de barras provisional** (ver restricciones) |
| Variantes por tamaño y color, con precio propio | **Confirmado** (se mantienen) |
| Hasta 5 fotos, una principal | **Confirmado** (se mantienen) |
| Código de barras y SKU a nivel producto | Acordado; implica que el escaneo identifica el producto, no la variante |
| Precio | **Confirmado**: pesos enteros, sin centavos |
| Nombres de categorías | **Los define el negocio**; no se precarga ninguna |
| Orden manual de categorías | No incluido: se ordenan alfabéticamente |


## 3. Entidades

- **categories**: `name` (único sin distinguir mayúsculas), `slug` (único, **no cambia al renombrar**, para no romper enlaces).
- **products**: `name`, `category_id` (obligatoria), `description`, `brand`, `sku`, `barcode`, `publish_enabled`, `created_at`, `updated_at`.
- **product_variants**: `product_id`, `size`, `color`, `price`, `position`.
- **product_images**: `product_id`, `path` (ruta en Storage, no URL completa), `is_primary`, `position`.
- **staff** (modelo original, reemplazado): `user_id` de Supabase Auth; todos con los mismos permisos. Pasó a `staff_legacy` y, según la comprobación del 8 de noviembre de 2026, **hoy ya no existe** en producción (cierre aplicado; operador y fecha desconocidos); los permisos salen de `profiles` ([autorizacion-roles.md](autorizacion-roles.md)).

## 4. Categorías dinámicas

- El personal crea, renombra y selecciona categorías al crear o editar un producto. No hay lista cerrada ni categorías precargadas.
- `products.category_id` es **obligatoria**: todo producto tiene una categoría principal. Consecuencia: hay que crear al menos una categoría antes de cargar el primer producto.
- **Eliminar** una categoría con productos está bloqueado por la base (`on delete restrict`), no solo por la pantalla. Para resolverlo, el personal reasigna los productos con la función `reassign_category_products(origen, destino)` y después elimina la categoría vacía.
- El catálogo público lista como filtros solo las categorías que tienen al menos un producto publicado (vista `public_categories`). Una categoría vacía o sin productos publicados no genera un filtro inútil.
- Renombrar cambia `name` y deja `slug` igual: los enlaces `?categoria=slug` siguen funcionando.

## 5. Regla de publicación

Un producto aparece en el catálogo público solo si:

1. tiene al menos una variante con precio mayor que 0 (las variantes sin precio no se muestran),
2. tiene una foto principal,
3. `publish_enabled` es verdadero.

Los demás productos siguen en la base y siguen siendo administrables, pero no se leen desde el público. La regla vive en la base (vista `public_catalog`), no en la pantalla.

**La visibilidad en el catálogo no es privacidad de la foto.** El bucket es público: la foto de un producto no publicado es accesible por URL directa. Para que esa URL no se pueda adivinar, los archivos se guardan con nombre aleatorio (`products/{product_id}/{uuid}.webp`) y el público no tiene permiso para listar el bucket. Es una aceptación consciente, no una protección.

## 6. Seguridad

- **Lectura pública:** solo a través de las vistas `public_catalog` y `public_categories`. El rol `anon` no tiene acceso a las tablas base.
- **Escritura y administración:** según el rol del perfil en `profiles` (gerente o superior para el catálogo), verificado por RLS en la base; en el modelo original era «estar en `staff`». Ocultar el panel o validar en el frontend no cuenta como protección.
- **Vistas públicas:** corren con permisos del dueño a propósito (así exponen solo las columnas elegidas) y usan `security_barrier` para que un filtro del cliente no pueda filtrar filas ocultas.
- **Función `is_staff()`:** `security definer` con `search_path` fijo.
- **Claves:** el navegador usa solo la clave pública (`anon`). La clave `service_role` nunca va en el frontend ni en el repositorio.
- **Duplicados:** `sku` y `barcode` son únicos (cuando existen). Los nombres de categoría son únicos sin distinguir mayúsculas.
- **Datos inválidos:** nombre no vacío, precio mayor que 0, `sku` y `barcode` sin espacios y no vacíos, formato de código de barras (provisional), una sola foto principal por producto, máximo 5 fotos.

## 7. Migraciones

Las migraciones del modelo original están en `supabase/migrations` (aplicadas):

| Archivo | Contenido |
| --- | --- |
| `20261028000001_extensions_helpers_staff.sql` | Extensiones `unaccent` y `pg_trgm`, funciones auxiliares, tabla `staff` y `is_staff()` |
| `20261028000002_catalog_tables.sql` | Categorías, productos, variantes y fotos, con restricciones, índices y triggers |
| `20261028000003_rls_and_category_reassign.sql` | Permisos, RLS y `reassign_category_products` |
| `20261028000004_public_catalog_views.sql` | Vistas públicas `public_catalog` y `public_categories` |
| `20261028000005_storage_product_images.sql` | Bucket público `product-images` y políticas de escritura del personal |

La reversión completa está en `supabase/rollback/20261028_rollback_catalog.sql`, fuera de `migrations` a propósito. Borra los datos del catálogo.

Alta del personal: ya no se inserta en `staff`. Se crea el usuario en Supabase Auth y su perfil en `public.profiles` (o lo hace un CEO con las funciones `admin_*`); ver [autorizacion-roles.md](autorizacion-roles.md).

## 8. Consecuencias y puntos a vigilar

- **Fotos huérfanas:** borrar un producto elimina sus filas de fotos, pero no los archivos de Storage. El panel borra los archivos al quitar una foto; los productos no se borran, se archivan ([gestion-de-productos.md](gestion-de-productos.md)).
- **Código de barras por producto:** el escaneo no distingue variantes; la consulta interna mostrará todas las variantes del producto.
- **Búsqueda con tildes y mayúsculas:** la aplicación normaliza el texto buscado (minúsculas, sin tildes) y filtra por `search_text`; el orden usa `name_sort`. Depende de `f_unaccent` y `pg_trgm`; probar con datos reales y volumen.
- **Primera categoría:** sin categorías no se pueden crear productos.
- **Cuentas del personal:** crear el usuario en Auth y su fila en `profiles`. Sin perfil activo, esa persona no puede hacer nada.

## 9. Diferencias entre el código actual y estas decisiones

Resuelto: el catálogo lee las vistas públicas de Supabase (`src/lib/catalog/repository.ts`), con búsqueda por nombre, marca y descripción, orden alfabético y categorías de `public_categories`. Sin Supabase configurado el catálogo queda vacío; no hay datos de ejemplo.

## 10. Pendientes de confirmación

1. Formato real de los códigos de barras del negocio (hoy: 8 a 14 dígitos, provisional).
2. Si el nombre de una categoría puede repetirse con distinta escritura (hoy no).
3. Nombre de la primera categoría y cuentas del personal.
4. Límites de las fotos (hoy: 5 MB, JPG/PNG/WebP, provisional).

## 11. Cambios respecto de la versión anterior de este documento

| Cambio | Motivo |
| --- | --- |
| `products.category_id` pasa a ser obligatoria y con `on delete restrict` (antes opcional y `set null`) | "Cada producto tiene una categoría principal" y no se puede eliminar una categoría con productos |
| Nueva función `reassign_category_products` | Forma segura de reasignar productos antes de eliminar una categoría |
| `public_categories` lista solo categorías con productos publicados (antes, todas) | Evitar filtros inútiles en el catálogo público |
| `categories`: sin `position`, nombre único sin distinguir mayúsculas ni tildes, `slug` estable | Categorías libres que define el negocio, sin orden manual; enlaces que no se rompen al renombrar |
| `public_catalog` expone `description`, `name_sort` y `search_text` | Búsqueda por nombre, marca y descripción, y orden alfabético |
| `updated_at` mantenido por trigger en categorías y productos | Antes la columna existía pero nadie la actualizaba |
| Restricciones nuevas (largos, sin espacios, formato de código de barras provisional, precio máximo) | Evitar datos inválidos desde la base |
| `revoke` explícito a `anon` y `security_barrier` en las vistas | Separar lectura pública de administración privada |
| Políticas de Storage y límites del bucket | Coherencia con "bucket público, escritura solo del personal" |

## 12. Decisiones resueltas y riesgos que siguen abiertos

**Resueltas al aprobar las migraciones**

1. Se mantienen variantes y hasta 5 fotos.
2. Precios solo enteros.
3. Vistas públicas con permisos del dueño (intencional).
4. Personal en la tabla `staff`.
5. Variantes y fotos sin fechas propias (decisión por defecto; reversible con una migración aditiva).

**Riesgos que siguen abiertos**

| Riesgo | Detalle y mitigación |
| --- | --- |
| ~~Migraciones sin ejecutar~~ | Resuelto: todas están aplicadas en producción ([estado.md](estado.md)). |
| ~~Políticas sobre `storage.objects`~~ | Resuelto con las migraciones aplicadas. La nota sigue valiendo si hay que rearmar la base en otro proyecto. |
| Advertencia de Supabase por vistas | Esperada: las vistas corren con permisos del dueño a propósito. |
| Rendimiento de `public_catalog` | Une 4 tablas y agrupa en cada consulta; medir con datos reales. |
| Fotos públicas de productos no publicados | Aceptado. Mitigado con nombres aleatorios y sin listado público. |
| Archivos huérfanos en Storage | Borrar un producto a mano desde SQL no borra sus archivos. El panel no borra productos: los archiva y limpia los archivos al quitar fotos. |
| ~~Mismos permisos para todo el personal~~ | Resuelto con roles y auditoría ([autorizacion-roles.md](autorizacion-roles.md)). |
| Código de barras por producto | El escaneo no distingue variantes. |
