# Informe final de la Etapa 0: Mundo del Plástico

Fecha: 9 de noviembre de 2026. Sitio publicado: <https://el-mundo-del-plastico.vercel.app/>. Supabase: `nogufedcmkjphiqyyriz`. Rama: `main`.

**Escala de estados usada en todo el informe:** **Aprobado** · **Aprobado parcialmente** · **Pendiente por acceso** (falta un permiso o una sesión que Claude no tiene) · **Pendiente por decisión** (la decide el usuario) · **No verificado**.

## 1. Resumen ejecutivo

- El sistema (catálogo público, panel con roles, punto de venta con stock atómico, auditoría) está implementado, probado y documentado. Todas las pruebas automáticas pasan igual que la línea base: **258/258**, **253/253** y **10/10**, además de TypeScript, ESLint, build y 0 vulnerabilidades en las dependencias de producción.
- **La limpieza S2 se EJECUTÓ en producción el 9 de noviembre de 2026 (05:21:50 UTC, hora registrada en el `audit_log`) y se verificó por consulta:** 0 productos, variantes, fotos, ventas, detalles y movimientos; 4 categorías, 5 medios de pago y 1 CEO con contenido idéntico; las 111 filas originales del `audit_log` idénticas más 22 nuevas; 8 triggers de protección habilitados; RLS en 11 tablas; estructura idéntica (funciones, políticas, triggers, índices y Storage con la misma huella). Se hizo tras tu confirmación explícita, con el respaldo verificado y un simulacro previo de 13/13 sobre una copia restaurada.
- **Un solo pendiente de datos:** los **dos archivos de Storage siguen en el bucket** (foto de Juego de Cuchillos, 9.152 bytes, y el huérfano de `categories/`, 79.308 bytes). Solo se pueden borrar con la API o el panel de Supabase con una sesión; el navegador integrado quedó en la pantalla de ingreso y **necesita que inicies sesión** (Claude no escribe credenciales).
- **El sitio publicado sigue con la versión anterior a la Etapa 0** (sin cabeceras de seguridad, sin `robots.txt` ni `sitemap.xml`): los cambios de la Etapa 0 solo llegan a producción con un `push` y un despliegue, que no están autorizados.
- **Conclusión: la Etapa 0 NO está cerrada todavía**, por una condición concreta: borrar los dos archivos de Storage (necesita tu sesión en el panel de Supabase) y verificar el panel y el Dashboard con tu sesión. Ver §14.

## 2. Estado inicial y estado final

| Aspecto | Al inicio de la Etapa 0 | Hoy (9 de noviembre de 2026) |
| --- | --- | --- |
| Panel | Modo demostración con CRM y Configuración de mentira; ingresos distintos | Ingreso único con Supabase Auth; rol desde `profiles`; sin demostración, CRM ni Configuración; sesión que se reevalúa al volver a la pestaña |
| Usuarios | Sin listado real | `admin_list_users()` solo CEO (aplicada) |
| Punto de venta | Sin recuperación ante cortes de red | Idempotencia persistida (`mp-venta-intento`) y verificación antes de reenviar (hallazgo H1 corregido) |
| Seguridad web | Sin CSP ni cabeceras | CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS (solo en producción local; **no desplegado**) |
| SEO | Sin `robots.txt` ni sitemap | Implementados (**no desplegados**) |
| Pruebas | Pruebas de aplicación y de base | + pruebas de recuperación (H1), de circuito de venta, de infraestructura, de autenticación; + simulacro de limpieza |
| CI | No existía | `.github/workflows/ci.yml` (tsc, lint, test, build); **nunca corrió en GitHub** |
| Documentación | Dispersa, parte fuera de Git | `docs/` y `supabase/` versionados; estado, decisiones y protocolos al día |
| Git | Trabajo sin commit | `main` en `4c4bbd6` (2 por delante de `origin/main`) más los cambios de esta tanda (ver §11) |
| Datos de producción | Material de prueba (10 productos, 5 ventas, 10 movimientos) | **Limpios** (0 productos, ventas y movimientos), con categorías, medios de pago, CEO y `audit_log` conservados. Quedan 2 archivos de prueba en Storage |

## 3. Limpieza realizada y evidencia

**Estado: EJECUTADA en producción el 9 de noviembre de 2026 a las 05:21:50 UTC** (marca de tiempo de la fila de constancia del `audit_log`), una sola transacción con `commit`, tras la confirmación explícita del usuario. Antes de ejecutar se repitieron las huellas de las 11 tablas (idénticas al respaldo) y el script verificó el inventario con sus guardas. Hasta ese momento solo se habían hecho lecturas con `SELECT`.

| Prueba | Resultado |
| --- | --- |
| Producción coincide con el inventario antes de ejecutar | **Aprobado** (huellas idénticas; guardas del script) |
| IDs y dependencias | **Aprobado**: 5 de 5 ventas, 10 de 10 productos, 0 fuera de la lista, suma de totales 85.750, 0 variantes con stock inconsistente |
| Simulacro del script real sobre la copia restaurada (rollback y commit) | **Aprobado** (13/13) |
| Aborta ante diferencias (venta extra, lista incompleta, esperado incorrecto) | **Aprobado** (réplica sintética) |
| **Ejecución en producción** | **Aprobado**: la transacción terminó sin error; sus validaciones previas y posteriores pasaron |
| Verificación independiente posterior en producción (consultas de solo lectura) | **Aprobado** (tabla siguiente) |
| Borrado de los 2 archivos de Storage | **Pendiente por acceso** (sesión del usuario en el panel de Supabase) |

**Resultado verificado en PRODUCCIÓN** (consultas de solo lectura posteriores a la ejecución):

| Elemento | Esperado | Resultado en producción |
| --- | --- | --- |
| Productos / variantes / fotos | 0 | **0 / 0 / 0** |
| Ventas / detalles / movimientos | 0 | **0 / 0 / 0** |
| Categorías | 4 | **4**, misma huella que antes (`68c1f342…`) |
| Medios de pago | 5 | **5**, misma huella (`9f8c76ac…`) |
| Cuenta CEO | 1 activa | **1**, misma huella (`6cdb87bf…`) |
| `audit_log` | Íntegro | **133 filas**: las **111 originales idénticas** (huella `3291702a…`, sin cambios) y **22 nuevas** (10 bajas de productos, 10 de variantes, 1 de foto y 1 constancia con el SHA-256 del respaldo) |
| Triggers de protección | 8 habilitados | **8 habilitados** y 0 deshabilitados |
| RLS | 11 tablas | **11** |
| Estructura (funciones, políticas, triggers, índices, Storage) | Sin cambios | Mismas huellas que antes: funciones `c5cf0ea3…`, políticas `284ad17e…`, triggers `171b0f9c…`, índices `41bed7c0…`, políticas de Storage `818702f3…` |
| Secuencias | No reiniciar | **Sin reiniciar**: ventas en 5 y movimientos en 10 (lo siguiente continúa en 6 y 11) |
| Esquemas o tablas de respaldo en la base | Ninguno | **Ninguno** |
| Stock | Consistente | Consistente (no quedan variantes ni movimientos) |
| Catálogo público (clave pública) | Responde | **Aprobado**: las 5 vistas públicas responden 200 con 0 filas |
| Tablas protegidas con la clave pública | Rechazo | **Aprobado**: 11 de 11 responden 401 |
| Autenticación | Funciona | **Aprobado parcialmente**: el registro sigue cerrado y `/auth/v1/user` sin sesión da 401; el ingreso con la cuenta CEO lo verifica el usuario |
| Panel administrativo y Dashboard con cero ventas | Funciona / 0 ventas | **No verificado**: requieren la sesión del usuario |
| Archivos de prueba en Storage | 0 | **2** (pendiente por acceso) |

Resultado del script sobre la **copia restaurada** (idéntica a producción):

| Elemento | Esperado por tu instrucción | Resultado en la copia |
| --- | --- | --- |
| Productos / variantes / fotos | 0 | 0 / 0 / 0 |
| Ventas / detalles / movimientos | 0 | 0 / 0 / 0 |
| Categorías | 4 | 4, contenido idéntico (misma huella) |
| Medios de pago | 5 | 5, contenido idéntico |
| Cuenta CEO | 1 activa | 1 activa, contenido idéntico |
| `audit_log` | Íntegro | Las **111 filas originales idénticas** (misma huella) y **22 nuevas**: 10 bajas de productos, 10 de variantes, 1 de foto y 1 constancia de la limpieza |
| Triggers de protección | 8 habilitados | 8 habilitados (los 3 `*_no_change` se deshabilitan solo dentro de la transacción y se rehabilitan antes del `commit`) |
| RLS | Activo en 11 tablas | Activo en 11 |
| Políticas, permisos, funciones, índices, Storage (estructura) | Sin cambios | **13 de 13** categorías de la huella de estructura idénticas |
| Stock | Consistente | Consistente (no quedan variantes ni movimientos) |
| Secuencias | **No reiniciar** | **No se reinician**: la próxima venta será la n.º 6 y el próximo movimiento el id 11 |
| Esquemas o tablas permanentes de respaldo en producción | No crear | **Ninguno** (el script no crea ninguno; los conteos usan una tabla temporal que desaparece sola) |
| `TRUNCATE` | No usar | No se usa; sigue fallando con `42501` |
| Recuperación | — | Desde el respaldo externo, 9 tablas vuelven con la **misma huella** que producción (probado en la copia; **no hizo falta usarla**) |

**Aún no verificado, y por eso no se declara aprobado:** el acceso al panel y el Dashboard con cero ventas (necesitan tu sesión) y que Storage quede sin los archivos.

## 4. Respaldo y limitaciones

Detalle: [registro-respaldo-limpieza.md](registro-respaldo-limpieza.md).

| Dato | Valor |
| --- | --- |
| Archivo | `C:\Users\lauty\Respaldos-AImpulse\mundo-del-plastico_limpieza_respaldo_2026-11-09.tar.gz` (fuera del repositorio y de OneDrive) |
| SHA-256 | `f8fedd8b2cff164d6912db9237612df0118f6e65492a36f4ea2bfc1fcf173880` (101.365 bytes) |
| Verificado | Integridad, hash recomputable, contenido legible, 0 archivos distintos tras extraerlo, y **restauración en una base temporal con 11/11 tablas y 13/13 categorías de estructura idénticas** |
| Contiene | Las 11 tablas de `public` (incluido el `audit_log` completo), la cuenta de Auth sin secretos, la configuración del bucket, los metadatos y los **2 archivos de Storage** con su SHA-256 |

**Limitaciones (documentadas, no bloquean):** es una **copia lógica** hecha por el conector en solo lectura, no un `pg_dump` (el entorno no tiene `pg_dump`, ni credenciales de la base, y no se piden por chat); **no incluye el hash de la contraseña de Auth** (si hiciera falta restaurar Auth se restablece la contraseña); la estructura se reconstruye con las migraciones de Git, lo que **se demostró** que reproduce producción. Un `pg_dump` completo sigue siendo recomendable cuando puedas correrlo con tu contraseña. **Pendiente por acceso (opcional):** comprobar si el plan de Supabase incluye copias diarias o PITR.

## 5. Cambios técnicos realizados

| Área | Cambio |
| --- | --- |
| Limpieza | `supabase/limpieza/20261109_limpieza_produccion.PROPUESTA.sql` (S2, una transacción, termina en `rollback`; sin esquema de respaldo, sin reinicio de secuencias), `generar_restauracion.mjs` (genera el SQL de recuperación desde el respaldo), `huella_tablas.sql`, `huella_estructura.sql` |
| Pruebas | `supabase/tests/limpieza-restauracion.mjs`, `limpieza-simulacro-s2.mjs`, `limpieza-replica.mjs` |
| Consultas | `supabase/queries/bloque-2-solo-lectura.sql` (diagnóstico en solo lectura) |
| Documentación | Informes de los bloques 1, 2 y B, protocolos, plan y registro del respaldo, estado, decisiones, despliegue, modelo de datos y roles al día |
| Código de la aplicación | **Sin cambios en esta tanda** (el código de la Etapa 0 ya está en `main`, commit `bdcdd6d`) |
| Defecto corregido | El simulacro detectó que la instantánea de estructura del script de limpieza no incluía `audit_max`; corregido antes de la prueba final. Defectos de documentación: afirmaciones superadas marcadas como históricas |

## 6. Arquitectura final

### 6.1 Tecnologías

Next.js 16.4.3 (App Router, Turbopack, `cacheComponents`), React 19.3, TypeScript 5.9, Tailwind CSS 4.3, `@supabase/supabase-js` 2.118, `@zxing/library` (escáner), Node 24 (`.nvmrc`). Supabase: PostgreSQL 17, Auth, Storage. Despliegue en Vercel. **No hay rutas de API propias** (`route.ts`): toda la lógica de datos corre en el navegador contra Supabase con la clave pública, y la autorización vive en la base.

### 6.2 Componentes y módulos

| Módulo | Ubicación | Función |
| --- | --- | --- |
| Catálogo público | `src/app/(site)`, `src/components/catalog`, `product`, `src/lib/catalog` | Portada, listado, búsqueda, ficha de producto; solo lee las vistas `public_*` |
| Panel | `src/app/panel`, `src/components/panel`, `src/lib/panel` | Ingreso, menú por rol, secciones |
| Autenticación | `src/components/panel/auth-provider.tsx`, `src/lib/panel/{roles,session}.ts` | Sesión de Supabase en el navegador, rol desde `profiles`, reevaluación al volver a la pestaña |
| Productos y categorías | `src/lib/products`, `src/lib/categories` | Alta, edición, fotos, publicación, archivado |
| Banners | `src/lib/banners` | Banners promocionales (0 hoy) |
| Usuarios | `src/lib/users` | Lista (`admin_list_users`) y alta de perfiles (`admin_create_profile`) |
| Punto de venta y stock | `src/lib/pos`, `src/components/panel/pos` | Búsqueda, carrito, confirmación idempotente, recuperación de cortes (H1), comprobante interno, entradas y ajustes de stock |
| Escáner | `src/lib/barcode` | Lectura de códigos con la cámara |
| SEO y seguridad web | `src/app/robots.ts`, `sitemap.ts`, `next.config.ts` | `robots.txt`, `sitemap.xml`, CSP y cabeceras |

### 6.3 Modelo de datos y relaciones

Tablas de `public` (todas con RLS): `categories`, `products`, `product_variants`, `product_images`, `promo_banners`, `payment_methods`, `profiles`, `sales`, `sale_items`, `stock_movements`, `audit_log`. Vistas públicas: `public_catalog`, `public_categories`, `public_promo_banners`, `public_product_images`, `public_product_variants`.

| Relación | Regla |
| --- | --- |
| `product_variants`, `product_images` → `products` | `ON DELETE CASCADE` |
| `products` → `categories`; `categories` → `categories` (subcategorías) | `ON DELETE RESTRICT` |
| `sale_items` → `sales`; `stock_movements` → `sales` | `ON DELETE RESTRICT` |
| `sale_items.variant_id/product_id`, `stock_movements.variant_id` | `ON DELETE SET NULL` (permitido por el trigger del libro) |
| `sales.payment_method` → `payment_methods` | `RESTRICT` |
| `profiles.user_id` → `auth.users` | `ON DELETE RESTRICT` |

Detalle: [modelo-de-datos.md](modelo-de-datos.md).

### 6.4 Autenticación, roles y permisos

Roles `empleado < gerente < ceo`, leídos **solo** de `public.profiles` (con `active`); nunca del token ni de `user_metadata`. Una cuenta inactiva o sin perfil no tiene rol. El registro público de Auth está **cerrado**. Producción tiene **una sola cuenta** (CEO de prueba y desarrollo). Matriz completa en [autorizacion-roles.md](autorizacion-roles.md) §2; resumen:

| Operación | Empleado | Gerente | CEO |
| --- | --- | --- | --- |
| Buscar y vender (`pos_find`, `confirm_sale`) y escáner | Sí | Sí | Sí |
| Productos, categorías, banners, fotos, stock, medios de pago (escritura) | No | Sí | Sí |
| Ventas y movimientos | Solo las propias | Todas | Todas |
| Usuarios (`admin_*`, `admin_list_users`) | No | No | Sí (nunca sobre sí mismo) |
| `audit_log` | Propia | Del catálogo | Toda |

### 6.5 Flujos de venta y stock

`pos_find(texto)` busca por código o nombre y devuelve solo lo necesario. `confirm_sale(clave, medio, items)` es una función `security definer` atómica: valida rol, precios y stock; toma un candado por usuario; inserta `sales` y `sale_items`; descuenta el stock, y el trigger `log_stock_change` escribe el movimiento `venta`. Una clave de idempotencia única por usuario impide duplicar una venta; el cliente la conserva en `sessionStorage` y verifica antes de reenviar tras un corte (H1). `receive_stock` y `adjust_stock` (gerente) suman o corrigen stock y dejan movimiento. El libro (`sales`, `sale_items`, `stock_movements`) es de **solo agregado**: triggers `*_no_change` y `*_no_truncate`. El comprobante es **interno** (no es factura ni comprobante fiscal).

### 6.6 Seguridad y auditoría

RLS en las 11 tablas; sin políticas de escritura sobre `profiles`, `sales`, `sale_items`, `stock_movements` ni `audit_log` (solo funciones). 36 funciones con `search_path` fijo; las críticas no las ejecuta `anon`. Triggers de protección: `profiles_guard` (sin autoascenso, último CEO intocable) y el libro inmutable. `audit_log` de solo agregado (registra altas, cambios y bajas del catálogo, banners, categorías y perfiles, con actor, rol y valores; **no** registra lecturas, ventas ni archivos de Storage). Storage: bucket público, 5 MB, `jpeg/png/webp`, escritura solo para gerente o superior bajo `products/`, `banners/` y `categories/`. Sin `service_role` en el código ni en variables públicas.

## 7. Seguridad y permisos: verificación

| Verificación | Estado |
| --- | --- |
| `anon` no lee las 11 tablas protegidas ni ejecuta las 13 funciones críticas (producción) | **Aprobado** |
| Privilegios de tabla y ACL: `anon` solo `SELECT` en las 5 vistas; `authenticated` según lo previsto | **Aprobado** |
| RLS activo en las 11 tablas; 21 políticas en `public` y 8 en Storage, iguales a la documentación | **Aprobado** |
| Funciones `security definer` sin `search_path` fijo | **Aprobado** (0) |
| Políticas de Storage: todas exigen `gerente` y el prefijo; ninguna para `anon` | **Aprobado** |
| Sesión del CEO (S1 a S11) | **Aprobado parcialmente**: informada por el usuario, sin cifras en varios pasos; Claude no la verificó con sesión propia |
| Permisos de gerente y empleado con cuentas reales | **Pendiente por decisión** (no existen las cuentas) |
| Escrituras y rechazo de escrituras en la plataforma | **No verificado** (sin entorno aislado) |
| Dependencias de producción (`npm audit --omit=dev`) | **Aprobado**: 0 vulnerabilidades |
| Claves y secretos en el código | **Aprobado**: ninguno; `service_role` solo en comentarios de advertencia |
| Cabeceras de seguridad, `robots.txt` y `sitemap.xml` en el **sitio publicado** | **No cumplido en producción**: el sitio publicado sigue con la versión anterior (solo HSTS de Vercel; `robots.txt` y `sitemap.xml` dan 404). Verificado hoy en solo lectura. **Pendiente por acceso/decisión** (push y despliegue) |

## 8. Resultados de pruebas (9 de noviembre de 2026, sobre `main`)

| Prueba | Resultado | Línea base | Cambio |
| --- | --- | --- | --- |
| TypeScript | Sin errores | Sin errores | Igual |
| ESLint | Sin errores | Sin errores | Igual |
| Build de producción | OK | OK | Igual |
| Pruebas de la aplicación | **258/258** (57 suites) | 258/258 | Igual |
| Pruebas de la base (PGlite) | **253/253** (53 suites) | 253/253 | Igual |
| Concurrencia (PostgreSQL temporal) | **10/10** | 10/10 | Igual |
| Restauración del respaldo | **11/11** tablas y **13/13** categorías de estructura | — | Nueva |
| Simulacro S2 sobre la copia restaurada | **13/13** | 12/12 con la versión anterior del script | Subió de 12 a 13: se reemplazaron las comprobaciones del esquema de respaldo por las de secuencias sin reiniciar y de ausencia de esquemas, y se sumó una. Ninguna falló |
| Réplica sintética de la limpieza | **12/12** | 16/16 antes del ajuste | Bajó de 16 a 12 porque se **eliminaron** las comprobaciones del esquema de respaldo y de la recuperación desde la base, que ya no existen; ninguna falló |
| `npm audit` | 0 vulnerabilidades | — | Nueva |

Ninguna prueba falló en esta tanda; las únicas diferencias de cantidad se explican arriba.

## 9. Riesgos y vulnerabilidades residuales

| # | Riesgo | Nivel |
| --- | --- | --- |
| R1 | **El sitio publicado no tiene los cambios de la Etapa 0** (cabeceras, CSP, SEO, correcciones del panel y del POS) hasta que se haga push y despliegue | Alto |
| R2 | Roles gerente y empleado nunca validados en la plataforma; solo por diseño y pruebas en PGlite | Alto |
| R3 | Sin prueba física del POS (celular, cámara, lector, impresión, corte de red real) | Alto |
| R4 | Excepción única a «solo agregado» al borrar el libro: irreversible sin el respaldo | Medio (mitigado) |
| R5 | Respaldo lógico, no `pg_dump`; sin el hash de la contraseña de Auth | Medio |
| R6 | La CI de GitHub no ejecuta las pruebas de base ni de concurrencia y nunca corrió | Medio |
| R7 | Protección de rutas del panel solo del lado del cliente (la autoridad real es la base) | Bajo (decisión documentada) |
| R8 | Permiso `rwU` de `anon` y `authenticated` sobre 3 secuencias (valor por defecto de Supabase; sin vía de explotación desde la API) | Bajo |
| R9 | 7 funciones de disparador o utilidad ejecutables por `anon` (sin datos ni vía de invocación) | Bajo |
| R10 | Cachés externas y copias de las fotos C1 y C2 | Medio: ver §10 |
| R11 | Sin historial de versiones de migraciones; operaciones manuales sin registro técnico propio (el `audit_log` fecha parte de ellas) | Bajo |

**Limitaciones conocidas:** el comprobante no es fiscal; no hay anulación ni devolución de ventas (decisión pendiente); `audit_log` crece sin límite (retención por definir); la CSP usa `'unsafe-inline'` en scripts (incompatibilidad de los nonces con PPR); no hay precios promocionales ni combos.

## 10. Pendientes externos (no bloquean el cierre técnico)

| Pendiente | Estado |
| --- | --- |
| Pruebas con usuarios gerente y empleado | **Pendiente por decisión** (no existen las cuentas; crearlas o usar un proyecto aparte) |
| Prueba física del POS | **Pendiente por acceso** (requiere presencia del usuario) |
| CI en GitHub y Vercel (cabeceras, CSP, `NEXT_PUBLIC_SITE_URL`, escáner bajo la CSP) | **Pendiente por acceso** (necesita push; no autorizado) |
| Cachés externas de C1 y C2 | **Aprobado parcialmente:** el optimizador del sitio publicado **no entrega** esas fotos (HTTP 400, sin caché) en 6 anchos probados (256 a 1080) y la foto control sí responde; **no verificado:** otros anchos, vistas previas ya generadas por redes de mensajería, buscadores y copias de terceros |
| Borrado de los 2 archivos de Storage | **Pendiente por acceso** (sesión con permisos) y por decisión |
| Un `pg_dump` completo y la confirmación del plan de Supabase (copias diarias o PITR) | **Pendiente por acceso** |
| Aclarar el origen de las operaciones manuales sin autor (cierre `close_drop_staff`, cierre del registro de Auth) | **No verificado** (sin registro) |

## 11. Estado Git

`main` local, **4 commits por delante de `origin/main`** (`de4b9c2`). **Sin push ni despliegue.**

| Commit | Contenido |
| --- | --- |
| `bdcdd6d` | Consolidación de la Etapa 0 (código, pruebas, CI, documentación) |
| `4c4bbd6` | Conciliación del Bloque 1 con producción |
| `89038e4` | Script de limpieza S2, huellas, restauración y pruebas sobre réplica (`supabase/limpieza`, `supabase/tests/limpieza-*.mjs`, `supabase/queries/bloque-2-solo-lectura.sql`) |
| `11f3ce5` (o su reemplazo si se enmienda) | Documentación: informe final, plan, registro del respaldo, estado, decisiones, despliegue e informes de los bloques 1, 2 y B |

`Logos de categorias/` sigue sin versionar a propósito (recursos de marca pesados, respaldados). No se descartó ningún cambio del usuario. Se revisó que no haya secretos ni archivos temporales (búsqueda de claves, tokens, contraseñas y URLs con credenciales: sin hallazgos; el único correo es un marcador inválido de prueba). El respaldo vive fuera del repositorio.

## 12. Instalación, ejecución y mantenimiento

**Requisitos:** Node 24 (`.nvmrc`) y npm. **Variables de entorno** (sin valores secretos):

| Variable | Dónde | Para qué |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env` (versionado) y Vercel | Conexión pública a Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env` (versionado) y Vercel | Clave **pública** (nunca `service_role`) |
| `NEXT_PUBLIC_SITE_URL` | Vercel | Dominio con `https://` para canonical, Open Graph, `robots.txt` y `sitemap.xml` |
| `ALLOWED_DEV_ORIGINS` | `.env.local` (no versionado) | Solo desarrollo con celular en la red |
| `RESPALDO_LIMPIEZA` | Entorno local (opcional) | Carpeta del respaldo para los scripts de limpieza |

`.env` apunta a **producción**: para pruebas con escritura usar un proyecto aparte y `.env.local`.

```bash
npm ci
```

```bash
npm run dev
```

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

```bash
cd supabase/tests && npm ci && node --test *.test.mjs
```

```bash
cd supabase/tests && node concurrency.mjs
```

**Mantenimiento de la limpieza y del respaldo:**

```bash
cd supabase/tests && node limpieza-restauracion.mjs
```

```bash
cd supabase/tests && node limpieza-simulacro-s2.mjs
```

```bash
cd supabase/tests && node limpieza-replica.mjs
```

```bash
node supabase/limpieza/generar_restauracion.mjs
```

```bash
cd C:/Users/lauty/Respaldos-AImpulse && sha256sum -c mundo-del-plastico_limpieza_respaldo_2026-11-09.tar.gz.sha256
```

Migraciones: las aplica el usuario a mano en el SQL Editor, de a una y en orden (`proyecto-supabase-de-prueba.md` §2 trae la secuencia y las dependencias); anotar cada una en `estado.md`, porque no hay historial de versiones. Despliegue: [despliegue.md](despliegue.md).

## 13. Checklist de aceptación

| # | Criterio | Estado |
| --- | --- | --- |
| 1 | TypeScript, ESLint y build sin errores | **Aprobado** |
| 2 | 258/258, 253/253 y 10/10 | **Aprobado** |
| 3 | Respaldo verificado con SHA-256 y restauración con huellas idénticas | **Aprobado** (con la limitación de §4) |
| 4 | Script S2 probado sobre una copia restaurada | **Aprobado** (13/13) |
| 5 | Producción coincide con el inventario antes de ejecutar | **Aprobado** |
| 6 | Ejecución de la limpieza en producción | **Aprobado** (9 nov, 05:21:50 UTC, tras la confirmación del usuario) |
| 7 | 0 productos, variantes, ventas, detalles, movimientos e imágenes; 4 categorías; 5 medios de pago; 1 CEO; `audit_log` íntegro; 8 triggers; RLS en 11 tablas | **Aprobado en producción** (verificado por consulta después de ejecutar) |
| 8 | Archivos de Storage eliminados | **Pendiente por acceso**: siguen los 2 archivos; falta tu sesión en el panel de Supabase |
| 9 | Catálogo público, autenticación, panel y Dashboard con cero ventas tras la limpieza | **Aprobado parcialmente**: catálogo público y rechazos anónimos verificados; panel y Dashboard **no verificados** (necesitan la sesión del usuario) |
| 10 | Documentación conciliada | **Aprobado** |
| 11 | Sin secretos en el repositorio | **Aprobado** |
| 12 | Gerente y empleado | **Pendiente por decisión** |
| 13 | Prueba física del POS | **Pendiente por acceso** |
| 14 | CI y Vercel con los cambios de la Etapa 0 | **Pendiente por acceso** (push) |

## 14. Conclusión

**La Etapa 0 NO está cerrada todavía; falta una condición concreta y pequeña.** La limpieza S2 **se ejecutó en producción** y quedó verificada (0 productos, ventas y movimientos; categorías, medios de pago, CEO y las 111 filas originales del `audit_log` idénticos; 8 triggers y RLS intactos; estructura idéntica). Para cerrarla falta:

1. **Borrar los dos archivos de Storage** (foto de Juego de Cuchillos y el huérfano de `categories/`): necesita una **sesión con permisos en el panel de Supabase**. El navegador integrado quedó en la pantalla de ingreso; con tu sesión iniciada allí, Claude los borra sin tocar tus credenciales. Ambos están respaldados.
2. **Verificar con tu sesión** el acceso al panel y que el Dashboard muestre cero ventas (Claude no tiene sesión propia y no se declara aprobado sin ejecutarlo).

Los puntos de §10 (gerente y empleado, prueba física del POS, CI y Vercel, cachés externas) dependen de acceso o de decisiones tuyas y están documentados sin bloquear el cierre técnico. **Atención:** hasta el `push` y el despliegue, el sitio publicado no incluye los cambios de la Etapa 0 (R1).
