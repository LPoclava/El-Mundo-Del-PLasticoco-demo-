# Bloque 2: diagnóstico de la estructura de producción con el conector de Supabase

Fecha: 8 de noviembre de 2026. Proyecto: `nogufedcmkjphiqyyriz`. **Solo lectura.** Se usó el conector de Supabase del entorno con cuatro herramientas de consulta (`get_project`, `list_migrations`, `execute_sql` con `SELECT`). **No se modificó ningún dato de producción**: no hubo `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `CREATE`, migraciones ni funciones que escriban; no se crearon usuarios ni se tocaron perfiles, productos, categorías, stock, ventas o imágenes; no hubo commit, push ni deploy. Los resultados no incluyen correos, contraseñas ni tokens (el identificador de la única cuenta se muestra abreviado).

## 1. Conexión

| Consulta | Resultado | Interpretación | Estado |
| --- | --- | --- | --- |
| `get_project('nogufedcmkjphiqyyriz')` | Nombre «El Mundo del PLastico», región `us-east-2`, `ACTIVE_HEALTHY`, PostgreSQL 17, creado el 27 de octubre de 2026 | Es el proyecto indicado y es el de **producción** (el mismo de `.env`) | **Confirmado** |

## 2. Consultas pedidas

| Consulta | Resultado | Interpretación técnica | Estado | Impacto en la aplicación | Próximo paso |
| --- | --- | --- | --- | --- | --- |
| **Q1** `to_regclass('public.staff')`, `to_regclass('public.staff_legacy')`, `to_regprocedure('public.is_staff()')` | **Los tres devuelven vacío** | La tabla `staff`, la tabla `staff_legacy` y la función `is_staff()` **no existen**. Es exactamente lo que haría `supabase/pending/20261029000099_close_drop_staff.sql`: **el cierre ya está aplicado** (o un equivalente) | **Inconsistente con la documentación** (`estado.md` y `autorizacion-roles.md` dicen «no aplicar todavía» y que `staff_legacy` existe) | Ninguno funcional: ninguna política ni función depende de `is_staff` (ver §3). Pero el script de reversión de roles **ya no sirve** (se niega a correr sin `staff_legacy`): solo queda restaurar una copia de seguridad | Preguntar quién y cuándo lo aplicó; corregir la documentación; decidir si el entorno de prueba debe incluir el cierre |
| **Q2** `select version, name from supabase_migrations.schema_migrations` | **Error `42P01`: la relación `supabase_migrations.schema_migrations` no existe** | No es incompatibilidad del conector: el proyecto **no tiene** ese esquema. Las migraciones se aplicaron pegándolas en el SQL Editor y no quedó registro de versiones | **Pendiente / no verificable por versión** | Ninguno funcional; sí pierde trazabilidad (no se puede probar qué versión está aplicada) | Verificar por objetos (§4); decidir si se quiere un registro de versiones en adelante |
| `list_migrations` (herramienta del conector) | `{"migrations": []}` | Coincide con Q2: no hay historial registrado | **Pendiente** | Ídem | Ídem |
| Búsqueda de tablas de migraciones (`pg_class`, nombre «migration» o esquema `supabase_migrations`) | Solo `auth.schema_migrations`, `realtime.schema_migrations` y `storage.migrations` | Son las migraciones **internas de Supabase**, no las de la aplicación. No hay tabla de migraciones propia | **Confirmado** | Ninguno | — |
| **Q10a** perfiles por rol y estado | **1 fila: `ceo`, activo, 1 cuenta** | No hay gerente ni empleado, ni inactivos | **Confirmado** | La validación de gerente y empleado **no es posible** con cuentas existentes | Pedir autorización para crear cuentas de prueba (o un proyecto aparte) |
| **Q10b** totales | Cuentas de Auth: **1**; perfiles: **1**; cuentas sin perfil: **0** | La única cuenta de Auth tiene perfil de CEO | **Confirmado** | Ninguno | — |
| **Q10c** identificadores y rol | 1 fila: `ba7060ae-…` (abreviado), rol `ceo`, activo | Cuenta única, la corporativa | **Confirmado** | Ninguno | — |

## 3. Estructuras y funciones relacionadas con los roles

| Comprobación | Resultado | Interpretación | Estado |
| --- | --- | --- | --- |
| Tipo `app_role` | `empleado, gerente, ceo` (en ese orden) | Jerarquía correcta | Confirmado |
| RLS en las 11 tablas de `public` | `rls_activa = true` en las 11 (`audit_log`, `categories`, `payment_methods`, `product_images`, `product_variants`, `products`, `profiles`, `promo_banners`, `sale_items`, `sales`, `stock_movements`). No hay tabla `staff*`. No se fuerza RLS al propietario (normal) | Todas protegidas | **Confirmado** |
| Políticas RLS de `public` | 22 políticas, solo para `authenticated`: lectura propia y de gestores en `profiles`; `gerente_all` en productos, variantes e imágenes; `sales_read_own` / `sales_read_all`; `stock_movements_read`; `audit_read_*`; `payment_methods_*`; `categories_*`; `promo_banners_manage`; `sale_items_read`. **No existe política de `INSERT`/`UPDATE`/`DELETE` sobre `profiles`, `sales`, `sale_items`, `stock_movements` ni `audit_log`** | Coincide con las migraciones. Las escrituras de esas tablas solo pasan por funciones | **Confirmado** |
| Políticas que dependen de `is_staff` | **0** | Sin restos de `staff_all` | **Confirmado** |
| Funciones `security definer` sin `search_path` fijo | **0** (todas las funciones tienen `search_path=""`) | Protección correcta | **Confirmado** |
| Funciones críticas (13 consultadas) | `admin_*` (5), `scan_*` (5), `pos_find`, `confirm_sale`, `current_app_role`, `has_role_at_least`, `can_manage_stock`, `adjust_stock`, `receive_stock`, `low_stock_variants`, `sales_summary`: existen; **ninguna ejecutable por `anon`**; ejecutables por `authenticated` salvo las internas (`sale_receipt`, `scan_require_employee`, `scan_normalize_barcode`, `audit_row_change`, `log_stock_change`, `profiles_guard`) | Coincide con la matriz de permisos. `sale_receipt` queda no invocable a propósito | **Confirmado** |
| Funciones ejecutables por `anon` (7) | `audit_log_immutable`, `enforce_category_depth`, `enforce_max_images`, `ledger_no_change`, `promo_banners_stamp`, `set_updated_at` (todas **devuelven `trigger`**) y `f_unaccent` (devuelve `text`, inmutable) | Son funciones de disparador (no se pueden invocar como RPC) y un envoltorio de `unaccent` sin acceso a datos. **Riesgo bajo.** Podría revocarse el permiso por prolijidad, pero no es necesario | **Confirmado, observación menor** |
| Triggers de protección y auditoría | Habilitados: `profiles_guard`, `audit_*` en 5 tablas, `audit_log_no_change` y `no_truncate`, `sales_/sale_items_/stock_movements_no_change` y `no_truncate`, límites de imágenes y de profundidad de categorías | Todos activos | **Confirmado** |
| Storage | Bucket `product-images` **público**; **8 políticas** en `storage.objects`: 4 «gerente … fotos» (migración 11) y 4 «gerente … imagenes del sitio» (migración 14). **No quedan** las «personal …» | Coincide con las migraciones | **Confirmado** |
| Extensiones | `pg_trgm`, `pgcrypto`, `unaccent`, `uuid-ossp` | Coincide con la migración 1 | Confirmado |

## 4. Contraste con las 19 migraciones (por objetos, no por versión)

La verificación es de **existencia de lo que cada migración crea**. No prueba el contenido exacto de cada función ni que se hayan aplicado en este orden.

| Migraciones | Evidencia en producción | Estado |
| --- | --- | --- |
| 1 `…28000001` (extensiones, auxiliares, `staff`) | Extensiones y `f_unaccent`, `set_updated_at` presentes. **`staff` e `is_staff()` ausentes** (consecuencia del cierre) | Confirmada; **`staff` ausente por el cierre** |
| 2 `…28000002` (tablas del catálogo) | `products`, `product_variants`, `product_images`, `categories` con RLS | Confirmada |
| 3 `…28000003` (RLS y reasignación) | RLS activa; `reassign_category_products` presente | Confirmada |
| 4 `…28000004` (vistas públicas) | `public_catalog` y `public_categories` existen y responden | Confirmada |
| 5 `…28000005` (bucket) | Bucket público presente; políticas «personal» ya reemplazadas | Confirmada |
| 6 `…29000001` (roles y perfiles) | `app_role`, `profiles`, `current_app_role`, `has_role_at_least` | Confirmada |
| 7 `…29000002` (protección de perfiles) | `profiles_guard` y los 4 `admin_*` | Confirmada |
| 8 `…29000003` (CEO inicial) | Existe 1 perfil CEO activo (consecuencia esperada) | Confirmada por su efecto; no se puede ver la ejecución |
| 9 `…29000004` (auditoría) | `audit_log`, triggers `audit_*`, inmutabilidad | Confirmada |
| 10 `…29000005` (políticas por rol) | `gerente_all`; sin `is_staff` en políticas | Confirmada |
| 11 `…29000006` (Storage y reasignación por rol) | Políticas «gerente … fotos»; sin «personal …»; `staff` ya no existe | Confirmada |
| 12 `…29000007` (archivado) | `products.archived_at` | Confirmada |
| 13 `…29000008` (escáner) | `scan_lookup`, `scan_set_price`, `scan_link_barcode`, `scan_create_product`, `scan_require_employee` | Confirmada |
| 14 `…30000001` (categorías principales y banners) | `promo_banners` con RLS y trigger `promo_banners_stamp`; `reorder_promo_banners`; `enforce_category_depth`; políticas «imagenes del sitio»; `public_promo_banners` | Confirmada |
| 15 `…31000001` (POS) | `sales`, `sale_items`, `stock_movements`, `payment_methods`; `confirm_sale`, `pos_find`, `adjust_stock`; `product_variants.stock`; triggers de libro inmutable | Confirmada |
| 16 `…01000001` (stock y borradores) | `receive_stock`, `scan_create_draft`, `low_stock_variants`, `sales_summary`, `can_manage_stock`, `delete_category_safe`, `reorder_main_categories`; `stock_movements.stock_before` | Confirmada |
| 17 `…02000001` (ficha de producto) | `public_product_images` y `public_product_variants` | Confirmada |
| 18 `…03000001` (arte móvil) | `promo_banners.image_mobile_path` | Confirmada |
| 19 `…08000001` (`admin_list_users`) | Función presente, solo `authenticated` | Confirmada (concuerda con lo dicho por el usuario) |

**Resumen:** **19 de 19 confirmadas por existencia de objetos**; **0 verificables por versión** (no hay registro); **1 inconsistencia**: el cierre `pending/` figura aplicado en producción y la documentación dice lo contrario.

## 5. Inconsistencias y efectos

| # | Inconsistencia | Efecto |
| --- | --- | --- |
| I1 | **El cierre `close_drop_staff` está aplicado** (no existen `staff`, `staff_legacy` ni `is_staff()`) y la documentación afirma que no | Seguridad: sin efecto negativo (ninguna dependencia). Operación: **el script de reversión de roles ya no funciona**; la única reversión es una copia de seguridad. El entorno de prueba debería replicar este estado |
| I2 | **No hay registro de versiones** | No se puede probar qué migraciones están aplicadas ni quién las aplicó |
| I3 | Existe **una sola cuenta** (CEO) | No se puede validar gerente ni empleado con cuentas reales |
| I4 | 7 funciones de disparador/utilidad ejecutables por `anon` | Riesgo bajo; no exponen datos ni son invocables como RPC |

## 6. Correcciones a los informes anteriores del Bloque 2

1. **Duda de `staff_legacy` resuelta:** no era un 404 por visibilidad de la API; la tabla **no existe**.
2. **Cuentas:** el CEO es la **única** cuenta; no existen gerente ni empleado. La validación de esos dos roles requiere crear cuentas, que **no está autorizada**.
3. El entorno de prueba propuesto aplicaba 19 migraciones **sin** el cierre; para replicar producción conviene **incluir el cierre** (o aceptar la diferencia de forma explícita).
4. La migración 8 exige una fila en `staff`. En un proyecto nuevo se mantiene lo propuesto: crear el CEO, insertar en `staff`, aplicar la 8, y luego el cierre.

## 7. Próximos pasos recomendados

1. **Preguntar** quién aplicó el cierre `close_drop_staff` y cuándo, y anotarlo en la bitácora de operaciones manuales.
2. **Corregir la documentación** (`estado.md` §2, `autorizacion-roles.md` §3 y §6, `decisiones.md`) para reflejar el cierre aplicado y la ausencia de registro de versiones. Se hará con tu visto bueno.
3. **Decidir** cómo validar gerente y empleado: crear dos cuentas de prueba en producción (con las consecuencias del informe del Bloque 2, R5 del diagnóstico) o un proyecto aparte.
4. **Con la sesión del CEO**, ejecutar el protocolo de lectura (`protocolo-bloque-2-lectura-produccion.md`, S1 a S11); es el único rol validable hoy.
5. Opcional, de bajo riesgo: revocar `execute` de `anon` sobre las funciones de disparador.

## 8. Constancia

**No se modificó ningún dato de producción.** Todo lo ejecutado fue lectura: consultas `SELECT` y las herramientas de lectura del conector (`get_project`, `list_migrations`). No se aplicó ninguna migración, no se escribió ninguna fila, no se creó ni modificó ningún usuario, producto, categoría, stock, venta o imagen. No hubo commit, push ni deploy.

## 9. Documentación actualizada con estos hallazgos (8 de noviembre de 2026)

Solo archivos Markdown; sin cambios en código, SQL, migraciones ni configuración, y sin nuevas conexiones a Supabase. Se conservó el texto histórico (tachado o con nota fechada).

| Documento | Corrección |
| --- | --- |
| `estado.md` | §2: sin historial de versiones (`list_migrations` vacío, `supabase_migrations.schema_migrations` inexistente), objetos de las 19 migraciones presentes, cierre `close_drop_staff` aplicado; fila de `pending/` corregida; bitácora §2 bis con el cierre (operador y fecha desconocidos); nueva §2 ter con RLS, políticas, funciones, triggers, Storage y cuentas; pendiente técnico 1 tachado; fila 0.6 con el Bloque 2 parcial |
| `autorizacion-roles.md` | Estado y §3, §6, §7, §8 y §9: `staff`, `staff_legacy` e `is_staff()` no existen; el cierre está aplicado; resultados de las verificaciones; el script de reversión ya no es utilizable |
| `decisiones.md` | Fila del 29 oct marcada como superada; fila nueva del 8 nov (cierre aplicado, operador y fecha desconocidos); decisiones abiertas actualizadas (cierre, validación de roles, historial de migraciones) |
| `modelo-de-datos.md` | La frase «hoy existe como `staff_legacy`» corregida |
| `proyecto-supabase-de-prueba.md` | Nota: para replicar producción hay que aplicar el cierre al final; producción tiene una sola cuenta |
| `protocolo-bloque-2-lectura-produccion.md` | Q1 ya respondida |
| `informe-bloque-2-entorno-prueba.md` e `informe-bloque-2-diagnostico-supabase-existente.md` | Notas de actualización al inicio; texto original conservado |

**Sigue pendiente:** averiguar quién aplicó el cierre y cuándo (desconocido, no se atribuye a nadie); pruebas autenticadas de gerente y empleado (no existen las cuentas); validación con la sesión del CEO; casos de escritura (entorno aislado).
