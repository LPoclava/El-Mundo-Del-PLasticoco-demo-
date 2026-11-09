# Plan de limpieza de datos de prueba en producción (PREPARACIÓN, sin ejecutar)

Fecha: 9 de noviembre de 2026. Proyecto de Supabase: `nogufedcmkjphiqyyriz`. **Nada de esto se ejecutó en producción.** El inventario se hizo con consultas `SELECT` por el conector. Los scripts se probaron **solo en una réplica local en memoria** (PGlite), nunca contra Supabase. No se hizo ningún `DELETE`, `UPDATE`, `INSERT`, `TRUNCATE`, `DROP` ni `ALTER` en producción; no se tocó ningún usuario, perfil, archivo, trigger ni política; no hubo commit, push ni deploy. **Se espera aprobación explícita antes de ejecutar nada.**

> **Actualización del 9 de noviembre de 2026 (instrucción final del usuario):** el alcance es **S2** y, para esta limpieza, el script **ya no crea el esquema `limpieza_respaldo_20261109` ni reinicia las secuencias**; el respaldo es **externo** y la recuperación sale de él. Las secciones 4, 5, 6 y 8 de abajo describen la preparación original y se conservan como historia; **vale lo que dice la §11 y el [informe final](informe-final-etapa-0.md)**.

**Archivos preparados** (sin ejecutar): `supabase/limpieza/20261109_limpieza_produccion.PROPUESTA.sql`, `supabase/limpieza/20261109_restauracion_desde_respaldo_en_base.PROPUESTA.sql`, `supabase/limpieza/huella_tablas.sql`, y la prueba de réplica `supabase/tests/limpieza-replica.mjs`. **[HISTÓRICO, superado el 9 de noviembre de 2026: ya no se crea ese esquema ni existe ese script; ver §11]**

## 1. Inventario

### 1.1 Resumen de tablas (producción, 9 de noviembre de 2026)

| Tabla | Filas | Clasificación |
| --- | --- | --- |
| `sales` | 5 | **Prueba** (confirmado por el usuario) |
| `sale_items` | 5 | **Prueba** (detalles de esas ventas) |
| `stock_movements` | 10 | **Prueba** (5 cargas de stock + 5 ventas) |
| `products` | 10 | Mixto: ver §1.3 |
| `product_variants` | 10 (1 por producto) | Siguen a su producto |
| `product_images` | 1 | Foto de «Juego de Cuchillos» |
| `categories` | 4 | **Estructura del sitio** (Cocina, Limpieza, Librería, Regalería): se conservan |
| `payment_methods` | 5 | **Configuración del sistema**: se conservan |
| `promo_banners` | 0 | Nada que borrar |
| `profiles` | 1 | **Cuenta administrativa: no se toca** |
| `audit_log` | 111 | **Se conserva entero** |
| `auth.users` | 1 | No se toca |
| Storage `product-images` | 2 archivos | Ver §7 |

### 1.2 Las cinco ventas de prueba (todas «confirmada», una sola cuenta vendedora)

| N.º | Fecha (UTC) | Medio | Total | Detalle |
| --- | --- | --- | --- | --- |
| 1 | 30 oct 23:12 | efectivo | 8.000 | Bolsas de residuos 80x90 × 2 |
| 2 | 1 nov 22:17 | efectivo | 15.000 | Medicamentos × 1 |
| 3 | 2 nov 03:37 | efectivo | 30.000 | Medicamentos × 2 |
| 4 | 2 nov 03:37 | crédito | 27.750 | Palitos × 15 |
| 5 | 5 nov 22:39 | efectivo | 5.000 | Mermelada × 2 |
| | | | **85.750** | 5 detalles |

### 1.3 Productos y clasificación por evidencia

| Grupo | Producto | Evidencia | Decisión propuesta |
| --- | --- | --- | --- |
| **A** (vendido en una venta de prueba) | Medicamentos | 2 ventas, 3 movimientos | Eliminar |
| A | Bolsas de residuos 80x90 | 1 venta, 2 movimientos | Eliminar |
| A | Palitos | 1 venta, 2 movimientos | Eliminar |
| A | Mermelada | 1 venta, 2 movimientos | Eliminar |
| **B** (stock cargado en pruebas, sin venta) | Gatorade 1.25L | 1 movimiento (entrada de 10) | Eliminar |
| **C** (material de prueba por el criterio general del 8 de nov, **sin evidencia individual**) | Juego de Cuchillos | Único publicado, con foto en Storage; sin ventas ni movimientos | **Requiere tu decisión** |
| C | Termos 700ml | Sin ventas ni movimientos; su foto ya se quitó | **Requiere tu decisión** |
| **D** (estado desconocido) | Libro Stephen king (archivado) | Sin ventas ni movimientos | **Requiere confirmación individual** |
| D | Galletas oreo | ídem | **Requiere confirmación individual** |
| D | Bebida Gatorade | ídem; su código `7172170110575` parece un error de tipeo de `7792170110575` (el de «Gatorade 1.25L») | **Requiere confirmación individual** |

**No se asume que los 10 sean de prueba.** El script trae los grupos A y B activos y los grupos C y D comentados.

### 1.4 Otros registros

| Registro | Estado | Decisión propuesta |
| --- | --- | --- |
| Categorías | 4 principales, sin imagen; 5, 3, 1 y 1 productos | **Conservar** (estructura del sitio, no demostración) |
| Medios de pago | efectivo, transferencia, débito, crédito (activos) y «otro» (inactivo) | **Conservar** (configuración) |
| Banners | 0 | Nada |
| Cuenta administrativa | 1 CEO activo | **Intacta** |

### 1.5 Dependencias y restricciones de claves foráneas

| Relación | Regla | Efecto |
| --- | --- | --- |
| `product_variants.product_id → products` | `ON DELETE CASCADE` | Borrar un producto borra sus variantes |
| `product_images.product_id → products` | `ON DELETE CASCADE` | Borra las filas de fotos (no el archivo de Storage) |
| `sale_items.sale_id → sales` | `ON DELETE RESTRICT` | No se puede borrar una venta con detalle: primero el detalle |
| `stock_movements.sale_id → sales` | `ON DELETE RESTRICT` | Primero los movimientos |
| `sale_items.variant_id / product_id`, `stock_movements.variant_id` | `ON DELETE SET NULL` | Borrar un producto **sin** borrar las ventas deja esas columnas en `null` (el trigger lo permite) |
| `products.category_id → categories` | `ON DELETE RESTRICT` | Las categorías no se tocan |
| `sales.payment_method → payment_methods` | `RESTRICT` | Los medios de pago no se tocan |

**Orden correcto de borrado:** `sale_items` → `stock_movements` → `sales` → `products` (cascada a variantes y fotos).

### 1.6 Registros que NO se pueden borrar con los mecanismos actuales

`sales`, `sale_items` y `stock_movements` tienen triggers `BEFORE DELETE OR UPDATE` (`*_no_change`) que **rechazan todo borrado para todos los roles, incluido el propietario** (`42501`, «es de solo agregado»), y `*_no_truncate` que bloquean `TRUNCATE`. Solo permiten el `UPDATE` que pone en `null` `variant_id` o `product_id` (lo que hace la cascada de claves foráneas). **Comprobado en la réplica local: `DELETE` y `TRUNCATE` fallan incluso como superusuario.**

Por lo tanto, **las 20 filas del libro (5 ventas, 5 detalles, 10 movimientos) no se pueden eliminar sin deshabilitar esos triggers**. Eso es una excepción a la protección que **no se aplicó ni se aplicará sin tu aprobación expresa** (ver §9, decisión D2). `audit_log` es inmodificable y se conserva de todos modos.

### 1.7 Auditoría que se conserva

Las 111 filas, sin excepción. Contienen la historia de altas, cambios y bajas del catálogo. Solo se **agregan** filas: los borrados de productos y variantes quedan auditados por los triggers, más una fila de constancia de la limpieza (`table_name = 'limpieza_produccion'`). **El `audit_log` no audita `sales`, `sale_items` ni `stock_movements`**, así que esos borrados solo quedarían en la fila de constancia, en el respaldo externo y en el esquema de respaldo dentro de la base.

### 1.8 Cuenta administrativa

Un perfil (`ceo`, activo) y una cuenta de Auth. La limpieza no toca `profiles` ni `auth.users`, y el script aborta si cambia la cantidad de perfiles.

### 1.9 Hallazgo adicional: el `audit_log` fecha las operaciones manuales

El `audit_log` registra con fecha las operaciones que `estado.md` figuraba como «sin fecha». Todas por la API con el rol `ceo` (la única cuenta). No distingue entre una persona y una automatización. Horas en **UTC** (restar 3 para la hora de Argentina):

| Cuándo (UTC) | Qué registra |
| --- | --- |
| 8 nov 22:59:17 a 22:59:52 | 4 actualizaciones de categorías |
| 8 nov 23:05:42 | Cambio del nombre visible del perfil (`admin_set_display_name`) |
| 8 nov 23:07:50 y 23:07:52 | **2 banners borrados** (explica los 0 banners) |
| 9 nov 00:19:41 a 00:26:31 | 6 actualizaciones de productos (despublicaciones) |
| 9 nov 00:21:49 a 00:26:32 | **6** filas de fotos borradas: Bolsas (00:21:49), Bebida Gatorade (00:25:54), Libro Stephen king (00:26:03), Mermelada (00:26:13), Palitos (00:26:24) y Termos (00:26:32) |

**Dos observaciones:** (1) son **6** fotos, no 4: además de Termos, Mermelada, Palitos y Bolsas se quitaron las de «Bebida Gatorade» y «Libro Stephen king». (2) De la foto de Bolsas hay **una sola baja** en el `audit_log` (00:21:49 UTC del 9 de noviembre, es decir 21:21 del 8 de noviembre en Argentina). El cierre `close_drop_staff` no figura: el `audit_log` no registra cambios de estructura. **La documentación (`estado.md` §2 bis) todavía dice «fecha desconocida»; propongo actualizarla con estos datos si lo aprobás.**

## 2. Análisis de integridad

### 2.1 Stock actual y esperado

El libro es **consistente**: para las 10 variantes, el stock actual es igual a la suma de sus movimientos (0 inconsistencias). **No existe ningún movimiento anterior a las pruebas**: el primero (id 1, 30 de octubre) es una carga de 200 unidades de «Medicamentos», y todas las demás son cargas de prueba o ventas. Por eso **todo el stock existente nace de pruebas**: no hay stock real previo que preservar.

| Variante (producto) | Stock actual | Si se revierten solo las ventas | Tras limpieza completa (cargas y ventas) |
| --- | --- | --- | --- |
| Medicamentos | 197 | 200 | 0 (la variante se elimina) |
| Bolsas de residuos 80x90 | 98 | 100 | 0 (se elimina) |
| Palitos | 1.985 | 2.000 | 0 (se elimina) |
| Mermelada | 98 | 100 | 0 (se elimina) |
| Gatorade 1.25L | 10 | 10 | 0 (se elimina) |
| Las otras 5 variantes | 0 | 0 | 0 (se conservan si no entran en la lista) |

Con el alcance **S1** (grupos A y B) las 5 variantes con stock se eliminan junto con sus productos, y **las que quedan tienen stock 0 y ningún movimiento**: el estado queda consistente (stock = suma de movimientos = 0). La numeración de ventas y de movimientos se reinicia solo si el libro queda vacío.

### 2.2 Triggers y protecciones involucrados

| Protección | ¿La limpieza la toca? |
| --- | --- |
| RLS y políticas | **No** |
| `audit_log_no_change` y `audit_log_no_truncate` | **No** |
| `sales_/sale_items_/stock_movements_no_truncate` | **No** |
| `sales_/sale_items_/stock_movements_no_change` | **Sí, SOLO si se aprueba la excepción**: se deshabilitan dentro de una única transacción y se rehabilitan antes del `commit`; si algo falla, PostgreSQL deshace incluso el `ALTER TABLE ... DISABLE TRIGGER` |
| Triggers de auditoría del catálogo | No: siguen registrando los borrados |

## 3. Qué se conserva y qué se elimina (alcance recomendado S1)

| Se elimina (S1) | Se conserva |
| --- | --- |
| 5 ventas, 5 detalles, 10 movimientos | Estructura de tablas, relaciones, funciones, vistas |
| 5 productos (grupos A y B) con sus 5 variantes | RLS y políticas, permisos |
| (Fotos: no hay filas ni archivos de esos productos) | 4 categorías, 5 medios de pago |
| | 5 productos de los grupos C y D con sus variantes (hasta que los apruebes) |
| | La cuenta CEO y la configuración de Auth |
| | Estructura y configuración de Storage |
| | **Las 111 filas del `audit_log`** (y se agregan las de la limpieza) |

Alcance **S2** (todos los productos): se agrega la eliminación de los grupos C y D (5 productos más) y, con ellos, la foto de «Juego de Cuchillos» en Storage (ver §7).

## 4. Respaldo requerido (no se considera suficiente exportar solo los registros afectados)

Lo ejecuta el usuario: requiere la contraseña de la base, que **no se comparte por chat**. Guardar el respaldo **fuera de OneDrive y fuera del repositorio**.

### 4.1 Componentes

| # | Componente | Cómo | Para qué |
| --- | --- | --- | --- |
| 1 | **Huella de las tablas** (base de comparación) | `supabase/limpieza/huella_tablas.sql` en el SQL Editor, **inmediatamente antes** del respaldo; guardar la salida (conteos y hash MD5) | Probar luego que el respaldo es completo |
| 2 | **Respaldo completo de la base** (esquemas `public`, `auth` y `storage`) | `pg_dump` en formato personalizado (comandos abajo) | Datos, relaciones, estado de stock, políticas, funciones, triggers y la metadata de Storage |
| 3 | **Esquema solo** | `pg_dump --schema-only` | Verificar políticas, funciones y triggers sin datos |
| 4 | **Archivos de Storage** | Descargar los 2 objetos de `product-images` desde el panel de Storage (y los que existan el día de la limpieza) | La base guarda la metadata; el archivo físico vive aparte |
| 5 | **Configuración fuera de la base** | Guardar el JSON de `/auth/v1/settings` (consulta pública) y anotar a mano la configuración del bucket (público, 5 MB, `jpeg/png/webp`) y los ajustes del panel de Authentication | La configuración de Auth no está en la base |
| 6 | **Respaldo gestionado de Supabase** | Si el plan incluye copias diarias o PITR, comprobar en el panel que existe una **posterior** a la huella | Segunda red de seguridad (no sustituye al punto 2) |
| 7 | **Copia dentro de la base** | La crea el propio script en el esquema privado `limpieza_respaldo_20261109` | Restauración rápida; no es el respaldo principal  **[HISTÓRICO, superado el 9 de noviembre de 2026: ya no se crea ese esquema ni existe ese script; ver §11]** |

### 4.2 Comandos (cada uno en su bloque; reemplazar el valor entre corchetes en tu terminal, sin pegarlo en el chat)

```bash
export DB_URL="postgresql://postgres:[CONTRASEÑA]@db.nogufedcmkjphiqyyriz.supabase.co:5432/postgres"
```

```bash
pg_dump "$DB_URL" --format=custom --no-owner --no-acl --schema=public --schema=auth --schema=storage --file=respaldo_completo_2026-11-09.dump
```

```bash
pg_dump "$DB_URL" --schema-only --no-owner --no-acl --schema=public --file=esquema_public_2026-11-09.sql
```

```bash
sha256sum respaldo_completo_2026-11-09.dump esquema_public_2026-11-09.sql > respaldo_2026-11-09.sha256
```

Si la conexión directa no responde (IPv6), usar la cadena del «pooler» en modo sesión desde el panel de Supabase (Database → Connection string). Esos comandos **no escriben** nada en producción.

### 4.3 Verificación de integridad y de recuperación (todas deben pasar antes de aprobar la limpieza)

1. **Existencia y tamaño razonable:** los archivos existen; el `.dump` pesa del orden de megabytes (la base es chica); no está vacío.
2. **Hash recomputable:** `sha256sum -c respaldo_2026-11-09.sha256` devuelve `OK`.
3. **Legible:** `pg_restore --list respaldo_completo_2026-11-09.dump` lista las tablas `public.sales`, `public.sale_items`, `public.stock_movements`, `public.products`, `public.audit_log`, etc., sin error.
4. **Restauración de prueba en una base TEMPORAL y local** (nunca en producción): crear una base vacía (PostgreSQL local o un proyecto de Supabase descartable), crear los roles `anon`, `authenticated` y `service_role` si faltan, y restaurar con `pg_restore --no-owner --dbname=<base temporal>`.
5. **Huella idéntica:** correr `huella_tablas.sql` sobre la base restaurada. **Los conteos y los hashes de las 11 tablas deben coincidir con la huella del punto 1 de §4.1**, tabla por tabla. Una sola diferencia invalida el respaldo.
6. **Frescura:** correr la huella otra vez justo antes de empezar la limpieza; debe seguir igual a la del respaldo (si el `audit_log` creció, repetir el respaldo).
7. Anotar la ruta, el tamaño y el SHA-256 en `estado.md` (sin contraseñas).

## 5. Script SQL propuesto (sin ejecutar)

Archivo: `supabase/limpieza/20261109_limpieza_produccion.PROPUESTA.sql`. Una sola transacción que, **por defecto, termina en `ROLLBACK` (simulacro)**.

| Paso | Qué hace |
| --- | --- |
| 0 | Parámetros: ids exactos de las 5 ventas y de los productos (grupos A y B activos; C y D comentados), y el estado esperado |
| 1 | **Validaciones previas** (solo lectura): cantidades, suma de totales (85.750), ventas a borrar = todas las existentes, productos existentes, todo producto vendido en la lista, stock = suma de movimientos, CEO activo, triggers habilitados. Aborta ante cualquier diferencia |
| 2 | Copia en el esquema privado `limpieza_respaldo_20261109` (ventas, detalles, movimientos, productos, variantes, fotos y stock previo), sin acceso para `anon` ni `authenticated`  **[HISTÓRICO, superado el 9 de noviembre de 2026: ya no se crea ese esquema ni existe ese script; ver §11]** |
| 3 | **Excepción:** deshabilita solo los 3 triggers `*_no_change` |
| 4 | Borra: detalles → movimientos → ventas → productos (cascada a variantes y fotos) |
| 5 | **Rehabilita** los 3 triggers |
| 6 | Reinicia la numeración de ventas y movimientos solo si el libro quedó vacío |
| 7 | Fila de constancia en el `audit_log` (solo agrega) |
| 8 | **Validaciones posteriores** dentro de la transacción: libro vacío, productos de la lista eliminados, cantidades restantes, categorías, medios de pago y perfiles intactos, stock = suma de movimientos, 8 triggers de protección habilitados, `audit_log` sin pérdidas, RLS activo en todas las tablas |
| Fin | `rollback;` por defecto. Para aplicar de verdad: cambiar por `commit;` (**solo con aprobación explícita**) |

**Estrategia transaccional:** todo en una transacción; PostgreSQL deshace también los cambios de estructura (`DISABLE TRIGGER`, `CREATE SCHEMA`), así que **la protección nunca queda deshabilitada tras un error**. Bloqueo de tablas breve (`lock_timeout` 5 s, `statement_timeout` 60 s). Ejecutar en una ventana sin uso del panel.

### 5.1 Verificado en la réplica local (PGlite; no es Supabase)

Se reprodujo el estado de producción (5 ventas, 10 movimientos, stocks 197/98/1.985/98/10, cierre `staff` aplicado) y se probó el script. **16 de 16 comprobaciones pasan** (`supabase/tests/limpieza-replica.mjs`):

| Comprobación | Resultado |
| --- | --- |
| Sin el script, `DELETE` y `TRUNCATE` sobre el libro fallan (`42501`), incluso como superusuario | Pasa |
| El simulacro termina en `ROLLBACK` sin dejar nada | Pasa |
| Aplicado: libro vacío; se conservan los productos no listados con sus variantes y stock, categorías, medios de pago y perfil | Pasa |
| Los 8 triggers de protección quedan habilitados | Pasa |
| `audit_log` sin pérdidas; suma los 5 borrados de productos, los de variantes y la constancia | Pasa |
| Esquema de respaldo con 5 ventas, 10 movimientos y 5 productos; ilegible para `anon` y `authenticated` | Pasa |
| Numeración reiniciada (próxima venta n.º 1, próximo movimiento id 1) | Pasa |
| Después de limpiar, borrar ventas vuelve a fallar | Pasa |
| Una venta no inventariada, un producto vendido fuera de la lista o un esperado incorrecto **abortan** sin cambiar nada | Pasa |
| **Recuperación:** restaurar desde el esquema de respaldo deja ventas, detalles, movimientos, productos y variantes con el **mismo hash MD5** que antes de limpiar | Pasa |

Además, en producción (solo lectura) se verificó que los ids del script existen: 5 de 5 ventas, 5 de 5 productos, 0 ventas fuera de la lista, 0 productos vendidos fuera de la lista, suma de totales 85.750 y 0 variantes con stock inconsistente.

## 6. Validaciones posteriores (después de un `commit`)

Ejecutar de nuevo `huella_tablas.sql` y comparar:

| Tabla | Esperado tras S1 |
| --- | --- |
| `sales`, `sale_items`, `stock_movements` | 0 filas |
| `products` | 5 (grupos C y D) |
| `product_variants` | 5, todas con stock 0 |
| `product_images` | 1 (si se conserva «Juego de Cuchillos») |
| `categories` | 4 (huella **idéntica** a la previa) |
| `payment_methods` | 5 (huella idéntica) |
| `profiles` | 1 (huella idéntica) |
| `promo_banners` | 0 |
| `audit_log` | **más de 111** (111 originales, idénticas, más las nuevas) |

Y además: los 8 triggers de protección en estado `O` (habilitados), RLS activo en las 11 tablas, `select * from public.sales` con la clave pública devuelve 401, el catálogo público sigue respondiendo, el panel inicia sesión y el Dashboard muestra 0 ventas, y las pruebas (`npm test`, pruebas de base, `limpieza-replica.mjs`) siguen pasando.

## 7. Operaciones de Storage previstas (sin ejecutar)

| Archivo | Bytes | Estado | Propuesta |
| --- | --- | --- | --- |
| `products/599082c4-33ce-4b5a-b7ab-63896b793cc2/e146a9eb-cc13-44c3-a754-82420af8c3dd.webp` | 9.152 | Foto de «Juego de Cuchillos» (grupo C) | **Solo si se aprueba eliminar ese producto:** quitarla **antes** de borrarlo, desde el panel («Quitar la foto» + Guardar), que borra la fila y luego el archivo. Con S1 **no se toca** |
| `categories/b9cde881-31b6-42a0-a211-aae6e4e266cf.webp` | 79.308 | **Huérfano**: ninguna categoría lo referencia (`image_path` nulo en las 4) | **Decisión D3:** conservar o borrar. No es dato de demostración probado |

**Reglas:** no borrar archivos con SQL sobre `storage.objects` (dejaría el archivo físico); usar el panel o la API de Storage con una sesión de gerente o CEO. Con S1 **no hay operaciones de Storage obligatorias**: los productos a eliminar ya no tienen fotos. Descargar antes ambos archivos (componente 4 del respaldo).

## 8. Procedimiento de recuperación

| Nivel | Cuándo | Cómo |
| --- | --- | --- |
| **0. Durante la ejecución** | Cualquier error | PostgreSQL deshace la transacción: no queda nada a medias ni triggers deshabilitados |
| **1. Desde la copia en la base** | Arrepentimiento tras el `commit`, con el esquema `limpieza_respaldo_20261109` aún presente | `supabase/limpieza/20261109_restauracion_desde_respaldo_en_base.PROPUESTA.sql` (simulacro por defecto; probada en la réplica: deja las tablas con el mismo hash). Reinserta las filas con sus números e ids; la numeración continúa  **[HISTÓRICO, superado el 9 de noviembre de 2026: ya no se crea ese esquema ni existe ese script; ver §11]** |
| **2. Desde el respaldo externo** | Si el esquema se perdió o hay corrupción | Restaurar el `.dump` en una base temporal, verificar la huella y reinsertar las tablas necesarias en producción (o restaurar el proyecto desde la copia gestionada de Supabase). **Requiere aprobación aparte** |
| **3. Storage** | Si se borró un archivo | Volver a subir el archivo descargado, con el mismo nombre, y volver a crear su fila de foto |

El esquema `limpieza_respaldo_20261109` queda en la base con datos de prueba: **eliminarlo cuando la limpieza esté aceptada** (`drop schema ... cascade`, con aprobación). **[HISTÓRICO, superado el 9 de noviembre de 2026: ya no se crea ese esquema ni existe ese script; ver §11]**

## 9. Riesgos, limitaciones y decisiones

### 9.1 Riesgos

| # | Riesgo | Mitigación |
| --- | --- | --- |
| 1 | La excepción a la protección «solo agregado» es una excepción **de una sola vez** sobre el libro | Solo con aprobación; en una transacción; guardas; 8 triggers verificados al final; respaldo previo |
| 2 | El `audit_log` no registra el borrado de ventas ni de movimientos | Fila de constancia, respaldo externo y esquema de respaldo; guardar la huella |
| 3 | Es irreversible sin respaldo | Respaldo verificado obligatorio (§4.3) |
| 4 | Las pruebas se hicieron en una réplica local, no en Supabase real | Simulacro (`rollback`) en producción antes del `commit` |
| 5 | El script depende del estado exacto inventariado | Las guardas abortan si cambió algo; repetir el inventario justo antes |
| 6 | Productos de los grupos C y D sin evidencia individual | Quedan comentados; decisión producto por producto |
| 7 | Reiniciar la numeración reutiliza números de venta | Solo si el libro queda vacío; no hay ventas reales |
| 8 | La limpieza no cubre cachés externas ni copias de imágenes (C1 y C2) | Sigue pendiente aparte |
| 9 | El stock real inicial deberá cargarse más adelante: tras la limpieza, todo es 0 | Cargar stock real con `receive_stock`, ya con ventas reales |

### 9.2 Decisiones que necesito de vos

| # | Decisión | Opciones |
| --- | --- | --- |
| **D1** | **Alcance de productos** | **S1** (recomendado por evidencia): grupos A y B (5 productos). **S2:** todos los productos (agrega C y D). **Personalizado:** indicar producto por producto |
| **D2** | **El libro (20 filas)** | **a)** Dejarlo como historial de prueba, marcado en la documentación (no se borran ventas ni movimientos; se pueden borrar productos, que quedan referenciados solo por su nombre en el detalle). **b)** Limpiarlo con la excepción controlada del script (recomendado: no hay ventas reales y la limpieza se hace antes de la primera). |
| **D3** | Archivo huérfano `categories/b9cde881….webp` | Conservar o borrar |
| **D4** | Respaldo | ¿Quién ejecuta `pg_dump`? ¿Qué plan de Supabase tenés (copias diarias o PITR)? |
| **D5** | Ventana | Cuándo ejecutar (sin uso del panel) |

## 10. Criterios de aceptación posteriores

La limpieza se acepta solo si se cumplen **todos**:

1. El respaldo fue verificado antes (§4.3) y su SHA-256 está registrado.
2. El simulacro (`rollback`) en producción mostró «Validaciones previas: OK» y «Validaciones posteriores: OK» sin error.
3. Tras el `commit`, las huellas coinciden con lo esperado (§6): libro vacío, categorías, medios de pago y perfil **idénticos**, `audit_log` con las 111 filas originales idénticas más las nuevas.
4. Los 8 triggers de protección están habilitados, RLS activo en las 11 tablas y las políticas sin cambios (Q3, Q4 y Q9 sin diferencias).
5. La clave pública sigue sin leer tablas protegidas y el catálogo público responde.
6. El panel inicia sesión con la cuenta CEO y el Dashboard muestra el estado esperado.
7. No quedan variantes con stock distinto de la suma de movimientos.
8. Las pruebas automáticas siguen pasando.
9. `estado.md` y `decisiones.md` registran lo hecho, con fecha y operador.
10. Se acordó qué hacer con el esquema `limpieza_respaldo_20261109` (eliminarlo tras la aceptación). **[HISTÓRICO, superado el 9 de noviembre de 2026: ya no se crea ese esquema ni existe ese script; ver §11]**

**No se ejecutó nada. Se espera tu aprobación explícita, y las decisiones D1 a D5, antes de cualquier operación.**

## 11. Actualización del 9 de noviembre de 2026: alcance S2 autorizado, respaldo y simulacro hechos

**Decisiones resueltas por el usuario:** D1 = **S2** (todos los productos); D2 = **limpiar el libro** con la excepción controlada; D3 = el archivo huérfano se **respalda y se elimina**; la foto de «Juego de Cuchillos» se respalda y se elimina con su producto. Todo lo cargado es de prueba. *(El texto de arriba se conserva como historia: las secciones 1 a 10 describen la preparación original, con S1 como recomendación.)*

| Qué | Resultado |
| --- | --- |
| Script de limpieza | Actualizado a S2 (los 10 productos) **y a la versión final: sin esquema de respaldo ni reinicio de secuencias**, con instantánea y control de estructura, de contenido de categorías, medios de pago y perfil, de las 111 filas originales del `audit_log` y de que no queden variantes ni fotos. Defecto corregido: faltaba `audit_max` en la instantánea (lo detectó el simulacro) |
| Respaldo | Hecho y verificado: ver [registro-respaldo-limpieza.md](registro-respaldo-limpieza.md). **Copia lógica** (no `pg_dump`) |
| Simulacro | **13 de 13** sobre la copia restaurada de producción, con el script real final |
| Recuperación | Probada **desde el respaldo externo** (`generar_restauracion.mjs`): 9 tablas vuelven con la misma huella. El script de recuperación desde un esquema dentro de la base **se eliminó** |
| Storage | **Bloqueado para Claude:** el trigger `protect_objects_delete` impide borrar con SQL; requiere la API o el panel de Supabase con una sesión con permisos |
| Ejecución en producción | **Pendiente de la confirmación final** |

Cómo se ejecutaría tras la confirmación: (1) repetir las huellas de producción y comprobar que no cambiaron; (2) correr el script **con `commit;` en lugar de `rollback;`** (si las guardas detectan cualquier cambio, aborta sin tocar nada); (3) verificar las huellas y los controles posteriores; (4) borrar los 2 archivos de Storage con una sesión con permisos y comprobar que el bucket queda vacío; (5) comprobar el catálogo público (anónimo) y el acceso al panel con la sesión del usuario; (6) conservar el respaldo externo según lo decida el usuario (la limpieza no deja nada que eliminar en la base).
