# Estado del proyecto

**Fecha de corte: 8 de noviembre de 2026 (cierre del Bloque 0 de la fase 0.6).** Es la única fuente del estado actual. Cuando algo cambie, se corrige acá primero. Solo se afirma lo confirmado; lo demás figura como pendiente.

## 1. Git

| Rama | Estado |
| --- | --- |
| `main` | **Estado actual (8 de noviembre de 2026): en `4c4bbd6`, local, 2 commits por delante de `origin/main`** (que sigue en `de4b9c2`). Se llegó con un merge local de avance directo desde `etapa-0-estabilizacion`. **Sin push ni despliegue.** *(Histórico: hasta el Bloque 0 `main` estaba en `de4b9c2`, igual que `origin/main`, y no se había tocado.)* |
| `etapa-0-estabilizacion` | Solo en local, en el mismo commit que `main` (`4c4bbd6`). Contiene `bdcdd6d` (`chore: consolidate stage 0 stabilization`, toda la Etapa 0, fases 0.1 a 0.5) y `4c4bbd6` (`docs: reconcile stage 0 block 1 with production`). *(Histórico: el Bloque 0 la dejaba como rama actual, «sin merge».)* El árbol de trabajo está hoy en `main`. |
| Cambios sin commit | Documentación del Bloque 2 y de la conciliación (informes, protocolo, correcciones de este documento y de otros), y `supabase/queries/bloque-2-solo-lectura.sql`. **Ningún cambio de código ni migraciones.** |
| Respaldo previo al commit | `C:\Users\lauty\Respaldos-AImpulse\mundo-del-plastico_etapa-0_respaldo_2026-11-08.tar.gz` (fuera del repositorio y de OneDrive), con su `.sha256` y su manifiesto. |
| Sin versionar a propósito | `Logos de categorias/` y `Logo/` (recursos de marca pesados, respaldados), `.impeccable/` (salidas de una herramienta de diseño), `docs/capturas/` (capturas que podrían mostrar material de prueba o datos personales; la documentación que las cita queda con esos enlaces rotos hasta decidir). |

Repositorio remoto: `https://github.com/LPoclava/El-Mundo-Del-PLasticoco-Catalogo-.git` (privado). Desde este commit **`docs/` y `supabase/` sí se versionan** (migraciones, pruebas, semilla de prueba y correcciones de datos); se quitaron de `.gitignore`. Siguen fuera `supabase/tests/node_modules`, `.env.local` y los scripts sueltos que no son pruebas.

## 1 bis. Estado de las fases de la Etapa 0

| Fase | Estado real |
| --- | --- |
| 0.1 Auditoría inicial | Hecha |
| 0.2 Panel real | Hecha en código y pruebas: ingreso único con Supabase Auth, CRM, Configuración y demostración retirados. **Sin validar con cuentas reales de cada rol** |
| 0.3 Infraestructura | Cabeceras, CSP, SEO y CI implementados y probados en local. **La CI nunca corrió en GitHub; Vercel sin verificar; escáner con cámara sin probar bajo la CSP** |
| 0.4 Validación operativa | Circuito de venta auditado y probado; H1 corregido en código. **No cerrada:** falta proyecto de Supabase de prueba, prueba física, impresión real y corte de red real |
| 0.5 Material comercial | Auditoría hecha. **C1 resuelto en la fuente** (cachés externas sin verificar). **C2: el logo fue retirado del origen por el usuario** (producto despublicado, foto inexistente; verificado de nuevo el 8 de noviembre, HTTP 400); copias externas sin verificar |
| 0.6 Validación integral | **En curso.** Bloque 0 (respaldo, revisión y commit local) hecho; **Bloque 1 (conciliación con producción) hecho de forma parcial**, ver `informe-bloque-1-conciliacion.md`; **Bloque 2 (roles y RLS) parcial y NO aprobado**: pruebas anónimas y diagnóstico de la base hechos (§2 ter); **sesión del CEO (S1 a S11) informada como correcta por el usuario el 9 de noviembre de 2026**, sin cifras en varios pasos; faltan las pruebas de gerente y empleado (no existen las cuentas) y las de escritura; quedan los bloques siguientes |

## 2. Migraciones de Supabase

**Confirmado por el usuario el 4 de noviembre de 2026: todas las migraciones de `supabase/migrations/` están aplicadas en la base de producción.** La confirmación es de palabra; no hay un registro técnico en este repositorio. **El 8 de noviembre de 2026 se comprobó en solo lectura, con la clave pública, que las tres últimas se ven en producción:** `public_promo_banners` devuelve `image_mobile_path` (20261103), `public_product_images` y `public_product_variants` responden 200 (20261102) y `low_stock_variants` existe y rechaza sin sesión (20261101). Para comprobarlo en cualquier momento: `select version from supabase_migrations.schema_migrations order by version;` en el SQL Editor.

**Actualización del 8 de noviembre de 2026 (diagnóstico del Bloque 2 con el conector de Supabase, solo lectura):** la consulta anterior **no funciona en este proyecto**. `list_migrations` devolvió **cero registros** y `supabase_migrations.schema_migrations` **no existe** (error `42P01`); solo existen las tablas internas de Supabase (`auth.schema_migrations`, `realtime.schema_migrations`, `storage.migrations`). Las migraciones se aplicaron pegándolas en el SQL Editor y **no hay historial de versiones verificable**. Lo que sí se comprobó es que **los objetos de las 19 migraciones están presentes** (tablas, vistas, funciones, columnas, triggers y políticas; detalle en [informe-bloque-2-diagnostico-conector.md](informe-bloque-2-diagnostico-conector.md) §4). Eso confirma la **existencia** de lo que crea cada migración, no su versión ni el orden en que se aplicó.

**Cierre `close_drop_staff`: YA ESTÁ APLICADO en producción (hallazgo del 8 de noviembre de 2026).** `public.staff`, `public.staff_legacy` y `public.is_staff()` **no existen**. Esta línea corrige afirmaciones anteriores de este documento y de `autorizacion-roles.md` que lo daban por pendiente. **Quién lo aplicó y cuándo: desconocidos** (sin registro). Consecuencia: el script `supabase/rollback/20261029_rollback_roles.sql` **ya no puede ejecutarse** (se niega sin `staff_legacy`); la única reversión posible es una copia de seguridad.

| Migración | Contenido | Documento |
| --- | --- | --- |
| `20261028000001` a `…005` | Modelo original: extensiones, `staff`, categorías, productos, variantes, fotos, RLS, vistas públicas, bucket `product-images` | [modelo-de-datos.md](modelo-de-datos.md) |
| `20261029000001` a `…008` | Roles `empleado/gerente/ceo`, perfiles, auditoría, archivado de productos, funciones `scan_*` | [autorizacion-roles.md](autorizacion-roles.md) |
| `20261030000001` | Subcategorías, cuatro categorías principales, `promo_banners` y su vista pública | [promociones-y-banners.md](promociones-y-banners.md) |
| `20261031000001` | `product_variants.stock`, medios de pago, `sales`, `sale_items`, `stock_movements`, `pos_find`, `confirm_sale`, `adjust_stock` | [pos-ventas.md](pos-ventas.md) |
| `20261101000001` | Movimientos de stock con `stock_before` y tipo «entrada»; alta rápida de productos incompletos desde el escáner; resúmenes para el Inicio del panel; administración de las categorías principales. Reemplaza funciones propias de las migraciones 20261030 y 20261031 | Solo en el SQL (cabecera del archivo) |
| `20261102000001` | Vistas públicas `public_product_images` y `public_product_variants` para la ficha de producto. No expone stock, SKU ni código de barras | Solo en el SQL |
| `20261103000001` | `promo_banners.image_mobile_path`: arte para celular, opcional. Redefine `public_promo_banners` | [promociones-y-banners.md](promociones-y-banners.md) |

**`20261108000001_admin_list_users.sql` — APLICADA en producción, por confirmación del responsable (8 de noviembre de 2026). No se vuelve a aplicar.** Agrega `admin_list_users()` (solo CEO activo; correo, rol, estado y fechas de todas las cuentas de Auth, con o sin perfil). Auditada y probada con 19 pruebas en PGlite (`supabase/tests/admin-users.test.mjs`). Lo que está confirmado y lo que no:

| Punto | Estado |
| --- | --- |
| La función existe en producción | **Sí** (consulta pública en solo lectura: rechaza con «no autorizado» en vez de «no existe») y el responsable confirmó haberla aplicado |
| Quién y cuándo la aplicó | Sin registro técnico en el repositorio (confirmación de palabra) |
| Que exista **no equivale a que esté validada** | La pantalla Usuarios **no se probó con una cuenta CEO real** |
| Validación de roles reales (empleado, gerente, CEO) | **Pendiente** (`protocolo-validacion-cuentas.md`) |

Fuera de `migrations/` a propósito:

| Archivo | Estado |
| --- | --- |
| `supabase/pending/20261029000099_close_drop_staff.sql` | ~~No aplicar todavía~~ (texto anterior al 8 de noviembre). **YA APLICADO en producción** (comprobado el 8 de noviembre de 2026: `staff`, `staff_legacy` e `is_staff()` no existen). Operador y fecha: **desconocidos**. El archivo se conserva en `pending/` como registro. No volver a aplicarlo (fallaría: `staff_legacy` ya no existe). |
| `supabase/correcciones/20261103_catalogo_datos.sql` | Correcciones de **datos** (no es esquema). **Aplicadas** (comprobado en solo lectura el 8 de noviembre de 2026 en las vistas públicas: banners con `/?q=termos` y `/#catalogo`, Juego de Cuchillos en `cocina`, Bolsas de residuos en `bano`, «Palitos» con mayúscula). Contenía: banner Stanley a `/?q=termos`, banner general a `/#catalogo`, Juego de Cuchillos a Cocina, Bolsas de residuos a Limpieza, nombre «Palitos». También se puede hacer desde el panel. |
| `supabase/rollback/` | Reversión del catálogo y de los roles. No son migraciones. |
| `supabase/queries/categorias-sin-clasificar.sql` | Solo lectura: productos fuera de las cuatro categorías principales. |
| `supabase/tests/` | Pruebas de la base sobre PGlite y `concurrency.mjs` sobre un PostgreSQL temporal. |

## 2 ter. Estado verificado de la base de producción (diagnóstico con el conector, 8 de noviembre de 2026, solo lectura)

Detalle y consultas: [informe-bloque-2-diagnostico-conector.md](informe-bloque-2-diagnostico-conector.md). No se modificó ningún dato.

| Elemento | Resultado observado |
| --- | --- |
| Proyecto | `nogufedcmkjphiqyyriz`, «El Mundo del PLastico», PostgreSQL 17, región `us-east-2`; es **producción** |
| `public.staff`, `public.staff_legacy`, `public.is_staff()` | **No existen** (cierre aplicado; operador y fecha desconocidos) |
| Historial de migraciones | `list_migrations` sin registros; `supabase_migrations.schema_migrations` no existe. Objetos de las 19 migraciones presentes; **sin historial de versiones verificable** |
| Cuentas | **Una sola cuenta de Auth: CEO activo con perfil.** Sin cuentas sin perfil. **No hay cuentas de gerente ni de empleado** |
| RLS | Activa en las 11 tablas de `public` (`audit_log`, `categories`, `payment_methods`, `product_images`, `product_variants`, `products`, `profiles`, `promo_banners`, `sale_items`, `sales`, `stock_movements`) |
| Políticas | 22 políticas en `public`, todas para `authenticated`. Ninguna depende de `is_staff`. **No hay políticas de escritura** sobre `profiles`, `sales`, `sale_items`, `stock_movements` ni `audit_log` (se escriben solo con funciones) |
| Funciones | Todas con `search_path` fijo; **0** `security definer` sin él. Las 13 críticas (`admin_*`, `scan_*`, `pos_find`, `confirm_sale`, `adjust_stock`, `receive_stock`, `low_stock_variants`, `sales_summary`, `current_app_role`, `has_role_at_least`, `can_manage_stock`) no las ejecuta `anon`. `sale_receipt` y las internas no las ejecuta ni `authenticated` |
| Funciones ejecutables por `anon` | 7: seis de disparador (`audit_log_immutable`, `enforce_category_depth`, `enforce_max_images`, `ledger_no_change`, `promo_banners_stamp`, `set_updated_at`) y `f_unaccent`. Riesgo bajo: no son invocables como RPC ni exponen datos |
| Triggers | Habilitados: protección de perfiles, auditoría en 5 tablas, libro inmutable (`sales`, `sale_items`, `stock_movements`, `audit_log`), límites de imágenes y de profundidad de categorías |
| Storage | Bucket `product-images` público; 8 políticas (4 «gerente … fotos» y 4 «gerente … imagenes del sitio»); sin las «personal …» |

**Pendientes que siguen abiertos:** las pruebas autenticadas de **gerente y empleado** (no existen las cuentas; crearlas no está autorizado) y los casos de escritura, que necesitan un entorno aislado. **La sesión del CEO fue ejecutada por el usuario** (S1 a S11, informada el 9 de noviembre de 2026; detalle en `informe-bloque-b-validacion-funcional.md` §8). **Dato nuevo:** la única cuenta con acceso es la **cuenta de AImpulse de prueba y desarrollo**; producción no tiene hoy ninguna cuenta operativa real. Las 5 ventas históricas (30 de octubre a 5 de noviembre de 2026) las hizo esa única cuenta. **Confirmado por el usuario el 9 de noviembre de 2026: las 5 ventas son de prueba.** Quedan en el historial de solo agregado (no se pueden anular) junto con 10 movimientos de stock; ver `informe-bloque-b-validacion-funcional.md` §9.

## 2 quater. Limpieza de datos de prueba (alcance S2): **EJECUTADA en producción el 9 de noviembre de 2026, 05:21:50 UTC**; pendiente el borrado de 2 archivos de Storage

El usuario confirmó que **todos los datos de producción son de prueba** y autorizó el alcance **S2**: eliminar los 10 productos con sus variantes, las 5 ventas, sus 5 detalles y los 10 movimientos de stock, y respaldar y eliminar los 2 archivos de Storage. Se conservan categorías (4), medios de pago (5), la cuenta CEO, la estructura, las políticas y **todo el `audit_log`**. Detalle: [plan-limpieza-produccion.md](plan-limpieza-produccion.md), [registro-respaldo-limpieza.md](registro-respaldo-limpieza.md) e [informe-final-etapa-0.md](informe-final-etapa-0.md) (el informe final de la etapa).

| Paso | Estado |
| --- | --- |
| Respaldo | **Hecho y verificado:** `C:\Users\lauty\Respaldos-AImpulse\mundo-del-plastico_limpieza_respaldo_2026-11-09.tar.gz`, SHA-256 `f8fedd8b…3880`. Es una **copia lógica** por el conector (el entorno no tiene `pg_dump` ni la contraseña de la base); restaurada en una base temporal da **11/11 tablas y 13/13 categorías de estructura idénticas** a producción |
| Simulacro | **Aprobado** sobre la copia restaurada (**13 de 13** comprobaciones, con la versión final del script): libro y catálogo en 0, categorías, medios de pago y perfil idénticos, `audit_log` íntegro (111 filas originales idénticas más 22 nuevas), 8 triggers habilitados, estructura idéntica, recuperación desde el respaldo externo probada |
| Versión final del script | Por instrucción del 9 de noviembre: **no crea esquemas ni tablas de respaldo en producción** y **no reinicia las secuencias** (la próxima venta será la n.º 6 y el próximo movimiento el id 11). La recuperación sale del respaldo externo (`supabase/limpieza/generar_restauracion.mjs`) |
| Ejecución en producción | **EJECUTADA** (una transacción, `commit`) tras la confirmación explícita del usuario. **Verificado después por consulta:** 0 productos, variantes, fotos, ventas, detalles y movimientos; 4 categorías, 5 medios de pago y 1 CEO con la misma huella; `audit_log` con las 111 filas originales idénticas más 22 nuevas (incluida la constancia con el SHA-256 del respaldo); 8 triggers de protección habilitados; RLS en 11 tablas; estructura con las mismas huellas; secuencias sin reiniciar (próxima venta n.º 6, próximo movimiento id 11); catálogo público con 0 filas y tablas protegidas con 401 |
| Storage | **PENDIENTE (los 2 archivos siguen en el bucket).** **Bloqueo:** `storage.objects` tiene `protect_objects_delete`; los 2 archivos se borran solo con la API o el panel de Supabase con una sesión con permisos. Respaldados |
| Excepción a «solo agregado» | **Autorizada por el usuario** para este único borrado, dentro de la transacción estrictamente necesaria; los 3 triggers `*_no_change` quedan habilitados antes del `commit` |

## 3. Panel (`/panel`)

**Etapa 0, fase 0.2 (rama local `etapa-0-estabilizacion`, sin subir a GitHub ni desplegar): el panel tiene un único ingreso real con Supabase Auth y ya no existe ningún modo demostración.** El rol sale de `public.profiles` y define el menú; la base lo exige con RLS y funciones. El código está probado con pruebas automáticas y local; **no se probó contra el Supabase real con una cuenta de cada rol** (pendiente, ver §4). *(Hoy esa rama está integrada en `main` local, sin subir; ver §1.)*

| Sección | Estado | Fuente |
| --- | --- | --- |
| Inicio | Real: resúmenes de ventas y stock | `home-section.tsx`, `lib/pos/dashboard.ts` |
| Productos | Real | `products-section.tsx`, `lib/products/admin.ts` |
| Categorías | Real | `categories-section.tsx`, `lib/categories/admin.ts` |
| Banners promocionales | Real, gerente o superior | `banners-section.tsx`, `lib/banners/` |
| Stock | Real | `stock-section.tsx`, `lib/pos/` |
| Escáner y ventas (`/panel/precios`) | Real | `scanner-section.tsx`, `pos/pos-section.tsx` |
| Usuarios (solo CEO) | Código real: lista, rol, estado, nombre y «dar acceso». La migración `20261108000001_admin_list_users` **está aplicada** (confirmación del responsable). **Sin probar con una cuenta CEO real**: la validación de roles reales sigue pendiente | `users-section.tsx`, `lib/users/` |
| CRM | **Retirado** (no tenía tablas ni funciones reales; el código de demostración se borró) | — |
| Configuración | **Retirada** (igual) | — |

## 2 bis. Bitácora de operaciones manuales (cambios hechos fuera del código)

Registradas en el Bloque 1 de la fase 0.6 (8 de noviembre de 2026). **Las fechas y horas exactas no constan y no se inventan**; «noviembre de 2026» es la referencia segura. Detalle, evidencia y discrepancias: [informe-bloque-1-conciliacion.md](informe-bloque-1-conciliacion.md) §A y §D.

| # | Operación | Autor | Cuándo |
| --- | --- | --- | --- |
| 1 | Aplicar la migración `20261108000001_admin_list_users` | Usuario (confirmado de palabra) | Noviembre de 2026; sin hora exacta |
| 2 | Despublicar Termos, Mermelada, Palitos y Bolsas | Usuario (confirmado de palabra) | Noviembre de 2026; ya hecho al abrir la fase 0.6 |
| 3 | Eliminar de Storage las cuatro fotos de esos productos | Usuario (confirmado de palabra) | Igual |
| 4 | Cerrar el registro público de Auth | **Sin autor conocido** (observado el 8 de noviembre) | Antes del 8 de noviembre de 2026, noche |
| 5 | Aplicar el cierre `close_drop_staff` (eliminar `staff_legacy` e `is_staff()`) | **Desconocido** (no se atribuye a nadie) | **Desconocida** (observado el 8 de noviembre de 2026; sin registro) |
| 6 | Limpieza S2 de los datos de prueba (productos, ventas y movimientos) | Claude Code, con la confirmación explícita del usuario | **9 de noviembre de 2026, 05:21:50 UTC** (fila de constancia en el `audit_log`) |

**Motivo operativo (dicho por el usuario):** el flujo de eliminación ejecutado mediante Claude Code tardaba unos cinco minutos por producto. Es una incidencia de rendimiento **sin medir**; ver el informe §F. **Rectificación de C1 (noviembre de 2026):** un registro anterior atribuía a Claude Code la baja de Bolsas (despublicar y quitar su foto). Era incorrecto: la hizo **manualmente el usuario** (fecha noviembre de 2026; hora no confirmada), igual que las de Termos, Mermelada y Palitos. Ver `auditoria-material-comercial-fase-0-5.md` §0.5.

## 3 bis. Infraestructura (Etapa 0, fase 0.3: rama local, sin subir ni desplegar)

Detalle, verificaciones y pasos manuales: [despliegue.md](despliegue.md).

| Pieza | Estado |
| --- | --- |
| Cabeceras de seguridad y CSP (`next.config.ts`) | Implementadas y verificadas en un servidor de producción local (catálogo, ficha, login). **No desplegadas.** El escáner con cámara no se pudo probar en vivo bajo la CSP |
| `robots.txt` y `sitemap.xml` | Implementados y verificados localmente con un dominio de prueba |
| Canonical y Open Graph | Ya existían; solo se publican con dominio configurado. Verificados localmente |
| `NEXT_PUBLIC_SITE_URL` | **Sin confirmar en Vercel** (pendiente manual) |
| IP de desarrollo | Pasó a la variable `ALLOWED_DEV_ORIGINS` (`.env.local`); ya no hay IP fija en el código |
| CI (`.github/workflows/ci.yml`) | Creada y validada como YAML; cada paso corrido localmente. **Nunca corrió en GitHub** |
| Sesión del panel al volver a la pestaña | Se reevalúa; una cuenta desactivada vuelve al ingreso. Probada con pruebas de código; no con cuentas reales |
| Vercel | **No verificado** (sin acceso) |

## 3 ter. Circuito de venta (Etapa 0, fase 0.4: rama local)

Auditoría completa en [auditoria-pos-fase-0-4.md](auditoria-pos-fase-0-4.md).

| Pieza | Estado |
| --- | --- |
| Atomicidad de `confirm_sale` | Verificada: fallos inyectados en 4 puntos (PGlite) y 7 pruebas de concurrencia con un PostgreSQL real temporal local. Sin defectos en la base |
| Controles de stock y consistencia (libro) | Verificados por pruebas; el stock siempre cierra con sus movimientos |
| Permisos por rol, cuenta desactivada y sesión sin usuario | Verificados en la base por pruebas (7 operaciones × 3 roles). La expiración del token la controla PostgREST y no se puede probar en PGlite |
| Comprobante interno | Corregido: identifica al negocio, aclara que no es factura ni comprobante fiscal y no imprime el stock restante. **No existe emisión fiscal** y no se simula. Impresión en papel real sin verificar |
| Hallazgo H1 (posible venta duplicada tras un corte de red si se edita o recarga antes de reintentar) | **Corregido** (rama local, sin desplegar): [recuperacion-de-ventas-pendientes.md](recuperacion-de-ventas-pendientes.md). La pantalla nueva no se probó con un navegador y una red reales |
| Anulación o devolución de ventas | No existe (el historial es de solo agregado); decisión del negocio pendiente |
| Proyecto de Supabase de prueba | **No existe todavía**; requisitos y semilla listos (`proyecto-supabase-de-prueba.md`, `supabase/seed-prueba/`) |
| Prueba física del POS | **Pendiente**: protocolo listo (`protocolo-prueba-fisica-pos.md`); requiere al responsable |

## 3 quater. Material comercial (Etapa 0, fase 0.5: auditoría y corrección C1)

Detalle: [auditoria-material-comercial-fase-0-5.md](auditoria-material-comercial-fase-0-5.md). **Criterio corregido el 8 de noviembre de 2026: los productos y fotos que hoy aparecen en el catálogo son MATERIAL DE PRUEBA** (0 productos reales confirmados; los no publicados, desconocidos). **Los productos y las fotos que quedan NO son el catálogo definitivo.** No se mejora ni se reemplaza material de prueba. Solo se ejecutó C1.

| Pieza | Estado |
| --- | --- |
| Foto de «Bolsas de residuos» | **C1 RESUELTO EN LA FUENTE (verificado el 8 de noviembre; la operación la hizo manualmente el usuario en noviembre de 2026, hora no confirmada; rectificación en §2 bis):** el producto se despublicó y se quitó su única foto (el archivo ya no existe en el almacenamiento; la URL anterior responde 400). El producto, su variante y su precio se conservan. **La caché local de imágenes de esta computadora (`.next/cache/images`, 78 archivos) se borró** con autorización del responsable. **NO se afirma que las copias externas estén eliminadas:** WhatsApp, buscadores, la caché de imágenes del sitio publicado en Vercel y cualquier copia guardada por terceros no se pueden verificar ni borrar desde acá. Detalle: `auditoria-material-comercial-fase-0-5.md` §0.5 |
| Foto de «Termos 700ml» (C2) | Era el logo de AImpulse (incongruencia de material de prueba). **Al abrir la fase 0.6 (8 de noviembre) el archivo ya no existía en el almacenamiento y el producto estaba despublicado**: no se muestra públicamente. **Actualización del 8 de noviembre (Bloque 1): el usuario confirma que despublicó los productos y borró las fotos a mano**; la fecha y hora exactas no constan. C2 queda como **retirada del origen por el usuario**; no se afirma que se hayan eliminado copias externas ni la caché del sitio publicado. No se prepara foto; el procedimiento de reemplazo sigue documentado (§0.6). No debe llegar al catálogo definitivo |
| Fotos y datos de los productos restantes | Material de prueba (no es el catálogo definitivo): no se corrige. Se evaluarán con material real (productos reales, nombres y marcas confirmados, fotos de cada producto y precios autorizados) |
| Banners | **0 vigentes** hoy (había 2 hace horas); confirmar si fue intencional. Sin arte para celular |
| Marca | Coherente con la guía (colores exactos) |
| Catálogo público | **Al abrir la fase 0.6 solo 1 producto publicado** («Juego de Cuchillos», material de prueba); Termos, Mermelada, Palitos y Bolsas estaban despublicados y sus archivos de foto ya no existían (cambios hechos fuera de esta intervención, sin registro de quién ni cuándo). **Confirmar si el sitio ya es visible para clientes**. Propuesta (con aprobación): llevar el material de prueba al proyecto de Supabase de prueba y dejar producción solo con material real |

## 4. Qué no se verificó nunca

- Una **venta real** de punta a punta contra el Supabase de producción. *(Aclaración del 9 de noviembre de 2026: en producción hay 5 ventas, pero son todas de prueba, confirmado por el usuario; ninguna es una venta real.)*
- La persistencia de productos y fotos contra Supabase real, y las políticas de Storage en producción.
- Un **celular físico**, Safari, un lector de códigos físico y un lector de pantalla real.
- Tiempos en Vercel (se midió con servidor local).
- ~~El estado del **registro público de Auth** en Supabase: la última evidencia decía abierto.~~ **Actualización del 8 de noviembre de 2026 (Bloque 1):** observado en solo lectura, el registro público está **cerrado** (solo proveedor de correo, sin autoconfirmar). **No consta quién lo cerró ni cuándo.** Falta confirmarlo en el panel de Supabase.
- La subida del arte móvil de un banner con sesión real.
- El **ingreso real del panel** con una cuenta de cada rol (empleado, gerente, CEO): menú, redirecciones, cierre de sesión y la pantalla de Usuarios contra el Supabase real, que depende de la migración `20261108000001` (aplicada, pero nunca probada con una cuenta CEO real). Protocolo preparado: `protocolo-validacion-cuentas.md` (lo ejecuta el responsable).
- El **escáner con cámara bajo la CSP nueva**, en un celular real y con una vista previa desplegada.
- La **primera ejecución de la CI en GitHub** y el **despliegue en Vercel** con las cabeceras nuevas.
- El **punto de venta con una cuenta de empleado real** y una venta de prueba: pendiente de la presencia y la autorización del responsable (las ventas no se pueden anular).

## 5. Pendientes abiertos

**Del usuario o del negocio**

1. ~~Correcciones de datos de `supabase/correcciones/`~~: hechas (verificado el 8 de noviembre de 2026). Ya no queda ningún P1 abierto.
2. Arte de banners para celular: 1200 × 900 px, cargado desde el panel.
3. Configurar `NEXT_PUBLIC_SITE_URL` en Vercel con el dominio real. Estado actual de Vercel: sin confirmar.
4. Cargar stock inicial de cada variante (sin stock, nada es vendible) y crear las cuentas de empleados.
5. Fotos reales de los productos.
6. Confirmar barrio, manzana, lote y horario del local, que salen de un volante. Aclarar si hay retiro o envío.
7. «Bolsas de residuos»: el nombre dice 80x90 y la variante 20x23.
8. Instagram: sin cuenta no se muestra el botón (`CONTACT.instagramUrl`).
9. Logos de pago: Visa, Mastercard y Naranja X vienen de Wikimedia Commons; reemplazar por el kit de marca si el adquirente lo entrega.
10. Librería no tiene productos publicados: su boleto y su opción de menú aparecen solos al publicar uno.

**Técnicos**

1. ~~Aplicar `close_drop_staff` tras un período de uso, con aprobación.~~ **Ya está aplicado** (hallazgo del 8 de noviembre de 2026; operador y fecha desconocidos). Pendiente: averiguar quién y cuándo lo aplicó y anotarlo en la bitácora.
2. Definir la retención de `audit_log`, que crece sin límite.
3. Opcional: `set_primary_image(product_id, image_id)` para que el cambio de foto principal sea atómico.
4. No implementado: precios promocionales y combos (hay un diseño mínimo sugerido en `promociones-y-banners.md`).
5. Opcional: banner más apaisado que 2:1 exige ampliar la regla de banners del panel.
6. CRM y Configuración se retiraron del panel; si el negocio los necesita hay que diseñarlos con sus tablas desde cero.
8. ~~Hallazgo H1~~: corregido. Quedan los riesgos R1 a R7 de `recuperacion-de-ventas-pendientes.md` §5 (por ejemplo, probar la pantalla con un corte de red real y decidir si la base debe rechazar «misma clave con otro contenido»).
9. Decidir cómo se corrige una venta equivocada (hoy no hay anulación ni devolución).
10. Crear el proyecto de Supabase de prueba y correr la prueba física (`proyecto-supabase-de-prueba.md`, `protocolo-prueba-fisica-pos.md`).
11. **C1 (fase 0.5):** resuelto en la fuente y en la caché local; **sin verificar** las copias externas ni la caché del sitio publicado (decidir si se vacía desde Vercel). El material de prueba restante no se toca; el definitivo se arma con material real (`auditoria-material-comercial-fase-0-5.md` §0).
12. **Fase 0.4, todavía NO cerrada:** proyecto de Supabase de prueba, validación física del punto de venta, prueba real de impresión, prueba de recuperación con cortes de red reales y riesgos residuales de H1.
7. ~~Aplicar `20261108000001_admin_list_users`~~: aplicada (confirmación del responsable). **Falta probar el ingreso real con una cuenta de cada rol**, incluida la pantalla Usuarios con un CEO real.
7. Pendientes menores de diseño: ver `historico/informe-intervencion-final.md`, sección final.

## 6. Datos del negocio confirmados

- Localidad: **Río Turbio, Santa Cruz** (confirmada el 2 de noviembre de 2026).
- El volante trae un teléfono fijo (425111) que **no se muestra**; el sitio usa el número ya configurado en `src/config/contact.ts`.

## 7. Etapa 1, fase 1 (migraciones, solo en local)

Tres migraciones nuevas, **sin aplicar en Supabase** (las aplica el responsable a mano, en orden):

- `20261109000001_payment_method_qr_and_reports.sql`: método de pago **QR** (registro manual, sin integración de cobros) y las funciones de lectura `sales_by_payment_method` y `sales_monthly_by_payment_method` (mes en hora de Río Turbio; empleado ve sus ventas, gerente y CEO todas).
- `20261109000002_developer_access.sql`: tabla `developer_access` (sin acceso por la API; alta y baja solo desde el SQL Editor), `is_developer()` y `require_developer()`. El CEO del comercio **no** es de desarrollo.
- `20261109000003_fiscal_structure.sql`: estructura **preparada** del circuito fiscal (ARCA): `fiscal_settings` (producción apagada por defecto), `fiscal_documents`, `fiscal_events` (solo agregado) y las funciones `fiscal_request_issue`, `fiscal_transition`, `fiscal_log_event`. Todo exige acceso de desarrollo en la base. No emite nada, no hay disparadores sobre ventas y no se guardan credenciales. «Anulado» no se implementa (no hay circuito real que lo respalde).

Pruebas: `supabase/tests/etapa1-fase1.test.mjs` (11). Se ajustó una prueba de `pos-ventas` que insertaba un método `qr` propio (ahora existe de fábrica).

## 8. Etapa 1, fase 2 (escáner, modo venta y comprobante interno)

- **Escáner:** el resultado muestra el estado del producto (disponible, sin stock, sin precio, incompleto, archivado) y tres acciones con color propio: «Registrar venta» (naranja), «Actualizar stock» (verde, gerente o superior; abre `/panel/stock?codigo=…` con el producto ya identificado) y «Registrar / Completar producto» (amarillo). Lógica en `src/lib/pos/scan-actions.ts`.
- **Modo venta:** se entra con «Registrar venta»; mientras está activo solo se agrega al carrito (un producto de una sola variante vendible se agrega solo al escanear) y no se ofrecen registrar producto ni stock. «Cancelar venta» pide confirmación si hay algo armado y no registra nada. «Salir del modo venta» conserva el carrito.
- **Comprobante interno** (`src/components/panel/pos/receipt-view.tsx`): logo, nombre, dirección y localidad del comercio, número y fecha, quién atendió, medio de pago, tabla con producto/variante, cantidad, precio unitario y subtotal, total y la leyenda «Comprobante interno de operación. No es una factura ni un comprobante fiscal.». Imprimir y «Guardar como PDF» son los del navegador (el nombre de archivo sugerido es «Comprobante interno 000042»). Se reabre desde «Ver comprobante» en el detalle de cada venta. El stock restante y los códigos de barras no se incluyen.
- **Teléfono del comercio:** no se imprime (el único dato cargado es el de WhatsApp, y no se confirmó que sea el que se quiere en el comprobante).
- **`tsconfig.json`:** `allowImportingTsExtensions` es necesario solo porque `scan-actions.ts` importa `./sellable.ts` en tiempo de ejecución para poder probarse con `node --test`; sin la opción, `tsc` da TS5097. No afecta nada más (`noEmit` ya estaba activo y `next build` pasa).
- **Sin verificar en pantalla:** el modo venta, el comprobante y su impresión requieren una sesión del panel (ver informe de la fase).
