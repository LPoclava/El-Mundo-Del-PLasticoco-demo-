# Modelo de datos — Mundo del Plástico

Estado: **modelo aprobado; todas las migraciones de `supabase/migrations` están aplicadas en la base de producción** (confirmado por el equipo). La tabla de la sección 7 conserva solo las del modelo original; las posteriores (roles, banners, ventas) están en sus propios documentos.

> **Autorización:** las secciones de este documento que mencionan `public.staff` e `is_staff()` describen el modelo original. Está en preparación su reemplazo por tres roles (`empleado`, `gerente`, `ceo`), perfiles y auditoría: ver [autorizacion-roles.md](autorizacion-roles.md). Nada de eso está aplicado en Supabase.

> **Categorías y banners:** la migración `20261030000001` agrega subcategorías (un nivel), las cuatro categorías principales y los banners promocionales. Las secciones 3 y 4 de este documento ("sin subcategorías") describen el modelo original; el modelo vigente está en [promociones-y-banners.md](promociones-y-banners.md). Aplicada en la base de producción.

## 1. Decisiones confirmadas

| Tema | Decisión |
| --- | --- |
| Catálogo público | Sin inicio de sesión |
| Orden del listado | Alfabético por nombre del producto (sin distinguir mayúsculas ni tildes) |
| Búsqueda pública | Por nombre, marca y descripción. SKU y código de barras **no** se buscan públicamente |
| Precios | Manuales, cargados por el personal, **solo enteros** (la base rechaza centavos) |
| Personal | 1 o 2 personas; cuentas creadas a mano en Supabase Auth |
| Fotos | Bucket **público** de Storage; una URL directa puede ser accesible aunque el producto no esté publicado |
| Categorías | Dinámicas, administradas por el personal; sin subcategorías; una categoría principal por producto |
| Fuera de alcance | Carrito, pagos, pedidos, ventas, inventario, compras a proveedores, alquileres |

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
- **staff**: `user_id` de Supabase Auth. Quien está acá puede administrar; no hay roles distintos en la primera versión.

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
- **Escritura y administración:** solo usuarios en `staff`, verificado por RLS en la base. Ocultar el panel o validar en el frontend no cuenta como protección.
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

Alta del personal, a mano, después de crear el usuario en Supabase Auth (desde el SQL editor):

```sql
insert into public.staff (user_id) values ('<uuid del usuario>');
```

## 8. Consecuencias y puntos a vigilar

- **Fotos huérfanas:** borrar un producto elimina sus filas de fotos, pero no los archivos de Storage. El panel deberá borrarlos.
- **Código de barras por producto:** el escaneo no distingue variantes; la consulta interna mostrará todas las variantes del producto.
- **Búsqueda con tildes y mayúsculas:** la aplicación normaliza el texto buscado (minúsculas, sin tildes) y filtra por `search_text`; el orden usa `name_sort`. Depende de `f_unaccent` y `pg_trgm`; probar con datos reales y volumen.
- **Primera categoría:** sin categorías no se pueden crear productos.
- **Cuentas del personal:** crear el usuario en Auth y luego insertarlo en `staff`. Sin esa fila, esa persona no puede administrar nada.

## 9. Diferencias entre el código actual y estas decisiones

Nota: los datos de ejemplo del catálogo se eliminaron; sin Supabase configurado el catálogo queda vacío. Pendiente respecto de lo confirmado:

- La búsqueda cubre nombre y marca; falta la descripción.
- El listado sigue el orden de carga; falta el orden alfabético.
- Las categorías de la pantalla salen de la vista `public_categories` (solo categorías con productos publicados).

Son ajustes pequeños que se hacen junto con la conexión a Supabase.

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
| Migraciones sin ejecutar | Solo se validó la sintaxis. Probar en un proyecto de prueba: columnas generadas, `unaccent`, índices y políticas de Storage. |
| Políticas sobre `storage.objects` | Pueden requerir crearse desde el panel de Storage si la migración es rechazada. |
| Advertencia de Supabase por vistas | Esperada: las vistas corren con permisos del dueño a propósito. |
| Rendimiento de `public_catalog` | Une 4 tablas y agrupa en cada consulta; medir con datos reales. |
| Fotos públicas de productos no publicados | Aceptado. Mitigado con nombres aleatorios y sin listado público. |
| Archivos huérfanos en Storage | Borrar un producto no borra sus archivos; lo hará el panel. |
| Mismos permisos para todo el personal | Cualquiera puede borrar o editar todo, sin registro de cambios. |
| Código de barras por producto | El escaneo no distingue variantes. |
| Código de la aplicación | Ya lee la vista pública de Supabase; búsqueda por descripción, orden alfabético y categorías con productos publicados se alinean al conectar Supabase. |
