# Informe del Bloque 2 (Fase 0.6): entorno de Supabase de prueba y validación de roles

> **Actualización del 8 de noviembre de 2026 (diagnóstico con el conector, ver [informe-bloque-2-diagnostico-conector.md](informe-bloque-2-diagnostico-conector.md)):** este informe es anterior al hallazgo y **tres de sus afirmaciones quedan corregidas**: (1) el cierre `close_drop_staff` **sí está aplicado** en producción (`staff`, `staff_legacy` e `is_staff()` no existen; operador y fecha desconocidos), así que donde dice «en producción tampoco está aplicada» (§2.2, punto 4), «sigue pendiente a propósito el cierre» (punto 6) o «no se aplicó `pending/`» (§7, criterio 2) debe leerse el estado nuevo; (2) producción tiene **una sola cuenta (CEO)**; (3) **no hay historial de versiones** de migraciones. El texto original se conserva por trazabilidad.

Fecha: 8 de noviembre de 2026. **Solo diagnóstico y preparación.** No se creó ningún proyecto, cuenta, clave ni conexión; no se aplicó ninguna migración; no se tocó producción ni Supabase; no hubo commits, push ni deploy. Se leyeron las migraciones, la documentación y las pruebas del repositorio.

**Convención de evidencia:** **[U]** lo confirmó el usuario; **[O]** observado en esta intervención (en el repositorio); **[H]** evidencia histórica de una fase anterior; **[N]** no verificable sin acceso a Supabase.

## 1. Estado del entorno Supabase

| Pregunta | Respuesta |
| --- | --- |
| ¿Existe un proyecto de prueba? | **No hay evidencia de que exista** [O]. `docs/estado.md` dice «no existe todavía» y `.env.local` solo tiene `ALLOWED_DEV_ORIGINS`: ninguna URL ni clave de prueba configurada. |
| ¿A qué apunta hoy la aplicación local? | A **producción**, porque `.env` (versionado) lleva la URL y la clave pública de producción [O]. Es el riesgo principal del bloque (ver §3, R1). |
| ¿Qué hay listo en el repositorio? | Procedimiento (`proyecto-supabase-de-prueba.md`), semilla de 5 productos ficticios (`supabase/seed-prueba/`, probada con PGlite), protocolo de cuentas (`protocolo-validacion-cuentas.md`) y 253 pruebas de base. |
| ¿Hay que crear uno? | **Sí.** Es una operación externa: **requiere tu autorización**, y la crea quien administra la cuenta de Supabase. |

## 2. Migraciones y dependencias

### 2.1 Orden y contenido (19 migraciones, 1.825 líneas)

| Orden | Archivo | Aporta | Depende de |
| --- | --- | --- | --- |
| 1 | `20261028000001_extensions_helpers_staff` | Extensiones, funciones auxiliares, tabla `staff` | — |
| 2 | `20261028000002_catalog_tables` | Categorías, productos, variantes, fotos | 1 |
| 3 | `20261028000003_rls_and_category_reassign` | RLS inicial (`staff_all`) y reasignación de categoría | 1, 2 |
| 4 | `20261028000004_public_catalog_views` | Vistas públicas | 2 |
| 5 | `20261028000005_storage_product_images` | Bucket `product-images` y políticas de Storage | `storage` |
| 6 | `20261029000001_roles_and_profiles` | `app_role`, `profiles`, `current_app_role()`, `has_role_at_least()` | 1 |
| 7 | `20261029000002_profile_protection` | Trigger `profiles_guard`, `admin_create_profile / set_role / set_active / set_display_name` | 6 |
| 8 | `20261029000003_assign_initial_ceo` | Convierte lo que haya en `staff` en CEO. **Aborta si `staff` está vacía** | 1, 6 y **al menos una fila en `staff`** |
| 9 | `20261029000004_audit_log` | `audit_log`, triggers de auditoría en 5 tablas, inmutabilidad | 6 |
| 10 | `20261029000005_catalog_role_policies` | Políticas por rol y borrado de `staff_all` | 3, 6 |
| 11 | `20261029000006_storage_and_reassign_roles` | Storage por rol; `staff` pasa a `staff_legacy` | 5, 10 |
| 12 | `20261029000007_archive_products` | `archived_at`, `public_catalog` sin archivados | 4 |
| 13 | `20261029000008_barcode_scan_functions` | `scan_lookup / set_price / link_barcode / create_product`, `scan_require_employee` | 6, 12 |
| 14 | `20261030000001_main_categories_and_promo_banners` | Categorías principales, `promo_banners` | 2, 6 |
| 15 | `20261031000001_pos_sales_and_stock` | Stock, medios de pago, `sales`, `sale_items`, `stock_movements`, `pos_find`, `confirm_sale`, `adjust_stock` | 6, 13 |
| 16 | `20261101000001_scanner_stock_drafts_and_categories` | `receive_stock`, `scan_create_draft`, `low_stock_variants`, `sales_summary`, `can_manage_stock` | 15 |
| 17 | `20261102000001_public_product_detail` | Vistas de la ficha | 2 |
| 18 | `20261103000001_banner_mobile_image` | Arte móvil de banners | 14 |
| 19 | `20261108000001_admin_list_users` | `admin_list_users()` solo CEO | 6 |

### 2.2 Dependencias delicadas

1. **La migración 8 exige una fila en `staff` antes de correr.** En un proyecto vacío hay que crear primero el usuario CEO en Authentication y hacer el `insert` en `staff` (ya está en el procedimiento actual). Si no, aborta sin cambiar nada.
2. **Migraciones 5 y 11 crean políticas sobre `storage.objects`.** Pueden fallar en el SQL Editor por permisos; los archivos traen el paso manual desde el panel de Storage.
3. **La migración 10 borra `staff_all` en la misma transacción** que crea las políticas nuevas: si se aplicara a mano en dos pasos, quedaría una puerta abierta. Aplicarla entera.
4. **No aplicar** `supabase/pending/20261029000099_close_drop_staff.sql` (en producción tampoco está aplicada) ni `supabase/correcciones/20261103_catalogo_datos.sql` (lleva ids de producción). **[HISTÓRICO, superado el 8 de noviembre de 2026: el cierre SÍ está aplicado en producción; para replicar producción se aplica al final, ver proyecto-supabase-de-prueba.md §2]**
5. Producción tiene las 19 aplicadas **por confirmación del usuario** [U] (4 y 8 de noviembre), sin registro técnico en el repositorio [N]. Lo observado en solo lectura: las tres últimas más `admin_list_users` y las correcciones de datos se ven en producción [H][O]. El proyecto de prueba debe replicar **ese** estado: 19 migraciones, sin el cierre `pending/`.
6. **Pendientes de aplicar en producción:** ninguna migración de `migrations/`. Sigue pendiente a propósito el cierre de `pending/`. **[HISTÓRICO, superado el 8 de noviembre de 2026: el cierre de pending/ ya está aplicado; no queda nada pendiente de aplicar]**

## 3. Riesgos detectados

| # | Riesgo | Nivel | Mitigación propuesta |
| --- | --- | --- | --- |
| R1 | **`.env` versionado apunta a producción.** Si `.env.local` falta o se borra, la aplicación local vuelve a producción y una «venta de prueba» sería real y permanente (el historial es de solo agregado) | **Alto** | Comprobar la URL activa antes de cada prueba (caso C-00); usar un nombre inconfundible para el proyecto de prueba; nunca ejecutar ventas sin ese control |
| R2 | La prueba con cuentas reales solo es válida si se hace sobre el entorno que **replica producción**: si el proyecto de prueba difiere (migración omitida, `staff` vacía, políticas de Storage sin crear), el resultado no vale | Alto | Verificación de objetos (§4.5) antes de empezar |
| R3 | **La CI de GitHub no corre las pruebas de base ni la de concurrencia** (solo tsc, lint, `npm test` y build) [O] | Medio | Decisión posterior; no se cambia ahora |
| R4 | Las 253 pruebas usan PGlite con roles y JWT **simulados**: no cubren PostgREST, Auth, expiración de token ni Storage API | Medio | Es exactamente lo que cubre este bloque con cuentas reales |
| R5 | Creación de cuentas: registro público abierto en el proyecto de prueba permitiría crear cuentas sin perfil (no acceden a nada protegido, pero ensucian) | Bajo | Desactivarlo al crear el proyecto (ya figura en el procedimiento) |
| R6 | Las contraseñas de prueba circulan por chat o quedan en archivos | Medio | Las define y guarda quien administra; no se versionan ni se pegan en conversaciones |
| R7 | `admin_list_users` expone el correo de **todas** las cuentas de Auth (con o sin perfil) al CEO | Bajo | Es el diseño previsto; verificar que solo el CEO activo lo ejecuta (casos CEO-02, GER-02, EMP-02, ANO-02) |
| R8 | La auditoría no registra lecturas ni archivos de Storage | Bajo | Límite ya documentado (`autorizacion-roles.md` §5) |
| R9 | Que `service_role` aparezca en el código o en variables públicas | Bajo | No aparece [O]: solo menciones de advertencia en comentarios y documentos; una prueba automática lo vigila |

## 4. Procedimiento para crear y configurar el entorno de prueba

**Nada de esto se ejecutó.** Cada paso externo necesita tu autorización. El procedimiento detallado ya existe y sigue vigente: [proyecto-supabase-de-prueba.md](proyecto-supabase-de-prueba.md). Resumen operativo con los controles que agrega este bloque:

### 4.1 Crear el proyecto (lo hace quien administra la cuenta de Supabase)

1. Proyecto **nuevo y aparte**, con nombre inconfundible: `mundo-del-plastico-PRUEBA`. Región cercana. Contraseña de la base generada y guardada en un gestor, no en chats.
2. Authentication → Sign In / Providers: **desactivar el registro público**. Solo proveedor de correo; sin autoconfirmar para cuentas reales de clientes (aquí no hay clientes).
3. Anotar fuera de Git la URL y la clave **pública** (`anon`/publishable). **No se usa ni se guarda `service_role` en la aplicación.**

### 4.2 Crear las tres cuentas de prueba (Authentication → Users, marcadas como confirmadas)

| Cuenta | Correo sugerido (inconfundible como de prueba) | Rol que recibe |
| --- | --- | --- |
| CEO | `ceo-prueba@<dominio de prueba>` | `ceo`, por la migración 8 a partir de `staff` |
| Gerente | `gerente-prueba@<dominio de prueba>` | `gerente`, con `admin_create_profile` (o la pantalla Usuarios con el CEO) |
| Empleado | `empleado-prueba@<dominio de prueba>` | `empleado`, igual |

Sin cuentas de clientes reales ni correos reales de terceros. Contraseñas distintas entre sí y distintas de las de producción.

### 4.3 Aplicar las migraciones

En el SQL Editor **del proyecto de prueba**, de a una y en el orden de §2.1, verificando que cada una termine sin error. Antes de la 8: crear el CEO y `insert into public.staff (user_id) values ('<uuid del CEO>');`. Las políticas de Storage que fallen se crean a mano desde el panel (el aviso del archivo lo explica). **[HISTÓRICO, superado el 8 de noviembre de 2026: después de la 19 se aplica el cierre close_drop_staff; ver proyecto-supabase-de-prueba.md §2]**

### 4.4 Cargar datos ficticios

`supabase/seed-prueba/seed_proyecto_prueba.sql`, precedido de `set app.confirmo_proyecto_de_prueba = 'si';` en la misma ejecución. Se niega a correr si encuentra productos que no sean de prueba (parece producción) o ventas. Deja 5 productos «[PRUEBA] …» con códigos EAN-13 válidos y no crea usuarios.

### 4.5 Verificación de que el entorno replica producción (solo lectura)

Las consultas ya están en `proyecto-supabase-de-prueba.md` §3. Resultado esperado:

| Verificación | Esperado |
| --- | --- |
| Funciones críticas | Las 11 (`pos_find`, `confirm_sale`, `sale_receipt`, `adjust_stock`, `receive_stock`, `scan_create_draft`, `low_stock_variants`, `sales_summary`, `has_role_at_least`, `admin_create_profile`, `admin_list_users`) |
| RLS | `rowsecurity = true` en `products`, `product_variants`, `sales`, `sale_items`, `stock_movements`, `payment_methods`, `profiles`, `audit_log` (y `categories`, `product_images`, `promo_banners`) |
| Políticas que dependan de `is_staff` | Ninguna |
| `has_function_privilege('anon','public.confirm_sale(uuid,text,jsonb)','execute')` | `false` |
| Bucket `product-images` | Existe y es público |
| `public.profiles` | 3 filas, una por rol, todas activas |

### 4.6 Variables locales

En `.env.local` (no versionado, tiene prioridad sobre `.env`) poner **solo** `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` del proyecto de prueba, y conservar `ALLOWED_DEV_ORIGINS`. No copiar nada de producción: ni claves, ni datos, ni la base. Reiniciar `npm run dev` y correr el caso **C-00** antes de cualquier otra cosa. Al terminar, pausar o borrar el proyecto de prueba.

## 5. Matriz de permisos por rol

Derivada de las migraciones [O] y verificada por las pruebas existentes en PGlite [H]. **Lo que falta es verificarla con cuentas reales sobre la plataforma real.**

| Operación | Anónimo | Empleado | Gerente | CEO | Dónde se aplica |
| --- | --- | --- | --- | --- | --- |
| Catálogo público (vistas `public_*`) | Sí | Sí | Sí | Sí | Vistas, lectura pública |
| `pos_find`, `confirm_sale` | **No** | Sí | Sí | Sí | `scan_require_employee()` dentro de la función |
| `scan_lookup`, `scan_set_price`, `scan_link_barcode`, `scan_create_product`, `scan_create_draft` | No | Sí | Sí | Sí | Ídem |
| Leer productos, variantes e imágenes directo | No | **No** | Sí | Sí | RLS `gerente_all` |
| Crear, editar, archivar o despublicar productos y variantes | No | No | Sí | Sí | RLS |
| Gestionar categorías y banners | No | No | Sí | Sí | RLS (`categories_*`, `promo_banners_manage`) |
| Subir, cambiar y borrar fotos en `products/` | No | No | Sí | Sí | Políticas de `storage.objects` |
| Leer medios de pago | No | Sí | Sí | Sí | RLS |
| Modificar medios de pago | No | No | Sí | Sí | RLS |
| `receive_stock`, `adjust_stock`, `low_stock_variants` | No | **No** | Sí | Sí | `can_manage_stock()` / `has_role_at_least('gerente')` |
| `sales_summary` | No | Solo sus ventas | Todas | Todas | Corre con los permisos de quien llama (RLS) |
| Leer `sales` y `sale_items` | No | **Solo las propias** | Todas | Todas | RLS `sales_read_own` / `sales_read_all` |
| Leer `stock_movements` | No | No | Sí | Sí | RLS |
| Escribir `sales`, `sale_items`, `stock_movements` directamente | No | No | No | No | Sin permiso de escritura; solo vía `confirm_sale` / `adjust_stock` / `receive_stock` |
| Leer `profiles` | No | Solo el propio | Todos | Todos | RLS |
| Escribir `profiles` por la API | No | No | No | No | Sin permiso de tabla; solo `admin_*` |
| `admin_create_profile`, `admin_set_role`, `admin_set_active`, `admin_set_display_name` | No | No | **No** | Sí, nunca sobre sí mismo | `has_role_at_least('ceo')` + trigger `profiles_guard` |
| **`admin_list_users`** | No | No | **No** | Sí (CEO activo) | `has_role_at_least('ceo')` dentro de la función |
| Leer `audit_log` | No | Solo la propia | Catálogo del equipo | Toda | RLS |
| Último CEO | — | — | — | No se puede degradar, desactivar ni borrar | Trigger con candado |
| Cuenta desactivada | — | Pierde todo acceso al instante | Ídem | Ídem | `has_role_at_least` devuelve falso si `active = false` |

## 6. Casos de prueba reproducibles

**Dos niveles, ambos en el proyecto de prueba:**
- **Nivel A (base de datos):** en el SQL Editor, suplantando a cada usuario con sus claims. Verifica que **la base** decide, sin interfaz. Cada caso va dentro de una transacción que termina en `rollback`, así que no deja datos.
- **Nivel B (plataforma real):** iniciando sesión con las cuentas reales, desde la aplicación o desde la API REST con el token de cada cuenta. Verifica PostgREST, Auth y Storage.

### 6.1 Plantilla del nivel A

```sql
begin;
set local role authenticated;                                   -- (o anon, para los casos ANO-*)
select set_config('request.jwt.claims',
  json_build_object('sub', '<uuid de la cuenta>', 'role', 'authenticated')::text, true);
-- ... el caso ...
rollback;
```

### 6.2 Casos

| ID | Cuenta | Acción | Resultado esperado | Nivel |
| --- | --- | --- | --- | --- |
| **C-00** | — | Abrir la aplicación local y comprobar la URL de Supabase activa (red del navegador o `console`) | Es la del **proyecto de prueba**, y el catálogo muestra «[PRUEBA] …» | B |
| ANO-01 | Anónimo | `select * from public.products / sales / profiles / stock_movements / audit_log` | Sin permiso (401 por API; 42501 en SQL) | A y B |
| ANO-02 | Anónimo | Ejecutar `admin_list_users`, `pos_find`, `confirm_sale`, `receive_stock` | Rechazo (401 / 42501) | A y B |
| ANO-03 | Anónimo | Leer `public_catalog` | 200 con lo publicado | B |
| EMP-01 | Empleado | Iniciar sesión; abrir `/panel/precios` | Entra; el menú muestra solo las secciones del empleado | B |
| EMP-02 | Empleado | `select public.admin_list_users()` | Error `42501` «No autorizado» | A y B |
| EMP-03 | Empleado | `admin_set_role(<propio id>, 'ceo')`, `update public.profiles set role='ceo'` | Rechazo en ambos (sin autoascenso) | A y B |
| EMP-04 | Empleado | `pos_find('PRUEBA')`, luego `confirm_sale` de un producto con stock | Funciona; la venta queda con su `user_id` | A (con rollback) y B (en el POS) |
| EMP-05 | Empleado | `select * from public.sales` | Solo las suyas | A y B |
| EMP-06 | Empleado | `receive_stock`, `adjust_stock`, `select * from public.stock_movements`, `select * from public.products` | Rechazo / 0 filas | A y B |
| EMP-07 | Empleado | `update public.sales set total = 0` y `delete from public.sale_items` | Rechazo (sin permiso de escritura) | A y B |
| GER-01 | Gerente | Crear y editar un producto con variante; subir una foto bajo `products/` | Funciona | B |
| GER-02 | Gerente | `select public.admin_list_users()` y `admin_create_profile(...)` | `42501` «No autorizado» | A y B |
| GER-03 | Gerente | `receive_stock(<variante>, 5)` y `adjust_stock(...)` | Funciona; deja movimiento con `stock_before` | A (rollback) y B |
| GER-04 | Gerente | `select * from public.sales` y `stock_movements` | Todas las filas | A y B |
| GER-05 | Gerente | `select * from public.profiles` | Todas las filas, sin correos | A y B |
| GER-06 | Gerente | Abrir `/panel/usuarios` por URL directa | Redirección al inicio | B |
| CEO-01 | CEO | Iniciar sesión; abrir `/panel/usuarios` | Entra; ve las tres cuentas (y cualquier cuenta de Auth sin perfil) | B |
| CEO-02 | CEO | `select * from public.admin_list_users()` | 3 filas con correo, rol, estado y fechas; **sin contraseñas ni tokens** | A y B |
| CEO-03 | CEO | `admin_set_role` sobre el gerente y luego revertir | Funciona; deja fila en `audit_log` | A (rollback) y B |
| CEO-04 | CEO | `admin_set_role(<propio id>, 'empleado')` y `admin_set_active(<propio id>, false)` | Rechazo | A y B |
| CEO-05 | CEO | `select * from public.audit_log` | Toda la auditoría | A y B |
| ADM-01 | CEO, luego empleado | El CEO desactiva al empleado; el empleado vuelve a la pestaña | Pierde el acceso; la aplicación lo devuelve al ingreso | B |
| SEC-01 | Cualquiera | Revisar los bundles servidos y las variables públicas | No aparece `service_role` ni la clave de la base | B |
| SEC-02 | — | Consulta de RLS: `select tablename, rowsecurity from pg_tables where schemaname='public'` | `true` en todas las tablas de §4.5 | A |
| SEC-03 | — | Consulta de funciones `security definer` sin `search_path` fijo | Ninguna: `select proname from pg_proc where prosecdef and pronamespace='public'::regnamespace and (proconfig is null or not exists (select 1 from unnest(proconfig) c where c like 'search_path=%'))` devuelve 0 filas | A |
| SEC-04 | — | `select has_function_privilege('anon', p.oid, 'execute') from pg_proc p where pronamespace='public'::regnamespace and prosecdef` | Solo las funciones públicas deliberadas pueden dar `true`; `admin_*`, `scan_*`, `pos_find`, `confirm_sale` dan `false` | A |
| SEC-05 | Empleado y gerente | Intentar `insert`, `update` y `delete` sobre `profiles` y `audit_log` por la API | Rechazo; `audit_log` inmutable incluso para el propietario | A y B |

## 7. Criterios para considerar aprobado el Bloque 2

El Bloque 2 se da por **aprobado** solo si se cumple **todo** lo siguiente:

1. Existe un proyecto de prueba **separado** de producción, con registro público desactivado, y su URL **no coincide** con la de producción (C-00 aprobado).
2. Las 19 migraciones se aplicaron sin error, en orden, y **no** se aplicó `pending/` ni `correcciones/`. La verificación de §4.5 da el resultado esperado. **[HISTÓRICO, superado el 8 de noviembre de 2026: el criterio debe leerse con el cierre aplicado al final de la secuencia]**
3. Hay tres cuentas reales de prueba, una por rol, y ninguna cuenta ni dato real de clientes o de producción.
4. Los casos de §6 dan el resultado esperado en ambos niveles (A y B), **sin excepciones**. Cualquier diferencia se documenta como hallazgo y se corrige antes de aprobar.
5. Los permisos se comprueban **en la base** (nivel A con cuentas suplantadas) y **en la plataforma** (nivel B), no solo en la interfaz.
6. No hay `service_role` en el código, en el bundle ni en variables públicas (SEC-01), y no hay elevación de privilegios por la API (EMP-03, CEO-04, SEC-05).
7. Los resultados quedan registrados en el protocolo (`protocolo-validacion-cuentas.md` §6), con fecha y sin contraseñas.
8. Producción no recibió ninguna escritura, migración ni cambio de rol durante el bloque.

Si falla el punto 4 en un caso de seguridad, **el bloque no se aprueba** y la fase 0.6 no avanza.

## 8. Qué se hizo y qué falta

| Hecho en este bloque (sin operaciones externas) | Pendiente que requiere autorización |
| --- | --- |
| Revisión de las 19 migraciones, sus dependencias y su orden | Crear el proyecto de Supabase de prueba |
| Revisión de funciones, políticas RLS y permisos de ejecución | Crear las tres cuentas de prueba |
| Matriz de permisos por rol | Aplicar las migraciones en el proyecto de prueba |
| 28 casos reproducibles y criterios de aprobación | Cargar la semilla |
| Identificación de riesgos (R1 a R9) | Configurar `.env.local` y ejecutar los casos |

**Autorizaciones necesarias para continuar:** (1) crear el proyecto de prueba, (2) crear las tres cuentas, (3) aplicar las migraciones y la semilla en ese proyecto, y (4) ejecutar los casos. Pueden darse juntas o por separado; ninguna toca producción.
