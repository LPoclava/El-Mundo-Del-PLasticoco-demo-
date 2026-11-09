# Protocolo del Bloque 2: validación autenticada de solo lectura en producción

Fecha de preparación: 8 de noviembre de 2026. Destino: el Supabase de producción (referencia `nogufedcmkjphiqyyriz`). **Nada de este protocolo escribe datos.** Complementa [informe-bloque-2-entorno-prueba.md](informe-bloque-2-entorno-prueba.md) y [informe-bloque-2-diagnostico-supabase-existente.md](informe-bloque-2-diagnostico-supabase-existente.md). Las consultas SQL están en `supabase/queries/bloque-2-solo-lectura.sql`.

## 0. Reglas

1. **Las credenciales las escribe solo quien es dueño de la cuenta, directamente en el formulario.** Claude no pide, recibe, guarda ni automatiza contraseñas, cookies ni tokens, y no copia valores de `Authorization`, `apikey` ni de `localStorage`.
2. **Prohibido pulsar** en cualquier pantalla: Guardar, Despublicar, Archivar, Publicar, Eliminar, Quitar foto, Dar acceso, Cambiar rol, Desactivar, Confirmar venta, Ajustar o Recibir stock, y cualquier botón que cree o cambie algo. Si un botón no está en la lista de «permitidos», no se pulsa.
3. No usar el escáner ni el punto de venta (`/panel/precios`): cargarlo no escribe, pero un clic de más sí.
4. Evidencia: **texto** (rol, cantidades, códigos de respuesta, mensajes). Sin capturas que muestren datos personales. Sin copiar tokens.
5. Si algo escribe o cambia sin querer, **parar** y avisar; no intentar corregirlo.

## 1. Clasificación de los 28 casos del informe del Bloque 2

| Grupo | Casos | ¿Se ejecuta en producción? |
| --- | --- | --- |
| **Lecturas autenticadas** | C-00, ANO-03, EMP-01, EMP-05, GER-04, GER-05, GER-06, CEO-01, CEO-02, CEO-05, SEC-01 | **Sí**, con sesión real, sin pulsar acciones |
| **Comprobaciones de permisos (rechazos, sin escritura)** | ANO-01, ANO-02, EMP-02, EMP-06 (solo las lecturas), GER-02 (solo `admin_list_users`), SEC-02, SEC-03, SEC-04 | **Sí.** ANO-01 y ANO-02 ya están hechos (anónimo). Las demás con sesión y con las consultas SQL de solo lectura |
| **Operaciones de escritura** | EMP-04 (venta), GER-01 (crear producto y subir foto), GER-03 (entrada y ajuste de stock), EMP-03 (cambiar el propio rol), EMP-06 (`receive_stock`, `adjust_stock`), GER-02 (`admin_create_profile`), CEO-04 (cambiar el propio rol o desactivarse), SEC-05 (escribir `profiles` o `audit_log`) | **No.** Necesitan un entorno aislado. **Pendientes** |
| **Destructivas** | EMP-07 (`update`/`delete` sobre ventas y detalle), CEO-03 (cambiar el rol de otra cuenta), ADM-01 (desactivar una cuenta) | **No.** Alteran historial o cuentas reales. **Pendientes** |

Aun cuando un intento de escritura debería ser rechazado, **no se prueba en producción**: si el permiso estuviera mal, la prueba habría escrito.

## 2. Sesión del CEO (la hace el usuario)

Usar el navegador de siempre (o el del panel de la aplicación de escritorio, si preferís que Claude pueda **leer** la pantalla después). Ingresar la contraseña vos. Claude, si se lo pedís, solo lee y describe lo que hay en pantalla, sin teclear credenciales ni pulsar acciones.

| # | Paso | Resultado esperado | Anotar | Resultado informado por el usuario (9 nov 2026) |
| --- | --- | --- | --- | --- |
| S1 | Abrir `/panel` sin sesión | Redirige a `/panel/login` | Sí / No | **Sí** |
| S2 | Iniciar sesión con la cuenta CEO | Entra al Dashboard; el menú muestra las 7 secciones: Dashboard, Escáner y ventas, Control de stock, Productos, Categorías, Banners promocionales, Usuarios y permisos | Secciones visibles | **Sí** (sin detalle de las secciones) |
| S3 | Perfil y rol | La pantalla muestra el nombre y el rol **CEO** | Rol mostrado | **Sí** (sin indicar el rol mostrado) |
| S4 | Dashboard | Muestra los resúmenes de ventas y de stock (lecturas) | Carga sin error | **Sí** |
| S5 | Productos | Lista los productos, incluidos los despublicados y archivados. **Solo mirar** | Cantidad listada | **Sí** (sin indicar la cantidad; esperado: 10) |
| S6 | Usuarios | Lista las cuentas con correo, rol, estado y fechas (`admin_list_users`). **No pulsar «dar acceso» ni cambiar nada** | Cuántas cuentas, qué roles y estados, si hay cuentas sin perfil. **No pegar los correos** | «Solo hay una persona con acceso que es la de aimpulse que se usa para test y desarrollo» (textual) |
| S7 | Ventas y movimientos | Si el Inicio o Stock muestran ventas o movimientos, comprobar que cargan | Carga sin error | **Sí** |
| S8 | Recargar la página (F5) | La sesión se conserva | Sí / No | **Sí** |
| S9 | Cambiar de pestaña y volver | La sesión sigue o se reevalúa sin cerrar sesión | Sí / No | **Sí** |
| S10 | Cerrar sesión | Vuelve a `/panel/login` | Sí / No | **Sí** |
| S11 | Con la sesión cerrada, abrir `/panel/usuarios` por URL y usar «Atrás» | Redirige al ingreso; «Atrás» no muestra datos | Sí / No | **Sí** |

*Nota de registro (9 de noviembre de 2026): las respuestas las escribió el usuario en esta tabla. Para S2 a S5 y S7 respondió «sí» sin cifras ni nombres; Claude no las verificó con su propia sesión (no tiene una). La fecha y la hora en que se hicieron las pruebas no se informaron. Las filas S1 y S8 a S11 traían «Sí / No» en la plantilla y el usuario dejó «Sí»; la tabla se reordenó en una columna nueva sin cambiar el sentido de sus respuestas.*

**Comprobaciones de red (opcional, solo códigos):** en las herramientas del navegador, pestaña Red, anotar solo el código de respuesta de las llamadas a `admin_list_users`, `profiles` y `sales`. **No copiar** las cabeceras ni los valores de autorización.

**Resultados esperados de seguridad para el CEO:** `admin_list_users` responde 200; ninguna llamada devuelve 401 ni 403 en lo permitido.

## 3. Cuentas de gerente y empleado

**Paso previo, sin sesión de ninguna aplicación:** en el SQL Editor, correr las consultas **Q10a**, **Q10b** y **Q10c** de `supabase/queries/bloque-2-solo-lectura.sql`. Muestran cuántos perfiles hay por rol y estado, cuántas cuentas de Auth no tienen perfil y los `user_id` (sin correo). Con eso se sabe si existen.

| Si existe… | Qué se hace (solo lectura) |
| --- | --- |
| Una cuenta **gerente** | El titular inicia sesión él mismo y recorre G1 a G5. Alternativa sin sesión: Q11 con el `user_id` del gerente |
| Una cuenta **empleado** | Ídem, con E1 a E5. Alternativa: Q11 con su `user_id` |
| Ninguna de las dos | **Queda pendiente.** No se crean usuarios ni se cambian roles |

**Gerente (G):**

| # | Paso | Esperado |
| --- | --- | --- |
| G1 | Iniciar sesión | Entra; el menú tiene 6 secciones y no incluye Usuarios y permisos |
| G2 | Abrir `/panel/usuarios` por URL | Redirige al Dashboard |
| G3 | Productos, Categorías, Banners, Stock: **solo mirar** | Cargan |
| G4 | En SQL (Q11 con su `user_id`): `usuarios_listados` | Error `42501` «No autorizado» |
| G5 | Q11: `perfiles_visibles`, `ventas_visibles`, `movimientos_visibles` | Todos los perfiles, todas las ventas, todos los movimientos |

**Empleado (E):**

| # | Paso | Esperado |
| --- | --- | --- |
| E1 | Iniciar sesión | Entra; el menú solo muestra Dashboard y Escáner y ventas |
| E2 | Abrir `/panel/productos`, `/panel/usuarios` y `/panel/stock` por URL | Redirige al Dashboard |
| E3 | Q11 con su `user_id`: `productos_visibles`, `movimientos_visibles` | 0 y 0 |
| E4 | Q11: `perfiles_visibles` | 1 (solo el propio) |
| E5 | Q11: `ventas_visibles` | Solo las propias |
| E6 | Q11: `usuarios_listados` | Error `42501` «No autorizado» |

Q11 se ejecuta **una vez por cuenta** y, para gerente y empleado, la última línea (`admin_list_users`) hace fallar la transacción: es el resultado esperado. Si se quiere ver el resto de las columnas, correr Q11 sin esa última línea.

## 4. Consultas SQL de solo lectura

Todas están en `supabase/queries/bloque-2-solo-lectura.sql`. Solo `SELECT`, y Q11 usa una transacción con `ROLLBACK`.

| Consulta | Qué comprueba | Esperado |
| --- | --- | --- |
| Q1 | `staff`, `staff_legacy` e `is_staff()` | **Resultado ya obtenido el 8 de noviembre de 2026 con el conector: los tres no existen** (cierre aplicado; operador y fecha desconocidos). No hace falta repetirla |
| Q2 | Versiones de migraciones registradas | Las 19 (o ninguna si se aplicaron a mano; en ese caso se compara por objetos) |
| Q3 | RLS por tabla | `rls_activa = true` en todas |
| Q4 y Q5 | Políticas RLS; ninguna con `is_staff` | Políticas por rol; Q5 devuelve 0 filas |
| Q6 a Q8 | Privilegios de ejecución, `security definer` sin `search_path`, funciones ejecutables por anónimo | Q7 con 0 filas; Q8 sin `admin_*`, `scan_*`, `pos_find`, `confirm_sale`, `receive_stock`, `adjust_stock`, `sales_summary` |
| Q9 | Privilegios de tabla de anónimo y autenticado | Anónimo sin nada; autenticado solo lo previsto |
| Q10a a Q10c | Existencia de cuentas y roles (sin correos) | Al menos un CEO activo; indica si hay gerente y empleado |
| Q11 | Lecturas con los permisos de cada cuenta | Ver §3 |
| Q12 | Triggers de protección y auditoría | `profiles_guard`, triggers de auditoría y de inmutabilidad activos |
| Q13 | Storage | Bucket público; políticas por rol |

## 5. Registro de resultados

| Fecha | Quién ejecutó | Caso o consulta | Resultado (texto) | ¿Coincide con lo esperado? |
| --- | --- | --- | --- | --- |
| 9 nov 2026 (informado; fecha de ejecución no indicada) | Usuario | S1 a S11 con la sesión CEO | Todos «sí»; S6: única cuenta con acceso, la de AImpulse usada para prueba y desarrollo | Sí, con detalle parcial (sin cifras en S2 a S5 ni S7) |
| 8 nov 2026 | Claude (sin sesión) | S1 y S11 parcial, sin sesión | `/panel`, `/panel/usuarios` y `/panel/productos` terminan en `/panel/login` | Sí |

**No se registra:** contraseñas, tokens, cookies, correos completos de terceros ni capturas con datos personales.
