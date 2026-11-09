# Etapa 0, Bloque B: validación funcional consolidada (producción, solo lectura)

Fecha: 8 de noviembre de 2026. Proyecto: `nogufedcmkjphiqyyriz` (producción). **No se declara cerrada la Etapa 0.**

**Restricciones cumplidas:** solo lectura. Se usó el conector de Supabase únicamente con `SELECT`. No se crearon usuarios; no se modificaron perfiles, productos, categorías, stock, ventas ni imágenes; no se ejecutó ninguna función que escriba; no se aplicaron migraciones; no se solicitó ni expuso ninguna credencial; no hubo commit, push ni deploy. No se repitieron Q1, Q2 ni Q10a/b/c. **No se dispone de una sesión CEO autenticada** (el usuario no inició sesión y Claude no ingresa credenciales): por eso los pasos S2 a S10 **no se ejecutaron ni se simularon**; quedan para que los haga el usuario con su sesión.

**Convención:** **[O]** observado hoy; **[H]** evidencia anterior; **[N]** no verificable o no ejecutado.

## 1. Pruebas realizadas

| ID | Prueba | Evidencia | Interpretación | Resultado |
| --- | --- | --- | --- | --- |
| **Q9** | Privilegios de tabla (`information_schema.role_table_grants`) para `anon` y `authenticated` | `anon`: **solo `SELECT` sobre las 5 vistas públicas** (`public_catalog`, `public_categories`, `public_product_images`, `public_product_variants`, `public_promo_banners`) y nada sobre las 11 tablas. `authenticated`: `SELECT, INSERT, UPDATE, DELETE` sobre `categories`, `payment_methods`, `product_images`, `product_variants`, `products`, `promo_banners`; **solo `SELECT`** sobre `audit_log`, `profiles`, `sales`, `sale_items`, `stock_movements`; `SELECT` sobre las 5 vistas | Coincide con el diseño: los datos sensibles son de solo lectura para toda cuenta; las escrituras de ventas, movimientos, perfiles y auditoría solo pasan por funciones | **Aprobada** |
| **Q9b** | ACL real de cada tabla, vista y secuencia (`relacl`) | Tablas: propietario `postgres` y `service_role` (valores por defecto de Supabase); `authenticated` con `r` (lectura) o `arwd` (catálogo y medios de pago); **ninguna tabla con ACL para `anon`**; vistas con `anon=r` y `authenticated=r`. **Secuencias** `audit_log_id_seq`, `sales_number_seq` y `stock_movements_id_seq`: `anon`, `authenticated` y `service_role` con `rwU` | Las tablas están bien. Las secuencias conservan el permiso por defecto de Supabase: ver hallazgo N1 | **Aprobada con observación** |
| **ST-1** | Condiciones reales de las 8 políticas de `storage.objects` | Las 8 son para `authenticated`; todas exigen `bucket_id = 'product-images'` **y** `has_role_at_least('gerente')`; 4 limitadas al prefijo `products/%` (leer, subir, actualizar, eliminar) y 4 a `banners/%` o `categories/%`. `UPDATE` con `USING` y `WITH CHECK` iguales. **Ninguna política para `anon`.** Ningún permiso para otros prefijos ni otros buckets | Un empleado no puede leer, subir, cambiar ni borrar archivos; un gerente o CEO solo bajo los tres prefijos. La lectura pública de las fotos funciona por el bucket público, no por políticas (por eso el listado anónimo da 0 elementos) | **Aprobada** |
| **ST-2** | Configuración del bucket | `product-images`: público, límite **5.242.880 bytes (5 MB)**, tipos permitidos `image/jpeg`, `image/png`, `image/webp` | Límite y tipos aplicados en el servidor, no solo en el panel | **Aprobada** |
| **P-1** | Condiciones de las 22 políticas de `public` | Todas usan `has_role_at_least(...)` o `auth.uid()`; el rol sale de `current_app_role()` (lee `profiles` con `auth.uid()` y `active`). Mapa: lectura de categorías y medios de pago desde `empleado`; escritura de catálogo, categorías, banners y medios de pago desde `gerente`; `sales_read_own` (`user_id = auth.uid()` y empleado) y `sales_read_all` (gerente); `sale_items_read` por `EXISTS` sobre `sales` (hereda su RLS); `stock_movements_read` gerente; `profiles_read_own` y `profiles_read_managers`; `audit_read_own` (empleado), `audit_read_catalog` (gerente, 5 tablas) y `audit_read_all` (**CEO**) | Coincide **fila por fila** con la matriz de `autorizacion-roles.md` §2 | **Aprobada** |
| **F-1** | Definiciones reales de `current_app_role`, `has_role_at_least`, `can_manage_stock`, `scan_require_employee` | `current_app_role` = rol de `profiles` con `user_id = auth.uid()` **y `active`**; `has_role_at_least` = `coalesce(current_app_role() >= min_role, false)`; las cuatro son `security definer` con `search_path` vacío; `scan_require_employee` lanza `42501` «No autorizado» si no se alcanza `empleado` | Una cuenta inactiva o sin perfil no tiene rol (falso); el rol **no** sale del token ni de `user_metadata`. Es lo documentado | **Aprobada** |
| **C-1** | Contraste de los permisos efectivos del **CEO** con la documentación (análisis de las condiciones; **no** con una sesión) | Como `ceo > gerente > empleado`, las políticas de P-1 y ST-1 dan al CEO todo lo del gerente; `audit_read_all` y las funciones `admin_*` (que exigen `ceo`) son exclusivas. Matriz documentada y condiciones reales coinciden | La coincidencia es de **diseño**. **No prueba** que la sesión real del CEO lo experimente así: eso es S2 a S10 | **Aprobada como análisis; no sustituye S2 a S10** |
| **S1** | `/panel` sin sesión (servidor local de producción, `main`, Supabase real, sin iniciar sesión) | Redirige a `/panel/login`; sin sesión guardada en el navegador (`mp-panel-*`: 0 claves); hay formulario de contraseña | Protección de ruta **del lado del cliente** operativa: coincide con la decisión documentada de no usar `@supabase/ssr` | **Aprobada** |
| **S11 (parcial)** | Acceso por URL sin sesión a `/panel/usuarios` y `/panel/productos` | Ambas terminan en `/panel/login`; no se muestra contenido de usuarios ni de productos | Las rutas protegidas no entregan datos sin sesión. **Falta** el caso «cerrar sesión y volver con Atrás» (necesita sesión) | **Aprobada parcialmente** |
| **D-1** | Totales de datos de producción (recuentos agregados, sin datos personales) | Productos 10 (1 publicado y no archivado, 9 despublicados, 1 archivado), variantes 10, fotos 1, categorías 4, banners 0, medios de pago habilitados 4, **ventas 5**, detalles de venta 5, movimientos de stock 10, auditoría 111, variantes con stock > 0: 5. Las 5 ventas son del **30 de octubre al 5 de noviembre de 2026**, de **una sola cuenta vendedora** | Sirven de **valores de referencia** para S4 a S7 (lo que la sesión CEO debería ver). También destapan el hallazgo N2 | **Informativa** |

## 2. Pruebas no ejecutadas y motivos

| ID | Prueba | Motivo |
| --- | --- | --- |
| S2 a S10 | Ingreso del CEO, perfil y rol, Dashboard, Productos, Usuarios (`admin_list_users`), ventas y movimientos, recarga, cambio de pestaña, cierre de sesión | **Sin sesión CEO** en el momento de este informe (no se simula ni se usan credenciales). **Actualización del 9 de noviembre de 2026:** el usuario las ejecutó y las informó por escrito; ver §8. Claude **no** las verificó con sesión propia |
| S11 (resto) | Cerrar sesión y volver con «Atrás» | Necesita sesión |
| Q11 | Lecturas con los permisos de una cuenta | Suplantar una sesión **equivale a simularla**; además faltan cuentas de gerente y empleado |
| G1 a G5, E1 a E6 | Gerente y empleado | No existen las cuentas (una sola: CEO). Crearlas no está autorizado |
| Escrituras y destructivas | Ventas, stock, productos, fotos, cambios de rol, desactivación | Prohibidas; sin entorno aislado |
| Comprobación de contenido de funciones `admin_*`, `confirm_sale`, etc. en producción | Solo se leyeron 4 funciones núcleo; el resto se verificó por existencia y permisos (informe del conector) | Fuera de alcance de este bloque; queda como mejora |

## 3. Evidencias obtenidas

- Resultados de Q9, la ACL de objetos, las 8 condiciones de Storage, la configuración del bucket, las 22 condiciones de política y las 4 definiciones de función, descritos en la tabla del §1 (consultas `SELECT` con el conector).
- Comprobación S1 y S11 parcial en un navegador sin sesión: ruta final `/panel/login` en las tres rutas (`/panel`, `/panel/usuarios`, `/panel/productos`).
- Recuentos de referencia de D-1.
- **No** se guardaron capturas, tokens, cookies ni correos. El identificador de la única cuenta no se repite en este informe.

## 4. Hallazgos

### 4.1 Bloqueantes

**Ningún defecto técnico bloqueante** apareció en esta pasada: privilegios, políticas, Storage y funciones núcleo coinciden con el diseño.

Lo que **sí bloquea el cierre** son validaciones obligatorias todavía no hechas (ver §7): sesión real del CEO, cuentas y pruebas de gerente y empleado, y el resto de la fase 0.4 y de infraestructura.

### 4.2 No bloqueantes

| # | Hallazgo | Detalle | Recomendación |
| --- | --- | --- | --- |
| N1 | **Permiso por defecto de `anon` y `authenticated` sobre 3 secuencias** (`rwU`: `audit_log_id_seq`, `sales_number_seq`, `stock_movements_id_seq`) | Es el valor por defecto de Supabase. Desde la API **no se puede invocar `nextval`** (no hay una función expuesta), así que no se identifica una vía de explotación. En un acceso SQL directo permitiría avanzar la numeración (huecos en el número de venta o en el libro) | Evaluar, con tu aprobación y como migración propia, `revoke usage` de esas secuencias a `anon` y `authenticated` (las funciones `security definer` seguirían funcionando). No urgente |
| N2 | **Hay 5 ventas en producción** (30 de octubre a 5 de noviembre; una cuenta vendedora) y 10 movimientos de stock | `estado.md` §4 dice que **nunca** se verificó una venta de punta a punta contra producción. Las ventas existen; se desconoce si fueron de prueba o reales. El historial es de solo agregado y no se pueden anular | **Requiere evidencia del usuario:** ¿fueron de prueba? Si lo fueron, documentarlo; sus movimientos contaminan cualquier informe y el stock inicial |
| N3 | 7 funciones de disparador o utilidad ejecutables por `anon` (informe del conector) | Sin vía de invocación ni datos | Opcional: revocar |
| N4 | Sin historial de versiones de migraciones; cierre `close_drop_staff` aplicado sin registro (operador y fecha desconocidos) | Ya documentado | Averiguar y anotar |
| N5 | Protección de rutas del panel **solo en el cliente** | Decisión documentada; la autoridad real es la base (RLS y funciones). Una ruta protegida carga su cascarón antes de redirigir | Mantener documentado; sin acción |
| N6 | Los `UPDATE` de Storage usan `USING` y `WITH CHECK` iguales | Correcto; se anota porque impide mover un objeto fuera del prefijo | Ninguna |

## 5. Riesgos residuales

1. **Roles gerente y empleado nunca validados** con cuentas reales ni en la plataforma; solo por diseño y pruebas en PGlite (253).
2. **CEO sin validación con sesión real** de menú, `admin_list_users`, cierre de sesión y reevaluación de sesión al volver a la pestaña.
3. **Escrituras y rechazo de escrituras prohibidas** sin probar en la plataforma (entorno aislado necesario).
4. **Punto de venta sin prueba física** (celular, cámara, lector, impresión) y sin prueba de corte de red real (H1, riesgos R1 a R7).
5. **CI nunca corrió en GitHub y no ejecuta las pruebas de base ni de concurrencia**; Vercel sin verificar.
6. **Datos de venta de prueba mezclados con producción** (N2).
7. **Cachés externas y copias** de las fotos retiradas (C1 y C2) sin verificar.
8. **Sin trazabilidad de operaciones manuales** (migraciones, cierre `staff`, registro de Auth, bajas de productos).
9. **Catálogo, banners y material comercial** de prueba, no definitivos.

## 6. Guía para que el usuario ejecute S2 a S10 con su sesión CEO

Seguir `docs/protocolo-bloque-2-lectura-produccion.md` §2 (reglas: no pulsar ninguna acción, no usar el escáner ni el punto de venta, no copiar tokens). **Valores de referencia para comparar** (de D-1):

| Paso | Qué mirar | Debería coincidir con |
| --- | --- | --- |
| S2, S3 | Menú de 7 secciones y rol CEO | Matriz de `autorizacion-roles.md` §2 |
| S4 | Dashboard con resúmenes de ventas y stock | 5 ventas históricas; variantes con stock: 5 |
| S5 | Productos | **10** en total (1 publicado, 9 despublicados, 1 archivado) |
| S6 | Usuarios (`admin_list_users`) | **1 cuenta**: CEO activo; **0** cuentas sin perfil |
| S7 | Ventas y movimientos | 5 ventas, 10 movimientos |
| S8, S9 | Recarga y cambio de pestaña | La sesión se conserva |
| S10 | Cerrar sesión | Vuelve a `/panel/login` |
| S11 | Con la sesión cerrada, `/panel/usuarios` y «Atrás» | Redirige al ingreso; «Atrás» no muestra datos |

Si algo no coincide, anotarlo como texto (sin capturas con datos personales) y **no corregirlo**.

## 7. Criterios de aceptación pendientes para cerrar la Etapa 0

| # | Criterio | Estado |
| --- | --- | --- |
| 1 | Sesión real del CEO validada (S2 a S11) | ~~Pendiente~~ **Informada como cumplida por el usuario el 9 de noviembre de 2026** (todos «sí»); con detalle parcial: sin cifras ni nombres en S2 a S5 y S7. Ver §8 |
| 2 | Validación de gerente y empleado con cuentas reales | **Pendiente** (no existen; requiere decidir cuentas de prueba o proyecto aparte) |
| 3 | Casos de escritura y de rechazo de escrituras en entorno aislado | **Pendiente** |
| 4 | Privilegios, RLS, políticas y Storage verificados contra la documentación | **Cumplido** en esta pasada (diseño); falta la comprobación con sesiones |
| 5 | Aclarar el origen de las 5 ventas de producción (N2) | ~~Pendiente~~ **Cumplido:** **Confirmado por el usuario el 9 de noviembre de 2026: las 5 ventas son de prueba.** Queda decidir qué hacer con ellas (ver §9) |
| 6 | Prueba física del punto de venta, impresión y corte de red real | **Pendiente** (fase 0.4) |
| 7 | CI corrida en GitHub y verificación en Vercel (cabeceras, CSP, `NEXT_PUBLIC_SITE_URL`, escáner bajo CSP) | **Pendiente** (necesita acceso) |
| 8 | C1 y C2: cachés externas y copias | **Pendiente de decisión** |
| 9 | Trazabilidad de las operaciones manuales (cierre `staff`, historial de migraciones) | **Pendiente** |
| 10 | Publicar el trabajo (push de `main`) y el despliegue | **No autorizado todavía** |
| 11 | Catálogo y banners definitivos | **Fuera del cierre técnico**; decisión del negocio |

**La Etapa 0 NO está cerrada.** Con esta pasada, el Bloque 2 pasa de «anónimo solamente» a «diseño de permisos verificado contra la plataforma»; lo que falta son las pruebas con sesiones reales.

## 8. Actualización del 9 de noviembre de 2026: resultados S1 a S11 informados por el usuario

Origen: las respuestas están escritas por el usuario en `docs/protocolo-bloque-2-lectura-produccion.md` §2 y §5. **No hay evidencia independiente**: Claude no tuvo sesión CEO y no las verificó. No se indicó la fecha ni la hora de ejecución.

| Paso | Informado | Contraste con lo esperado |
| --- | --- | --- |
| S1 | Sí | Coincide con lo observado por Claude el 8 de noviembre (redirige a `/panel/login`) |
| S2 | Sí | Sin detalle: no se sabe cuántas secciones vio (esperado: 7) |
| S3 | Sí | Sin detalle del rol mostrado (esperado: CEO) |
| S4 | Sí | Carga sin error |
| S5 | Sí | Sin cantidad (esperado: 10 productos) |
| S6 | «Solo hay una persona con acceso, la de aimpulse que se usa para test y desarrollo» | **Coincide** con el diagnóstico del conector: 1 cuenta de Auth, CEO activo con perfil, 0 cuentas sin perfil. Sin roles ni estados detallados |
| S7 | Sí | Carga sin error |
| S8 a S11 | Sí | Sesión conservada tras recargar y al volver a la pestaña; el cierre de sesión devuelve al ingreso; sin sesión, la ruta protegida redirige y «Atrás» no muestra datos |

**Interpretación:**
1. La sesión del CEO funciona de punta a punta según el usuario (ingreso, menú, lecturas, `admin_list_users`, persistencia, cierre y protección de rutas). Falta el detalle numérico para poder contrastarlo con D-1.
2. **Dato nuevo e importante:** la única cuenta con acceso es la **cuenta de AImpulse de prueba y desarrollo**, no una cuenta de un usuario real del negocio. Es coherente con que no existan gerente ni empleado y significa que **producción hoy no tiene ninguna cuenta operativa real**.
3. **N2 (las 5 ventas):** todas fueron hechas por una única cuenta vendedora. Como esa cuenta es la de prueba y desarrollo, es **muy probable** que las 5 ventas sean de prueba, pero **no es una confirmación**: sigue pendiente que el usuario lo diga expresamente. Hasta entonces se tratan como ventas de origen no confirmado. *(Superado el 9 de noviembre de 2026: **Confirmado por el usuario el 9 de noviembre de 2026: las 5 ventas son de prueba.** Ver §9.)*
4. Con esto, el criterio 1 (sesión del CEO) queda **cumplido según el usuario**. Los criterios 2, 3, 5 a 10 siguen pendientes.

**Pendiente de aclarar por el usuario (opcional, para cerrar el registro):** fecha de las pruebas; cuántas secciones y productos vio (S2 y S5); y si las 5 ventas del 30 de octubre al 5 de noviembre fueron de prueba.

**La Etapa 0 NO está cerrada.**

## 9. Actualización del 9 de noviembre de 2026: las 5 ventas de producción son de prueba

**Confirmado por el usuario el 9 de noviembre de 2026: las 5 ventas son de prueba.** Se hicieron con la cuenta de AImpulse de prueba y desarrollo, entre el 30 de octubre y el 5 de noviembre de 2026.

| Punto | Estado |
| --- | --- |
| Origen de las 5 ventas | **De prueba** (confirmado por el usuario) |
| Ventas reales en producción | **Ninguna** (consistente con que no existe ninguna cuenta operativa real) |
| N2 | **Aclarado.** Sigue como no bloqueante, pero con una consecuencia de datos (abajo) |
| `estado.md` §4 («nunca se verificó una venta real contra producción») | **Sigue siendo cierto**: las 5 ventas son de prueba, no una venta real |

**Consecuencias:**
1. Las 5 ventas, sus 5 detalles y los **10 movimientos de stock** quedan en el historial de producción. El libro es de **solo agregado** (triggers `sales_no_change`, `sale_items_no_change`, `stock_movements_no_change` y `no_truncate`) y no hay anulación: **no se pueden borrar ni corregir desde la aplicación**.
2. Mientras no se decida otra cosa, cualquier informe de ventas del Dashboard (resúmenes) **incluye esas ventas de prueba**, y el stock actual de las 5 variantes con stock refleja esos movimientos.
3. **Decisión del negocio pendiente, antes de operar con ventas reales:** convivir con ese historial (marcándolo como de prueba en la documentación) o limpiarlo con un procedimiento controlado, con copia de seguridad previa y aprobación explícita. **No se hace nada ahora.**

La Etapa 0 NO está cerrada.
