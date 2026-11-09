# Bloque 2 (adaptación): diagnóstico sobre el Supabase existente

Fecha: 8 de noviembre de 2026. **Solo diagnóstico y pruebas anónimas sin escritura.** No se creó otro proyecto, no se aplicó ninguna migración, no se modificó ningún usuario, producto, stock ni venta, y no hubo commit, push ni deploy. Complementa [informe-bloque-2-entorno-prueba.md](informe-bloque-2-entorno-prueba.md).

> **Actualización del 8 de noviembre de 2026:** la «duda `staff_legacy`» de este informe quedó **resuelta** con el conector: `staff`, `staff_legacy` e `is_staff()` **no existen** (cierre aplicado; operador y fecha desconocidos). También se sabe ahora que **solo existe la cuenta CEO** y que **no hay historial de versiones** de migraciones. Ver [informe-bloque-2-diagnostico-conector.md](informe-bloque-2-diagnostico-conector.md). El texto original se conserva.

## 1. Fase 1: verificación obligatoria

| # | Punto | Resultado |
| --- | --- | --- |
| 1 | Rama y Git | `main` en `4c4bbd6`; `origin/main` en `de4b9c2` (2 por detrás). Pendientes sin commit: `docs/README.md` modificado, `docs/informe-bloque-2-entorno-prueba.md` y este informe nuevos, y `Logos de categorias/` sin versionar |
| 2 | Archivo de entorno que usa la aplicación | **`.env`** (versionado): define `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `.env.local` solo define `ALLOWED_DEV_ORIGINS` (no pisa nada). No hay variables `NEXT_PUBLIC_SUPABASE_*` en el entorno del sistema. El código no lee ninguna otra URL |
| 3 | Proyecto de destino | Referencia **`nogufedcmkjphiqyyriz`** (sin mostrar claves) |
| 4 | ¿Es producción? | **Sí.** Es el único proyecto configurado; su catálogo, sus banners y sus fotos son los del sitio real; el usuario aplicó en él `admin_list_users` y despublicó y borró fotos a mano; y la documentación dice que `.env` lleva las claves de producción. **No es un proyecto de prueba.** |
| 5 | Estado de las 19 migraciones | **No verificable de forma directa**: `supabase_migrations.schema_migrations` no es legible con la clave pública y el esquema no se publica a anónimos (el descriptor OpenAPI vuelve vacío). **Por objetos:** las 13 funciones consultadas existen y rechazan a anónimos (ver §2); eso confirma las migraciones 6, 7, 13, 15, 16 y 19 (roles, `admin_*`, escáner, POS, stock y `admin_list_users`). Las vistas públicas de las migraciones 4, 12, 14, 17 y 18 responden. Concuerda con lo confirmado por el usuario [U], sin contradecirlo. **Sin registro de versiones.** **[HISTÓRICO, superado el 8 de noviembre de 2026: ver informe-bloque-2-diagnostico-conector.md §2 y §4: sin historial de versiones, objetos de las 19 presentes]** |
| 6 | Cuentas disponibles y roles | **No se pueden listar sin sesión de CEO** (`admin_list_users` y `profiles` rechazan a anónimos). No se conocen los correos ni los roles reales. No hay credenciales en el entorno y yo no ingreso contraseñas. |

**[HISTÓRICO, superado el 8 de noviembre de 2026: RESUELTA: staff, staff_legacy e is_staff() no existen]** **Una duda para resolver con SQL (solo lectura):** la lectura anónima de `staff` y `staff_legacy` da 404 (la tabla no figura), mientras las demás tablas protegidas dan 401. Puede ser solo que esas tablas no se publican al API, o que `close_drop_staff` se hubiera aplicado sin registro. La documentación dice que **no** se aplicó. Comprobación en el SQL Editor: `select to_regclass('public.staff_legacy'), to_regprocedure('public.is_staff()');`.

## 2. Fase 2: pruebas sin escritura ejecutadas (anónimo)

Todas con la clave pública. Solo `GET` y llamadas a funciones con argumentos inválidos a propósito (ids en cero, cantidades 0, lista vacía), de modo que ni un permiso mal concedido podría escribir algo.

| Caso | Resultado | Veredicto |
| --- | --- | --- |
| ANO-01: leer `products`, `product_variants`, `product_images`, `categories`, `promo_banners`, `profiles`, `audit_log`, `sales`, `sale_items`, `stock_movements`, `payment_methods` | **401 (`42501`) en las 11** | Aprobado |
| ANO-02: ejecutar `pos_find`, `confirm_sale`, `sale_receipt`, `adjust_stock`, `receive_stock`, `scan_create_draft`, `scan_lookup`, `low_stock_variants`, `sales_summary`, `has_role_at_least`, `admin_create_profile`, `admin_list_users`, `current_app_role` | **401 (`42501`) en las 13**: existen y rechazan al público | Aprobado |
| ANO-03: leer las vistas públicas (`public_catalog`, `public_categories`, `public_promo_banners`, `public_product_images`, `public_product_variants`) | 200 en las 5 (1 producto, 0 banners) | Aprobado |
| Auth: registro público | **Cerrado**; solo proveedor de correo; sin autoconfirmar | Aprobado |
| Auth: `/user` sin sesión | 401 | Aprobado |
| Storage: listado público del bucket | 200 con 0 elementos (no se puede enumerar) | Aprobado |
| Esquema para anónimos (OpenAPI) | No se publica (vacío) | Aprobado |
| Escrituras anónimas (`INSERT`/`UPDATE`/`DELETE`) | **No ejecutadas a propósito** (no se escribe en producción para probar que escribir falla); se cubren con las pruebas de base y con la revisión de permisos de las migraciones | No ejecutado |

**Errores de permisos o RLS encontrados: ninguno.**

## 3. Fases 3 y 4: pruebas autenticadas y con escritura — **no ejecutadas**

Motivo: el único proyecto configurado **es producción** y no hay forma de aislar una prueba autenticada de escritura de datos reales. Además no tengo las contraseñas ni puedo ingresarlas.

| Caso (informe del Bloque 2) | Estado | Motivo |
| --- | --- | --- |
| EMP-01 a EMP-03, GER-01 a GER-06, CEO-01 a CEO-05 (lecturas con sesión) | **Pendiente** | Requieren iniciar sesión con una cuenta real de cada rol. Las **lecturas** (menú, perfil, `admin_list_users`, `select` por rol, rechazo de rutas) no escriben y las puede ejecutar el usuario con su sesión y yo con su guía; **no se sabe si existen las cuentas de gerente y de empleado** |
| EMP-04 (venta), GER-03 (entrada/ajuste de stock) | **No ejecutable en producción** | Una venta y un movimiento de stock son permanentes (historial de solo agregado) y tocarían stock de productos reales |
| EMP-07, SEC-05 (escrituras prohibidas por rol) | **No ejecutables en producción** | Si un permiso estuviera mal, la prueba podría modificar `sales`, `profiles` o `audit_log` reales |
| CEO-03, CEO-04, ADM-01 (cambiar rol, desactivar cuentas) | **No ejecutables en producción** | Modifican usuarios existentes, que está prohibido |
| GER-01 (crear producto y subir foto) | **Aislable solo con un registro de prueba identificado**; **pendiente de decisión** | Crea un producto nuevo «[PRUEBA]» en producción; ni se publica ni toca los existentes, pero deja filas en `audit_log` y no se puede borrar desde el panel (solo archivar) |
| SEC-01 (bundles sin `service_role`) | Puede hacerse sin escritura; **no se hizo en este paso** | Queda para la siguiente instrucción |

**Cuentas que faltan o se desconocen:** CEO (existe, la cuenta corporativa, según la documentación; correo no registrado), gerente y empleado (no consta que existan). **No creo usuarios ni cambio roles sin tu autorización explícita.** **[HISTÓRICO, superado el 8 de noviembre de 2026: hoy se sabe que existe una sola cuenta (CEO) y que no hay gerente ni empleado]**

## 4. Riesgos detectados

1. **No existe aislamiento:** `.env` (producción) es el único destino. Toda prueba autenticada que escriba afectaría datos reales. Es el motivo de las pruebas no ejecutadas.
2. **Sin registro de migraciones:** se comprobó por objetos, no por versión; no se puede probar que las 19 estén todas.
**[HISTÓRICO, superado el 8 de noviembre de 2026: RESUELTA, la tabla no existe]** 3. **Duda `staff_legacy`** (§1): debe confirmarse con SQL de solo lectura.
4. **Cuentas de gerente y empleado desconocidas:** la validación de los tres roles no puede completarse sin ellas.
5. **Crear cuentas de prueba en producción** (la alternativa a un proyecto aparte) tiene costos: las cuentas quedan en Auth y en `profiles`, la auditoría guarda sus acciones, y una cuenta de empleado que venda deja ventas permanentes.

## 5. Estado de los criterios de aprobación del Bloque 2

| # | Criterio | Estado |
| --- | --- | --- |
| 1 | Proyecto de prueba separado, con URL distinta de producción | **No cumplido** (se decidió usar el existente) |
| 2 | 19 migraciones aplicadas y verificadas | **Parcial**: funciones y vistas presentes; sin registro de versiones |
| 3 | Tres cuentas reales de prueba | **No verificado** (solo se sabe del CEO) |
| 4 | Casos de §6 con el resultado esperado | **Parcial**: solo los anónimos (3 de 28 casos, más las comprobaciones de Auth y Storage) |
| 5 | Permisos comprobados en la base y en la plataforma | **Parcial**: base por pruebas previas; plataforma solo como anónimo |
| 6 | Sin `service_role` ni elevación de privilegios | **Parcial**: sin `service_role` en el código; elevación no probada en la plataforma |
| 7 | Resultados registrados en el protocolo | Este informe; falta el protocolo con cuentas |
| 8 | Producción sin escrituras | **Cumplido** en este paso |

**El Bloque 2 no está aprobado.** Faltan las pruebas con cuentas reales.

## 6. Decisiones que necesito

1. **Lecturas con sesión (sin escritura):** ¿querés ejecutar vos, con tu sesión, los casos de solo lectura de cada rol? Para eso hace falta saber si existen las cuentas de gerente y de empleado.
2. **Casos que escriben:** o se hacen en un proyecto aparte, o quedan **pendientes** hasta tener uno. No propongo crear cuentas ni datos en producción.
3. **Dudas de solo lectura en el SQL Editor:** `to_regclass('public.staff_legacy')`, `to_regprocedure('public.is_staff()')` y `select version from supabase_migrations.schema_migrations order by version;`. **[HISTÓRICO, superado el 8 de noviembre de 2026: Q1 respondida (no existen); la consulta de versiones no es ejecutable porque supabase_migrations no existe]**

## 7. Actualización: validación autenticada de solo lectura (8 de noviembre de 2026)

Instrucción recibida: completar las validaciones autenticadas **sin modificar nada** en producción y sin crear cuentas ni cambiar roles. Se preparó todo; **no se ejecutó ningún caso autenticado**, porque en este turno no hay una sesión iniciada por el usuario y Claude no ingresa ni recibe credenciales.

### 7.1 Casos autenticados ejecutados

**Ninguno.** Lo único ejecutado con acceso a producción sigue siendo lo del §2 (anónimo, sin escritura). Evidencia nueva de este paso: ninguna lectura contra Supabase; solo se preparó material.

### 7.2 Material preparado

| Entregable | Ubicación | Contenido |
| --- | --- | --- |
| Protocolo de lectura en producción | `docs/protocolo-bloque-2-lectura-produccion.md` | Reglas (qué no pulsar), clasificación de los 28 casos, pasos S1 a S11 para la sesión del CEO, G1 a G5 para gerente y E1 a E6 para empleado, registro de resultados |
| Consultas SQL de solo lectura | `supabase/queries/bloque-2-solo-lectura.sql` | Q1 a Q13: `staff_legacy` e `is_staff()`, versiones de migraciones, RLS, políticas, privilegios de funciones, `security definer` sin `search_path`, cuentas por rol sin correos, lecturas por cuenta con `ROLLBACK`, triggers y Storage. Solo `SELECT` |

### 7.3 Clasificación de los casos

| Grupo | Casos | Estado |
| --- | --- | --- |
| Lecturas autenticadas | C-00, ANO-03, EMP-01, EMP-05, GER-04, GER-05, GER-06, CEO-01, CEO-02, CEO-05, SEC-01 | **Pendientes** de la sesión del usuario (ANO-03 ya hecho como anónimo) |
| Comprobaciones de permisos sin escritura | ANO-01, ANO-02, EMP-02, EMP-06 (lecturas), GER-02 (`admin_list_users`), SEC-02 a SEC-04 | ANO-01 y ANO-02 **ejecutados** (aprobados); el resto pendiente de la sesión o del SQL |
| Escritura | EMP-04, GER-01, GER-03, EMP-03, CEO-04, SEC-05 y las escrituras de EMP-06 y GER-02 | **No ejecutables en producción** |
| Destructivas | EMP-07, CEO-03, ADM-01 | **No ejecutables en producción** |

### 7.4 Cuentas y roles

**[HISTÓRICO, superado el 8 de noviembre de 2026: RESUELTO: una sola cuenta, CEO activo con perfil; sin gerente ni empleado]** **Sin identificar.** Solo se sabe, por la documentación, que existe la cuenta CEO (correo no registrado). Si existen cuentas de gerente y empleado se resuelve con las consultas Q10a, Q10b y Q10c (recuentos y `user_id`, sin correos), o con la pantalla Usuarios con la sesión del CEO. Hasta entonces la validación de Manager y Employee queda **pendiente**; no se crean usuarios ni se cambian roles.

### 7.5 Consultas SQL pendientes de ejecutar (por el usuario, en el SQL Editor)

| Prioridad | Consultas | Para qué |
| --- | --- | --- |
| 1 | Q1, Q2 | Resolver la duda de `staff_legacy` e `is_staff()` y conocer las versiones de migraciones **[HISTÓRICO, superado el 8 de noviembre de 2026: Q1 respondida; Q2 no es verificable en este proyecto]** |
| 2 | Q10a, Q10b, Q10c | Saber si existen gerente y empleado, sin ver correos |
| 3 | Q3 a Q9 | RLS, políticas, privilegios de funciones y de tablas |
| 4 | Q11 (una por rol) | Permisos por rol con la cuenta suplantada, con `ROLLBACK` |
| 5 | Q12, Q13 | Triggers y Storage |

### 7.6 Riesgos que siguen requiriendo un entorno aislado

1. **Escrituras permitidas por rol** (venta, stock, productos, fotos): solo se pueden verificar escribiendo.
2. **Rechazo de escrituras prohibidas** (EMP-07, SEC-05, EMP-03, CEO-04): probarlas en producción arriesga escribir si un permiso estuviera mal.
3. **Cambios de rol y desactivación de cuentas** (CEO-03, ADM-01): modifican usuarios existentes.
4. **Ventas reales de empleado:** permanentes; sin anulación.
5. **Elevación de privilegios por la API desde un cliente real:** solo se prueba con intentos de escritura.

### 7.7 Estado de los criterios de aprobación

Sin cambios respecto del §5: **el Bloque 2 NO está aprobado.** Faltan validaciones obligatorias (criterios 1, 3, 4, 5 y 6 en parte).

### 7.8 Cómo continuar

1. El usuario corre Q1, Q2 y Q10a a Q10c en el SQL Editor y pega los resultados como texto.
2. El usuario inicia sesión como CEO y recorre S1 a S11; opcionalmente Claude lee la pantalla (sin teclear credenciales ni pulsar acciones).
3. Según Q10, se repite para gerente y empleado o se deja pendiente.
4. Para los casos de escritura y destructivos: decidir entre un proyecto aparte (informe del Bloque 2, §4) y dejarlos como riesgo aceptado.
