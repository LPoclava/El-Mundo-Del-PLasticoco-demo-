# Punto de venta (escáner, carrito, stock y ventas)

Estado: **migración `20261031000001_pos_sales_and_stock.sql` aplicada en la base de producción** (confirmado por el equipo; una consulta de solo lectura confirma que existe `pos_find` y que rechaza a quien no tiene sesión). Antes de aplicarla se probó con PostgreSQL local (PGlite y un PostgreSQL real temporal). **Todavía no se hizo una venta real de punta a punta.**

## 1. Qué había antes (inspección)

- **No existía** ninguna tabla de ventas, de stock ni de movimientos: las variantes solo tenían `price`.
- El escáner del panel era una **maqueta con datos en memoria**, sin conexión a Supabase.
- En la base ya existían las funciones del empleado `scan_lookup`, `scan_set_price`, `scan_link_barcode` y `scan_create_product` (migración 8), el sistema de roles (`has_role_at_least`) y la auditoría (`audit_log`). Esas funciones **no estaban conectadas** a ninguna pantalla.

## 2. Modelo

| Objeto | Para qué |
| --- | --- |
| `product_variants.stock` (columna nueva, entero, ≥ 0) | Stock por variante: el precio ya vive ahí, así que se descuenta de la variante exacta que se cobró. Valor inicial 0: **ningún producto existente es vendible hasta cargarle stock**. |
| `payment_methods` | Medios de pago como datos: efectivo, transferencia, débito, crédito y «otro» (deshabilitado). Habilitar o agregar uno no toca la lógica de venta. |
| `sales` | Una fila por venta: número, fecha, usuario, medio de pago, total, estado e `idempotency_key`. |
| `sale_items` | Una fila por artículo con **copia** del nombre, código, variante y precio vigentes al vender, la cantidad y el subtotal. |
| `stock_movements` | Registro de cada cambio de stock (venta, ajuste o inicial), con stock resultante, usuario y venta asociada. |
| `pos_find(texto)` | Búsqueda para vender (por código exacto o por nombre): devuelve nombre, código, foto, variantes con precio y stock. |
| `confirm_sale(clave, medio, líneas)` | Confirmación atómica (ver sección 4). |
| `adjust_stock(variante, delta, nota)` | Ajuste de stock por gerente o superior, con nota. |

No se crearon tablas duplicadas: se reutilizan `product_variants`, `products`, `profiles`, `audit_log` y las funciones `scan_*`.

## 3. Cómo se representa y actualiza el stock

- El stock vive en `product_variants.stock` y **solo baja cuando una venta se confirma** (agregar al carrito no descuenta nada).
- La base impide el stock negativo con una restricción `CHECK (stock >= 0)`, incluso si alguien escribe directo.
- **Todo cambio de stock deja un movimiento**, venga de una venta, de `adjust_stock` o de una edición directa de un gerente: lo registra un disparador en la tabla.
- El empleado **no tiene permisos de escritura** sobre las tablas: solo puede llamar a `pos_find` y `confirm_sale`.

## 4. Cómo se protege la confirmación

`confirm_sale` corre en **una sola transacción** (función `SECURITY DEFINER` con `search_path` fijo):

1. Valida que haya sesión y un perfil activo de empleado, gerente o CEO (si no, `42501`).
2. Valida el medio de pago (existente y habilitado), el formato de las líneas (UUID, cantidad entera de 1 a 9999, hasta 100 líneas) y suma las líneas repetidas de una variante.
3. **Bloquea las variantes** de la venta en orden (`FOR UPDATE`) y recién entonces comprueba precio, archivado y stock. Dos ventas simultáneas del mismo artículo se serializan: la segunda ve el stock ya descontado. El orden evita bloqueos cruzados.
4. Calcula el **total en el servidor** con los precios de la base. El navegador solo envía el precio que vio (`expected_price`): si cambió, la venta se rechaza y se informa el precio nuevo.
5. Registra la venta, su detalle, descuenta el stock y deja los movimientos.
6. Si cualquier paso falla, **no queda nada** (ni venta ni descuento).

Los rechazos devuelven `SALE_REJECTED` con un JSON de problemas (`INSUFFICIENT_STOCK`, `PRICE_CHANGED`, `NO_PRICE`, `ARCHIVED`, `NOT_FOUND`, `PAYMENT_METHOD`, `QUANTITY`), que la pantalla muestra en lenguaje claro y usa para actualizar el carrito sin vaciarlo.

**Idempotencia (doble clic y reintentos):** el navegador genera una clave por intento de venta. Repetir la misma clave devuelve la venta ya registrada (`replayed: true`) sin crear otra ni descontar dos veces; la clave es única por usuario. La pantalla además ignora un segundo clic mientras hay un envío en curso, conserva la clave si el carrito no cambió, y la cambia si se edita algo.

**Historial inmutable:** `sales`, `sale_items` y `stock_movements` son de solo agregado (disparadores que rechazan `UPDATE`, `DELETE` y `TRUNCATE`, incluso del propietario). La única excepción es que la clave a un producto o variante pase a `null` si ese producto se borra: la venta conserva el nombre y el precio copiados. Una anulación futura tendrá que ser un registro compensatorio nuevo, nunca una edición.

## 5. Permisos (RLS)

| Rol | Puede |
| --- | --- |
| `empleado` | Buscar productos para vender, vender, ver **sus** ventas, ver los medios de pago habilitados. No lee stock directo, movimientos ni ventas ajenas, y no escribe nada fuera de `confirm_sale`. |
| `gerente` | Todo lo del empleado, más ver **todas** las ventas y los movimientos, administrar medios de pago y ajustar stock (`adjust_stock` o edición directa, ambos registrados). |
| `ceo` | Igual que el gerente, más lo ya definido en [autorizacion-roles.md](autorizacion-roles.md). |
| Sin sesión, sin perfil o perfil inactivo | Nada. |

No se usa `service_role` en el frontend ni se desactivó ninguna política. `confirm_sale` y `pos_find` no se pueden ejecutar sin sesión (`anon` no tiene permiso de ejecución).

## 6. Pantalla («Escáner y ventas»)

- Pestaña **Vender** (conectada a Supabase con sesión real, como «Banners promocionales») y pestaña **Consultar precios (demostración)**, la maqueta anterior.
- **Escáner continuo:** la cámara queda abierta entre lecturas. El mismo código que sigue a la vista no se vuelve a sumar; para otra unidad se usa el `+` del carrito o se retira y se vuelve a mostrar el código.
- Si el producto tiene **una sola variante vendible** va directo al carrito; si tiene varias, se elige cuál y qué cantidad. Los productos archivados, sin precio o sin stock **no llegan al carrito** y se explica por qué.
- Búsqueda manual por nombre o código, para cuando la cámara no lee.
- **Código inexistente:** mensaje claro, no se agrega nada y se ofrece «Registrar producto nuevo» (usa `scan_create_product`: queda sin publicar y **con stock 0, o sea no vendible** hasta que un gerente le cargue stock).
- **Carrito:** líneas con producto, variante, código, precio, cantidad y subtotal; `+`/`−`, cantidad escrita (solo enteros de 1 al stock), quitar, vaciar con confirmación y total automático.
- **Medio de pago obligatorio** (uno por venta; sin pagos mixtos). Sin pasarela ni datos de tarjeta.
- **Resultado:** comprobante con número, fecha, vendedor, productos, medio de pago, total y stock restante. El carrito se limpia **solo con la confirmación real del servidor**; si falla, se conserva.
- **Ventas recientes** con filtros por fecha y medio de pago (solo lectura).
- En celular: barra fija con el total y un botón «Ver carrito y cobrar».

## 7. Pasos manuales pendientes

1. ~~Aplicar la migración~~ Ya está aplicada en producción. Conviene hacer una primera venta de prueba con un producto real y su stock, y comprobar el descuento y el comprobante.
2. **Cargar el stock** de cada variante (sin eso nada es vendible). Un gerente puede hacerlo con `adjust_stock` desde el SQL Editor, por ejemplo: `select public.adjust_stock('<id de la variante>', 25, 'Stock inicial');`. Esta etapa **no incluye una pantalla** para cargar stock; conviene sumarla al formulario de productos cuando se conecte a Supabase.
3. Crear las cuentas de los empleados (Auth + `profiles`), como se explica en `autorizacion-roles.md`.
4. Si el negocio quiere «Otro medio»: `update public.payment_methods set enabled = true where code = 'otro';` (o agregar otros medios con `insert`).
5. Si Supabase rechaza crear los disparadores o políticas desde una migración, aplicar el mismo SQL desde el SQL Editor.

## 8. Cómo se probó

- **Base de datos, PGlite** (`cd supabase/tests && npm test`): 28 pruebas de `pos-ventas.test.mjs`. Cubren búsqueda, venta con varias líneas, total calculado por la base, descuento y movimientos, medios de pago, rechazo atómico por stock insuficiente, validaciones, idempotencia, historial inmutable (ni el superusuario edita), precios históricos tras editar o borrar un producto, y permisos de empleado, gerente, usuario inactivo, sin perfil, anónimo y rol falso en el token.
- **Concurrencia, PostgreSQL real** (`node concurrency.mjs`, ver cabecera del archivo): levanta un PostgreSQL temporal y prueba con conexiones separadas: 12 ventas simultáneas con stock 5 (exactamente 5 aceptadas), dos ventas de 3 con stock 5, la misma clave enviada 8 veces a la vez, 30 ventas con líneas en orden inverso (sin bloqueos cruzados) y una venta rechazada en paralelo con una válida.
- **Lógica del carrito** (`node --test scripts/pos-cart.test.mjs`): 12 pruebas.
- **Pantalla** en el navegador, contra una **API simulada** (no contra Supabase): escaneo, producto repetido, variantes, cantidades, quitar, cada medio de pago, doble clic, stock insuficiente, precio cambiado, corte de red con reintento, códigos sin precio/archivados/sin stock/inexistentes, alta de producto, vaciar, filtros de ventas, escaneo continuo con una cámara **sintética** y vista de celular.

**No se probó:** nada contra un Supabase real (Auth, PostgREST, Storage), ni con la cámara y el Chrome de un celular, ni con un lector de códigos físico.
