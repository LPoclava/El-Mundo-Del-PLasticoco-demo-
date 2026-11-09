# Auditoría del circuito de venta (Etapa 0, fase 0.4)

Fecha: 8 de noviembre de 2026. Rama local `etapa-0-estabilizacion`. Se leyó el código y las migraciones y se probó con PGlite, con un PostgreSQL temporal local y con pruebas de lógica. **No se ejecutó nada contra el Supabase de producción ni contra ningún proyecto real.** La prueba física y la prueba con Supabase real siguen pendientes (ver `protocolo-prueba-fisica-pos.md` y `proyecto-supabase-de-prueba.md`).

## 1. Arquitectura del circuito

```
Cámara / lector / teclado ──► BarcodeScanner ──► lookup() ──► pos_find (RPC)
                                                      │
              resultado: producto + variantes + precio + stock (vendible solo con precio, stock y no archivado)
                                                      ▼
                   addToCart (cart.ts) ──► borrador en sessionStorage (draft.ts)
                                                      ▼
   «Confirmar»: attemptSignature ► clave (UUID) por intento ► confirm_sale (RPC, UNA transacción)
                                                      │
        valida rol ► medio de pago ► formato de líneas ► bloquea variantes ► revisa precio/archivado/stock
        ► inserta sales ► por línea: inserta sale_items + descuenta stock ► (disparador) inserta stock_movements
                                                      ▼
                         devuelve el comprobante (sale_receipt) ──► pantalla «Venta concretada»
                                                      ▼
                          Imprimir (window.print, solo #comprobante) / Compartir (texto plano)
```

Principio: **el navegador es solo interfaz**. Precio, stock, total, permisos e idempotencia los decide PostgreSQL. El carrito se limpia únicamente con la confirmación del servidor.

## 2. Componentes y funciones

| Etapa | Archivo o función | Qué hace |
| --- | --- | --- |
| Búsqueda manual | `pos-section.tsx` (`onManualSubmit`, `lookup`) | Texto de 2 a 80 caracteres; un código de 8 a 14 dígitos busca exacto, un nombre muestra una lista para elegir |
| Lector físico | mismo campo de búsqueda | Un lector tipo teclado «escribe» el código y envía Enter: entra por la búsqueda manual (el campo debe tener el foco) |
| Escáner con cámara | `barcode-scanner.tsx`, `lib/barcode/*` | Lectura continua, EAN-13/8, UPC-A/E y Code 128; verifica el dígito verificador; el mismo código a la vista no se vuelve a sumar |
| Producto inexistente | `ResultPanel` (`kind: "unknown"`) | Mensaje claro; ofrece registrar un producto (`scan_create_draft`: sin publicar, sin variantes, no vendible) |
| Consulta | `pos_find` (RPC) | Hasta 12 productos con variantes, precio y stock; exige rol de empleado o superior |
| Disponibilidad | `sellable()` (`lib/pos/sellable.ts`) | Precio mayor que 0, stock mayor que 0 y no archivado; lo demás no llega al carrito y se explica |
| Carrito | `lib/pos/cart.ts` | Una línea por variante, no supera el stock, cantidades enteras de 1 a 9999 |
| Borrador | `lib/pos/draft.ts` | `sessionStorage`; un borrador dañado se descarta entero |
| Confirmación | `confirmSale` (`lib/pos/api.ts`) → `confirm_sale` | Envía `variant_id`, `quantity` y `expected_price` (el precio que vio la persona) |
| Errores | `lib/pos/errors.ts` (`describeSaleError`) | Distingue rechazo, sin permiso, datos inválidos y «no sabemos si se registró» |
| Medio de pago | `listPaymentMethods` + tabla `payment_methods` | Efectivo, transferencia, débito y crédito habilitados; «otro» deshabilitado |
| Comprobante | `sale_receipt` (SQL) y `SaleDone` (pantalla) | Ver sección 7 |
| Ventas recientes | `pos-recent-sales.tsx`, `listSales` | El empleado ve las suyas; gerente y CEO, todas (RLS) |
| Stock | `stock-section.tsx`, `receive_stock`, `adjust_stock` | Entradas y ajustes con motivo; solo gerente o superior |

## 3. Tablas y relaciones

| Tabla | Para qué | Relaciones y reglas |
| --- | --- | --- |
| `products` | Producto | `barcode` único (8 a 14 dígitos); `archived_at` impide venderlo |
| `product_variants` | Variante: precio y **stock** | `product_id`; `price` mayor que 0 o nulo; `stock >= 0 and <= 1.000.000` (restricción de la base) |
| `payment_methods` | Medios de pago como datos | `code` clave; `enabled` |
| `sales` | Una fila por venta | `number` identidad (puede tener saltos); `user_id` sin clave foránea (la venta sobrevive al usuario); `payment_method` referencia a `payment_methods`; `total > 0`; `unique (user_id, idempotency_key)` |
| `sale_items` | Detalle | `sale_id` (restrict); **copia** de nombre, código, variante y precio; `subtotal` generado = precio × cantidad |
| `stock_movements` | Libro de inventario | `variant_id`, `delta`, `stock_after`, `stock_before` (generado), `reason` (`venta`, `ajuste`, `inicial`, `entrada`), `sale_id` (restrict), `user_id`, `note` |
| `profiles` | Rol y estado | Lo lee `has_role_at_least()` en cada operación |

Disparadores: `product_variants_stock_log` (todo cambio de stock deja un movimiento, venga de donde venga); `sales_no_change`, `sale_items_no_change` y `stock_movements_no_change` (el historial es de solo agregado, ni el superusuario lo edita); auditoría de catálogo (migración 4).

## 4. Controles de stock

1. **Pantalla:** no se ofrece lo que no tiene stock; el carrito no pasa del stock.
2. **Función `confirm_sale`:** bloquea las variantes en orden (`FOR UPDATE`), vuelve a leer el stock y rechaza TODA la venta si alguna línea no alcanza (`INSUFFICIENT_STOCK`, con lo disponible y lo pedido). Además el `UPDATE ... where stock >= cantidad` impide un descuento que deje negativo.
3. **Restricción de tabla:** `check (stock >= 0)` aunque alguien escriba directo.
4. **Libro:** el disparador registra cada cambio con su motivo; las pruebas verifican que `stock` siempre cierra con la suma de sus movimientos.

## 5. Atomicidad y consistencia

**Veredicto: el diseño actual SÍ garantiza atomicidad en la base.** `confirm_sale` es una sola función PL/pgSQL llamada por RPC: se ejecuta en una única transacción. Cualquier error (de validación o de cualquier insert o update) la revierte entera: venta, renglones, descuentos y movimientos. No hay bloques `EXCEPTION` que traguen errores ni escrituras fuera de esa transacción.

| Prueba (dónde) | Qué demuestra |
| --- | --- |
| Falla al insertar el segundo renglón (PGlite, error inyectado) | No queda venta, ni renglón, ni descuento del primero, ni movimiento |
| Falla al descontar el stock del segundo artículo | Se revierte también el descuento del primero |
| Falla al registrar un movimiento | La venta no queda sin su registro de inventario |
| Falla al insertar la propia venta | No queda nada |
| Tras cada fallo: se quita la causa y se reintenta con la **misma clave** | Se registra una sola vez; la clave no se «gastó» |
| Variables de transacción tras un fallo | Un ajuste manual posterior no queda etiquetado como venta |
| Doce ventas en paralelo con stock 5 (PostgreSQL real, 12 conexiones) | Exactamente 5 se aceptan; stock 0; nunca negativo |
| Misma clave enviada 8 veces a la vez | Una sola venta; descuento único |
| Ventas con las mismas líneas en orden inverso (30 en paralelo) | Sin bloqueos cruzados |
| **Fallo a mitad de la persistencia en paralelo con ventas válidas** (PostgreSQL real) | Las rechazadas no dejan rastro (se revirtió el descuento ya hecho) y las válidas no se afectan |
| **Ventas, entradas y ajustes en paralelo** (PostgreSQL real) | El stock final es exactamente `inicial + entradas − ajustes − ventas aceptadas` y nunca negativo |

Consistencia: las pruebas comprueban, tras cada operación, que el total de cada venta es la suma de su detalle, que las unidades vendidas son las descontadas, que no hay ventas sin detalle ni movimientos de venta sin venta, y que el stock de cada variante es la suma de sus movimientos. Hay controles negativos que confirman que ese verificador detecta una inconsistencia real.

### Hallazgos del circuito (ninguno es un error de atomicidad)

| # | Hallazgo | Gravedad | Estado |
| --- | --- | --- | --- |
| H1 | **Una venta podía duplicarse tras un corte de red** si se editaba el carrito o se recargaba antes de reintentar (la clave del intento vivía solo en memoria) | Media | **Corregido** (ver [recuperacion-de-ventas-pendientes.md](recuperacion-de-ventas-pendientes.md)): la clave se guarda antes de enviar, se consulta antes de reenviar y no se puede armar otra venta con un intento pendiente |
| H2 | Con la misma clave y otro carrito, la base devuelve la venta original sin registrar la segunda (probado y documentado). La pantalla evita esto cambiando la clave en cuanto se edita algo | Baja | Documentado y probado |
| H3 | `expected_price` es opcional en la base: si un cliente lo omite, no hay comparación de precio. La pantalla siempre lo envía y la base cobra su propio precio, así que no se puede cobrar un precio inventado | Baja | Aceptado |
| H4 | No existe anulación de una venta ni devolución: el historial es de solo agregado. Un error de venta se corrige con un ajuste de stock con nota, pero la venta queda | Media (operativa) | Decisión del negocio pendiente |
| H5 | La hora del comprobante se formatea con la zona horaria del dispositivo (la hora guardada es la del servidor) | Baja | Aceptado; usar equipos con la hora correcta |
| H6 | El número de comprobante puede tener saltos (columna de identidad; una venta rechazada consume un número) | Baja | Aceptado (está documentado en la migración) |

**H1 corregido el 8 de noviembre de 2026** con la autorización del responsable. Causa raíz, solución, pruebas y riesgos que quedan abiertos: [recuperacion-de-ventas-pendientes.md](recuperacion-de-ventas-pendientes.md).

## 6. Seguridad y permisos

| Operación | Empleado | Gerente | CEO | Dónde se controla |
| --- | --- | --- | --- | --- |
| Buscar productos para vender | Sí | Sí | Sí | `pos_find` → `scan_require_employee()` |
| Confirmar una venta | Sí | Sí | Sí | `confirm_sale` → `scan_require_employee()` |
| Alta rápida de producto (sin publicar, sin stock) | Sí | Sí | Sí | `scan_create_draft` |
| Entrada y ajuste de stock | No | Sí | Sí | `receive_stock`, `adjust_stock` → `has_role_at_least('gerente')` |
| Stock bajo | No | Sí | Sí | `low_stock_variants` |
| Ver ventas | Las propias | Todas | Todas | RLS `sales_read_own` / `sales_read_all` |
| Ver movimientos de stock | No | Sí | Sí | RLS `stock_movements_read` |
| Escribir `sales`, `sale_items`, `stock_movements` directo | No | No | No | Sin permisos de escritura: solo `confirm_sale` |
| Editar precio o stock en la tabla de variantes | No | Sí | Sí | RLS `gerente_all` |
| Listar usuarios | No | No | Sí | `admin_list_users` (migración aplicada, sin validar con un CEO real) |

Las pruebas recorren esta matriz **para cada rol y cada operación** (7 operaciones × 3 roles) y la escritura directa para los tres roles.

- **Ninguna decisión depende solo del frontend.** El menú y `RoleGuard` solo ocultan; cada operación vuelve a validar el rol en la base. Un rol falso en el token (`user_metadata`, `app_metadata` o claims propios) no amplía nada (probado).
- **Sesión que vence:** el token dura hasta una hora y `supabase-js` lo renueva solo. Si no se puede renovar, `getSession()` devuelve nulo, el panel pasa a «sin sesión» y vuelve al ingreso. Si el token venció justo en el medio de una venta, PostgREST rechaza el pedido antes de llegar a la función; la pantalla lo muestra como «no pudimos confirmar si se registró» (porque no distingue ese caso) e invita a reintentar, lo cual es seguro por la clave de operación. La expiración la controla PostgREST, no la base: **no se puede probar en PGlite**. Sí se probó que sin usuario (`auth.uid()` nulo) no se busca ni se vende (42501), sin cambiar nada.
- **Cuenta desactivada con la sesión abierta:** la base rechaza `pos_find`, `confirm_sale` y las demás operaciones **de inmediato** (42501) y la persona deja de ver sus ventas. Se probó, y que reactivarla las devuelve. La pantalla se entera al volver a la pestaña o en el próximo refresco de sesión, y vuelve al ingreso.
- **Bajar el rol con la sesión abierta** (gerente a empleado): pierde `adjust_stock` y `receive_stock` al instante; conserva la venta (probado).
- **No se modificaron políticas RLS ni funciones** en esta fase.

## 7. Comprobantes

El comprobante es **interno de la operación**. **No es un comprobante fiscal** y no se simula ninguna emisión fiscal. El sistema no tiene ninguna integración con ARCA/AFIP ni intención de aparentarla.

| Elemento | Antes | Ahora |
| --- | --- | --- |
| Número, fecha y hora, vendedor, medio de pago | Presentes | Presentes |
| Renglones: cantidad, producto, variante, importe | Presentes | Sin cambios. El **precio unitario no se imprime** (solo el importe de cada renglón); el formato lo fija una prueba existente y no se alteró. Una prueba verifica que cantidad × precio unitario = importe |
| Total | Presente | Presente; las pruebas verifican que es la suma de los importes y coincide con la venta guardada |
| **Identificación del negocio** | **Faltaba en lo impreso** (solo estaba en el texto para compartir) | Nombre, dirección y localidad de `src/config/contact.ts`, también en lo impreso |
| **Aclaración «no es una factura»** | **Faltaba** | Leyenda dentro del comprobante impreso y del texto compartido: «Comprobante interno de operación. No es una factura ni un comprobante fiscal.» |
| **Stock restante** | Se imprimía en la copia del cliente | Se ve en pantalla para quien vende, pero **no se imprime** |
| Datos fiscales (CUIT, condición ante el IVA, CAE) | No existen | No se agregan: dependen de la situación fiscal del negocio y de un sistema de facturación autorizado |
| Impresión | `window.print()` con una regla que oculta todo menos `#comprobante` | Igual; sin cambios |

Cambios hechos y por qué: la falta de identificación y de la aclaración, y el stock impreso, eran fallas **operativas** (un cliente podría tomar el papel por una factura, y se mostraba un dato interno), no de diseño. Se agregaron tres líneas de texto sin cambiar el estilo del comprobante. Archivos: `src/lib/pos/receipt.ts` y `pos-cart-drawer.tsx`.

Límites: la legibilidad de la impresión (papel A4, papel térmico de 58 u 80 mm, tamaño de letra) **no se verificó** con una impresora real; la regla de impresión no fija el tamaño de papel. Queda en el protocolo físico.

## 8. Errores encontrados y correcciones

| # | Hallazgo | Corrección |
| --- | --- | --- |
| E1 | El comprobante impreso no identificaba al negocio | Se agregó nombre, dirección y localidad |
| E2 | Nada decía que no es una factura | Se agregó la leyenda en pantalla, impresión y texto compartido |
| E3 | El stock restante se imprimía en la copia del cliente | Se oculta al imprimir |
| E4 | Las piezas puras de `api.ts` no se podían probar | Se movieron a `sellable.ts` y `errors.ts` (se reexportan: ningún otro archivo cambió sus imports) |
| E5 | Las pruebas nuevas del circuito fallaron al principio por errores de las propias pruebas (DDL con parámetros; claims de sesión que seguían activos al actuar como administrador) | Se corrigieron las pruebas; no se tocó ningún código de la base ni se redujo ninguna prueba anterior |
| E6 | Mi primera versión del texto compartido agregaba el precio unitario a cada renglón y **hizo fallar una prueba existente** (`pos-draft.test.mjs`, que fija el formato «1 × Vaso — $ 1.000») | Se **revirtió mi cambio** de formato; la prueba existente no se tocó. El precio unitario sigue sin imprimirse |
| H1 a H6 | Ver sección 5 | H1 corregido (ver arriba); H2 a H6, documentados |

No se encontró ningún defecto de atomicidad, de stock ni de permisos en la base.
