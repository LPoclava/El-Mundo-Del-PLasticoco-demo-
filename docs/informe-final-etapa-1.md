# Informe final de la Etapa 1

Fecha: 9 de noviembre de 2026. Todo lo de este informe está **en commits locales de `main`** (sin `push` ni despliegue). La Etapa 0 no se reabrió.

Clasificación: **Terminado** (implementado y probado), **Parcial** (implementado, falta algo concreto), **Pendiente** (no hecho), **Bloqueado** (falta un dato, una credencial o una decisión externa). «Probado» significa pruebas automáticas locales (PGlite y unitarias); **ninguna prueba usó el Supabase real** y ninguna generó ventas ni movimientos en producción.

## Resumen

| Área | Estado |
| --- | --- |
| Base: QR, reportes por medio de pago, acceso de desarrollo, estructura fiscal | **Terminado** (aplicado en producción y verificado en solo lectura el 9 nov) |
| Escáner: estado del producto, tres acciones, modo venta | **Terminado** (sin ver en pantalla) |
| Comprobante interno (vista previa, imprimir o PDF, reabrir) | **Terminado** (sin ver en pantalla) |
| Carrito público por WhatsApp | **Terminado** |
| Catálogo visual (tarjetas, ficha, galería, ventana, descubrimiento) | **Terminado** (verificado en navegador con datos ficticios) |
| Panel: búsqueda de productos y dashboard | **Terminado** (sin ver en pantalla) |
| Estructura fiscal del servidor | **Parcial**: estructura y pruebas listas; **no emite** |
| Emisión fiscal real (ARCA) | **Bloqueado** (credenciales y datos fiscales) |
| Login con recuperación de contraseña | **Pendiente / Bloqueado** (ver abajo) |
| Interfaz del panel para el circuito fiscal | **Pendiente** |
| Validación visual con sesión real y datos reales | **Pendiente** (la hace el responsable) |

## Qué se hizo, por fase

1. **Fase 1, base de datos** (`20261109000001` a `000003`, aplicadas por el responsable): método de pago **QR** (registro manual, sin integración de cobros); funciones `sales_by_payment_method` y `sales_monthly_by_payment_method`; tabla `developer_access` con `is_developer()` y `require_developer()`; tablas `fiscal_settings` (`production_enabled = false`), `fiscal_documents` y `fiscal_events` (solo agregado) con las funciones `fiscal_request_issue`, `fiscal_transition` y `fiscal_log_event`. Verificado en producción con consultas de solo lectura: estructura, RLS, permisos, 0 desarrolladores, 0 comprobantes, 0 ventas.
2. **Fase 2, escáner y comprobante:** estado del producto (disponible, sin stock, sin precio, incompleto, archivado), acciones «Registrar venta» (naranja), «Actualizar stock» (verde, gerente o superior, abre el control de stock con el producto identificado) y «Registrar o completar producto» (amarillo); **modo venta** (solo agrega, un producto de una variante vendible se agrega solo, cancelar con confirmación); comprobante interno con logo, datos del comercio, tabla con precios unitarios y la leyenda de que no es fiscal, imprimir o guardar como PDF y reabrir desde el detalle de una venta.
3. **Fase 3, carrito público:** armador de pedidos que termina solo en WhatsApp (no es una venta: no registra, no toca stock, no reserva). Persistente en `localStorage`, con variantes, cantidades, subtotales, total estimado, estado vacío, confirmaciones y límites; mensaje con producto, variante, cantidad, precio, subtotal, total y pedido de confirmar disponibilidad.
4. **Fase 4, catálogo visual:** tarjetas con la foto como protagonista y línea de corte de boleto; ficha editorial con galería de proporciones adaptables, bloque de compra con variantes como opciones accesibles y características como bloques; ventana flotante con la misma composición; sección «Recorré el local desde tu casa» con productos reales por rubro; botón «Pedido» en la navegación y panel del carrito con el mismo lenguaje. No se inventó ninguna característica, material, disponibilidad ni promoción; el stock no se muestra al público.
5. **Fase 5, panel:** buscador desplegable de productos (nombre, marca, descripción, código de barras, sugerencia de categoría) con stock por producto; dashboard con período seleccionable, ticket promedio, medios de pago (operaciones, facturación, participación), contador y comparación mensual (solo con datos suficientes) y movimientos recientes con detalle y comprobante. Cada indicador trae su definición.
6. **Fase 6, fiscal del servidor:** rutas `/api/fiscal/*` solo para desarrolladores, validadas en el servidor y en la base; estados, eventos, idempotencia y dos llaves de producción, ambas apagadas; **sin ninguna llamada a ARCA**. Detalle en [comprobantes.md](comprobantes.md).

## Pruebas (última corrida, 9 nov 2026)

| Conjunto | Resultado |
| --- | --- |
| `tsc --noEmit` | sin errores |
| `eslint` | 0 errores, 1 aviso preexistente (`supabase/tests/limpieza-replica.mjs`, variable sin usar) |
| `npm test` (`scripts/*.test.mjs`) | 375 de 375 |
| Base de datos en PGlite (`supabase/tests`) | 284 de 284 |
| Concurrencia con conexiones reales (`concurrency.mjs`) | 10 de 10 (no cubre el circuito fiscal nuevo) |
| `next build` | correcto (las cuatro rutas fiscales salen como dinámicas) |

## Decisiones que conviene conocer

- **Cambio de `tsconfig.json`:** `allowImportingTsExtensions` es necesario solo porque `scan-actions.ts` importa `./sellable.ts` en tiempo de ejecución (para poder probarse con Node); no afecta a nada más.
- **Teléfono en el comprobante:** no se imprime (solo el WhatsApp está cargado y no se confirmó que sea el que se quiere).
- **Fotos ficticias de prueba:** `supabase/dev/mock-public-api.mjs` sirve 14 productos inventados en SVG para ver el catálogo sin tocar producción. Solo lee y no se conecta a nada.
- **Sin anulaciones ni devoluciones:** el modelo solo tiene ventas confirmadas; el dashboard lo aclara.
- **Consultas de WhatsApp:** siguen sin medirse (el botón solo abre el chat); el dashboard lo aclara.

## Pendiente de validación con tu sesión (nada de esto se pudo ver)

1. Panel en 320, 768 y 1366 px con teclado: escáner (acciones, modo venta, cancelar), comprobante (vista previa, impresión, PDF, reabrir), dashboard (período, medios de pago, comparación, movimientos), Productos (buscador, stock, filtros).
2. Una venta real de punta a punta con el lector físico y la impresora (protocolo en [protocolo-prueba-fisica-pos.md](protocolo-prueba-fisica-pos.md)): hoy hay 0 ventas.
3. El catálogo con productos y fotos **reales** (producción tiene 0 productos publicados): tarjetas, ficha, galería con varias fotos, descubrimiento y carrito con WhatsApp.
4. Movimiento reducido (`prefers-reduced-motion`), zoom al 200 %, 1920 px y lector de pantalla: los estilos están, pero el navegador integrado no permitió simularlos.
5. Dar de alta, a mano, a las cuentas de desarrollo en `developer_access` (hoy hay 0).

## Bloqueado o pendiente de decisión externa

- **Emisión fiscal real:** faltan datos fiscales del comercio, el certificado y la clave de ARCA, el adaptador WSAA/WSFEv1, una función de base para entregar los datos de la venta al servidor, tipo y diseño del comprobante, notas de crédito y pruebas de homologación. Lista completa en [comprobantes.md](comprobantes.md).
- **Recuperación de contraseña:** requiere configurar el envío de correos y la URL de redirección en Supabase (Authentication), que no se pudo hacer desde acá; el login no la ofrece todavía.
- **Publicación:** `push` y despliegue siguen sin autorizarse; el sitio publicado todavía es la versión anterior a la Etapa 0.
- **Etapa 0, ítems externos que no se reabrieron:** borrar 2 archivos de Storage (necesita tu sesión), CI y Vercel sin verificar, cuentas de gerente y empleado de prueba.
- **Mejoras de seguridad del circuito fiscal:** límite de frecuencia por cuenta en `/api/fiscal/*` y una prueba de bloqueo de fila con conexiones reales.

## Qué hacer para publicar (cuando lo decidas)

1. Mirar la lista de validación de arriba con tu sesión y con productos reales.
2. `git push` de `main` y despliegue en Vercel (pasos en [despliegue.md](despliegue.md)); confirmar `NEXT_PUBLIC_SITE_URL`.
3. No cargar variables `FISCAL_*` ni cambiar `production_enabled` hasta tener lo de la lista de ARCA.
