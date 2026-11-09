# Gestión de productos conectada a Supabase

Estado: **código listo y probado contra PostgreSQL local y una API simulada; la persistencia real contra Supabase NO se verificó**. No hay migración nueva: todo usa el esquema que ya está en producción.

## 1. Qué hace

La sección **Productos** del panel (`/panel/productos`) deja de ser una maqueta en memoria y pasa a leer y escribir en Supabase con la sesión real de quien administra (la misma pantalla de ingreso que «Banners promocionales»; no es el login de demostración).

| Función | Dónde se guarda |
| --- | --- |
| Nombre, marca, descripción, categoría, código de barras, SKU | `products` |
| Variantes (tamaño, color, precio entero) | `product_variants` |
| Hasta 5 fotos, una principal, orden | `product_images` + bucket `product-images`, ruta `products/{product_id}/{uuid}.webp` |
| Publicar / despublicar | `products.publish_enabled` |
| Archivar / desarchivar | `products.archived_at` |

El listado se pagina, busca y filtra **en el servidor** (10 por página; búsqueda sobre `search_text`, o por código si se escriben solo dígitos).

## 2. Qué NO cambió (a propósito)

- La vista `public_catalog` y su regla de publicación (habilitado, no archivado, foto principal y al menos una variante con precio > 0). El panel no la duplica para decidir qué se ve: solo la usa para **avisar** por qué un producto no se mostraría (`hiddenReasons`) y para no ofrecer «Publicar» cuando falta algo.
- Migraciones, políticas RLS y de Storage. Las escrituras exigen gerente o superior (`gerente_all`, políticas «gerente … fotos»). El empleado sigue usando solo las funciones `scan_*`.
- El catálogo público: lee `public_catalog` igual que antes.

## 3. Cómo se protege cada guardado

`saveProduct` (`src/lib/products/admin.ts`) ordena las escrituras para que una falla a medias no deje datos peligrosos:

1. **Alta siempre sin publicar.** Si falla algo después, el producto queda como borrador, nunca publicado sin foto.
2. **Fotos: primero el archivo, después la fila.** Si falla la fila, se borra el archivo recién subido. Si falla una subida, se limpian las anteriores de esa operación.
3. **Variantes:** altas y cambios antes de las bajas, así un producto publicado no pasa por un estado sin precio.
4. **Foto principal en dos pasos** (el índice único admite una sola): se suelta la actual y se marca la nueva; si el segundo paso falla, se restaura la anterior. En ese instante el producto publicado queda oculto (nunca roto), no visible sin imagen.
5. **Bajas de fotos:** primero se borran las filas; **recién cuando eso se confirmó** se borran de Storage los archivos que ninguna otra fila usa. Si Storage falla, el archivo queda y se avisa; no afecta al producto.
6. **Publicar al final**, releyendo el estado real: solo si hay foto principal y precio válido. Si no, se guarda sin publicar y se explica por qué.
7. **Reintentos sin duplicar:** el formulario bloquea el doble envío (guardia síncrona más botón deshabilitado). Si el alta funcionó pero algo posterior falló, la pantalla pasa a modo edición con los ids de lo ya guardado (`SaveError`): guardar de nuevo **actualiza**, no crea otro producto ni repite fotos.

Errores concretos: código de barras o SKU repetidos, máximo 5 fotos, permiso denegado, conexión, categoría inexistente.

## 4. Fotos

Se reutiliza el procesamiento de banners (`prepareImage`, tipo `product`): valida formato y 5 MB, exige una imagen casi cuadrada (relación 0,7 a 1,5; mínimo 500 px; ideal 1000 × 1000), la reduce a 1600 px y la convierte a WebP en el navegador. La proporción casi cuadrada evita que el catálogo (tarjetas cuadradas con `object-cover`) recorte lo importante.

## 5. Cómo probar

1. **Automáticas (no tocan Supabase):**
   - `cd supabase/tests && npm install && npm test` — incluye `products-admin.test.mjs` (secuencia de escrituras, visibilidad en `public_catalog`, máximo 5 fotos, una principal, permisos de empleado/anon/inactivo, Storage, duplicados).
   - `node --test scripts/product-rules.test.mjs` — reglas de formulario, precios, fotos y búsqueda.
2. **Con Supabase de PRUEBA** (no producción): proyecto aparte con las migraciones aplicadas en orden, un usuario de Auth con perfil de gerente (ver `docs/autorizacion-roles.md`), `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local`, `npm run dev`. Entrar en `/panel/login` (demostración) → «Productos» → iniciar sesión con la cuenta real.
3. Recorrido sugerido: crear un producto con categoría, un precio y dos fotos; marcar la segunda como principal; publicar; verlo en `/` con esa foto; volver a abrirlo y comprobar que los datos persisten; cambiar el precio; quitar una foto; probar con un usuario empleado (la sección debe negar el acceso y la API directa también).

## 6. Límites y pendientes

- **No se verificó contra Supabase real**: ni la persistencia, ni PostgREST, ni Storage, ni las políticas de Storage en producción. Las pruebas de base usan PostgreSQL local (PGlite) con los roles de Supabase simulados; la interfaz se probó contra una API simulada.
- **El cambio de foto principal no es atómico** (dos instrucciones). Sería atómico con una función SQL; no se agregó para no tocar el esquema. Si se prefiere, es una migración pequeña (`set_primary_image(product_id, image_id)`).
- **Sin borrado de productos**: solo archivar. Las fotos de un producto borrado a mano desde SQL quedarían en Storage.
- **Dos personas editando el mismo producto a la vez**: gana el último guardado; no hay control de versiones.
- **Stock y ventas** no forman parte de esta etapa; ver [pos-ventas.md](pos-ventas.md).
- Las variantes totalmente vacías (sin tamaño, color ni precio) se ignoran al guardar; una variante existente que se deja vacía se elimina.
