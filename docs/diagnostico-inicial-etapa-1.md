# Diagnóstico inicial: nueva fase comercial (catálogo, carrito, scanner y ventas, comprobantes, dashboard y fiscal)

Fecha: 9 de noviembre de 2026. **Solo lectura**: no se modificó código, base de datos ni datos. Se leyó el repositorio (139 archivos en `src/`, 19 migraciones, 14 archivos de prueba de la aplicación y 12 de base), `CLAUDE.md`, `README.md` y `docs/`. El esquema real de Supabase ya estaba relevado por el conector (informes de la Etapa 0); no se hicieron consultas nuevas a producción.

Escala: **Existe** · **Parcial** · **No existe** · **Bloqueado** (falta algo que Claude no puede obtener).

## 1. Estado de partida

| Verificación | Resultado |
| --- | --- |
| TypeScript, ESLint, build | Sin errores (última corrida el 9 de noviembre) |
| Pruebas | 258/258 (aplicación), 253/253 (base), 10/10 (concurrencia) |
| Errores de consola | No observados (no se corrió el sitio con datos) |
| Producción | **Sin datos comerciales**: 0 productos, 0 ventas, 4 categorías, 5 medios de pago, 1 cuenta CEO (de AImpulse) |
| Sitio publicado | Con la versión **anterior** a la Etapa 0 hasta que Vercel despliegue lo subido |

**Consecuencia práctica:** el catálogo público está vacío y no se puede escribir en producción para probar. Todo el desarrollo visual necesita datos de prueba **fuera de producción** (ver §6, R1).

## 2. Lo pedido contra lo que existe

| # | Pedido | Estado | Evidencia en el código | Qué hay que hacer |
| --- | --- | --- | --- | --- |
| 2.1 | Ficha de producto editorial | **Parcial** | `producto/[slug]/page.tsx`, `product-gallery.tsx` (foto en recuadro `aspect-square` con `object-contain`), `product-purchase.tsx` (variantes con radios), bloque «Características» con `<dl>`, ficha modal interceptada (`@modal/(.)producto/[slug]`), JSON-LD | Rediseño visual: composición adaptable a la proporción de la foto, bloques para variantes, jerarquía de precio y categoría |
| 2.1 | Medidas, colores, **materiales**, presentaciones | **Parcial** | Solo existen `size` y `color` por variante, `brand` y `description`. **No hay campo de material ni de presentación** | Mostrar solo lo registrado. «Materiales» **no se puede inventar**; requeriría un campo nuevo y una decisión |
| 2.1 | Disponibilidad solo si es real | **Parcial** | La vista pública **no expone stock** (decisión documentada) | Mantener oculta; mostrarla exige cambiar la vista y que el negocio lo decida |
| 2.2 | Tarjetas | **Parcial** | `product-card.tsx`: `aspect-[4/3]`, `object-contain p-2`, nombre y precio, WhatsApp | Ajustar contenedor, relleno, jerarquía; sin recortar productos |
| 2.3 | Sección de descubrimiento | **Parcial** | `config/catalog-copy.ts` («Todo lo que necesitás, en un mismo lugar»), `home-front`, `category-tickets`, `promo-carousel`, `benefits-band`. **El título «Descubrí nuestra variedad» no existe literalmente** | Rediseño de composición y textos; sin inventar promociones: usar banners y destacados reales (hoy 0) |
| 2.4 | **Carrito público** | **No existe** | No hay estado de carrito público; solo existe el del POS (`lib/pos/cart.ts`). Sí existe la consulta por WhatsApp de un producto (`lib/contact.ts`) | Construir: tienda de carrito persistente (localStorage), drawer, mensaje de WhatsApp, estados vacío/errores |
| 3.1 | Login definitivo | **Existe (en gran parte)** | `login-form.tsx` usa Supabase Auth; **el login de demostración se eliminó en la Etapa 0** (decisión del 8 nov). Quedan **comentarios obsoletos** que dicen «sesión de demostración» en 10 archivos de `app/panel` | Pulir el diseño (identidad, estados de carga y error), actualizar los comentarios; **recuperación de contraseña**: ver §7 |
| 3.2 | Dashboard: ventas, facturación, unidades, stock bajo, más vendidos | **Existe** | `home-section.tsx` + RPC `sales_summary` (cantidad, ingresos, unidades, más vendidos) y `low_stock_variants` | Agregar ticket promedio (cálculo en cliente: facturación ÷ ventas) y definiciones |
| 3.2 | Métodos de pago (análisis mensual) | **No existe** | `sales_summary` no desglosa por método. `sales.payment_method` y `payment_methods` existen | Función SQL nueva `sales_by_payment_method` (migración) + sección en el panel |
| 3.2 | Consultas comerciales | **Bloqueado como métrica** | Abrir WhatsApp **no registra** nada; no hay fuente real | No se mide; el panel ya lo explica (aviso «Consultas por WhatsApp») |
| 3.3 | Movimientos recientes | **Parcial** | «Últimas ventas» y «Actividad de inventario» en el Dashboard; `pos-recent-sales.tsx` | Lista compacta con icono, clasificación, fecha, importe, estado y detalle |
| 3.3 | Anulaciones y devoluciones | **No existe en el modelo** | `sales.status` solo admite `'confirmada'`; el libro es de solo agregado | No se muestran ni se simulan; documentar. Implementarlos sería una decisión y un diseño nuevos |
| 4.1 | Scanner: ventana contextual tras leer | **Parcial** | `barcode-scanner.tsx`, `pos-section.tsx`, `pos-result-panel.tsx`: tras leer muestra el producto con variantes, precio, stock, «Agregar» y, si es desconocido, «Registrar producto» | Reorganizar en las tres acciones pedidas; agregar foto, estado y código |
| 4.2.A | Registrar producto (amarillo; sin duplicados; completar borradores) | **Parcial** | `scan_create_draft` (alta rápida, rechaza código duplicado) y `scan_create_product`; el gerente completa desde Productos | Estilo amarillo y mensaje; ofrecer completar un borrador existente; abrir el formulario completo conservando el código |
| 4.2.B | Actualizar stock | **Existe** | `stock-form.tsx`, RPC `receive_stock` y `adjust_stock` (gerente o superior), movimientos con nota | Enlazarlo desde la ventana contextual |
| 4.2.C / 4.3 | Registrar venta con «modo venta» | **Parcial** | El POS ya tiene carrito, cantidades, eliminar líneas, subtotales, total, método y confirmación idempotente con recuperación (H1) | Introducir el **modo venta** explícito (ocultar las otras acciones), confirmación al agregar y cancelación con confirmación |
| 4.4 | QR como método de pago manual | **No existe** | `payment_methods`: efectivo, transferencia, débito, crédito y «otro» (inactivo). **No hay QR ni Mercado Pago** | Migración de datos: `insert` del método `qr` (el resto de la lógica lo lee de la base) |
| 4.5 | Venta atómica | **Existe** | `confirm_sale` atómica, idempotente, sin stock negativo, validada por rol; 10/10 de concurrencia | Sin cambios de fondo; probar el método QR |
| 5.1 | Comprobante interno | **Parcial** | `lib/pos/receipt.ts` (leyenda «No es una factura…»), `pos-cart-drawer.tsx` con «Imprimir» (`window.print`) y `@media print` | Agregar logo, vista previa, consulta posterior desde el detalle de la venta y diseño de impresión |
| 5.2 | **Circuito fiscal restringido al grupo de desarrollo** | **No existe** | No hay tablas, rutas de servidor ni autorización de desarrollo. Los roles son `empleado/gerente/ceo` | Estructura, sin emisión real (ver §6, R3 y R4) |
| 6 | Productos del panel: buscador y organización | **Parcial** | `products-section.tsx` ya tiene búsqueda por nombre, marca, código, filtro de categoría y de estado | Buscador desplegable animado, reorganización y accesibilidad |
| 7 | Diseño, accesibilidad y animaciones | **Parcial** | Tokens claro/oscuro en `globals.css`; `prefers-reduced-motion` ya respetado en varios componentes | Estándar común y revisión por pantallas |

## 3. Esquema real relevante (producción, verificado el 9 de noviembre de 2026)

11 tablas con RLS: `categories`, `products`, `product_variants`, `product_images`, `promo_banners`, `payment_methods`, `profiles`, `sales`, `sale_items`, `stock_movements`, `audit_log`. Vistas públicas: `public_catalog`, `public_categories`, `public_promo_banners`, `public_product_images`, `public_product_variants`. Funciones críticas: `pos_find`, `confirm_sale`, `receive_stock`, `adjust_stock`, `scan_*`, `sales_summary`, `low_stock_variants`, `admin_*`.

- `sales.payment_method` → `payment_methods(code)` (clave foránea). `payment_methods.code` exige `^[a-z][a-z0-9_]{1,29}$`: **`qr` es válido**.
- `sales.status` solo acepta `'confirmada'` (**no hay estados de anulación o devolución**).
- `sale_items` guarda copia del nombre, la variante y el precio al vender.
- El libro (`sales`, `sale_items`, `stock_movements`) es de solo agregado.
- No hay ninguna tabla fiscal ni de acceso de desarrollo. **No se crearán tablas equivalentes a las existentes.**

## 4. Flujos actuales

| Flujo | Cómo funciona hoy |
| --- | --- |
| Productos | Alta completa en el panel (gerente o superior) con variantes y fotos (`saveProduct`, secuencial); alta rápida desde el escáner (borrador sin precio ni fotos, no se publica) |
| Variantes | `size` y `color` por variante, con precio y stock; el catálogo muestra solo las que tienen precio |
| Scanner | Cámara (`@zxing/library`) o escritura manual → `pos_find` → panel de resultado con variantes, precio, stock, «Agregar» o «Registrar producto» |
| Ventas | Carrito en `sessionStorage` (borrador) → `confirm_sale` (clave idempotente guardada en `mp-venta-intento`) → comprobante interno y compartir |
| Stock | `receive_stock`, `adjust_stock` y las ventas escriben `stock_movements`; el stock siempre cierra con sus movimientos |

## 5. Discrepancias entre lo pedido, la documentación y el código

| # | Discrepancia | Referencia usada |
| --- | --- | --- |
| D1 | El pedido dice «eliminar el acceso rápido de demostración»: **ya se eliminó** en la Etapa 0 | El código real |
| D2 | **Decisión vigente: «el panel conserva siempre los colores claros»**; el pedido pide fondos claros y oscuros coherentes en toda la aplicación | Se mantiene la decisión (panel claro) y se extiende la coherencia claro/oscuro a la parte pública. **Se cambia solo si lo indicás** |
| D3 | El pedido lista «Mercado Pago» entre los métodos previstos, pero también dice «utilizar los métodos reales»; no existe | Se agrega **solo QR** (decisión definitiva del pedido) |
| D4 | El pedido menciona «ventas anuladas o devueltas»; el modelo no las contempla | No se implementan ni se simulan |
| D5 | Comentarios de `app/panel/*` hablan de «sesión de demostración» | Se corrigen (cosmético) |
| D6 | El pedido pide `CLAUDE.md`, README y documentación al final; el repositorio ya los tiene | Se actualizan al terminar cada fase |

## 6. Restricciones, bloqueos y riesgos para el plan

| # | Tema | Detalle y decisión |
| --- | --- | --- |
| R1 | **Producción vacía y sin entorno de prueba** | Prohibido escribir en producción para probar. Para el desarrollo visual se usará un **servidor local simulado** de las cinco vistas públicas (`scripts/`, solo desarrollo, con datos marcados como de prueba) apuntando por `.env.local`; para SQL, PGlite (como hoy). Las migraciones **las aplica el usuario a mano**; no se probarán contra Supabase real |
| R2 | Migraciones | Solo archivos versionados con la marca de tiempo siguiente; nunca editar una aplicada. Compatibles con los registros actuales (QR es un `insert`, no cambia nada existente) |
| R3 | **Circuito fiscal: arquitectura** | La app **no tiene capa de servidor propia** (no hay rutas de API; todo corre en el navegador con la clave pública). Los certificados y claves de ARCA **no pueden vivir en el navegador ni en tablas legibles por el cliente**. Se propone: **rutas de servidor de Next.js en Vercel** (misma plataforma) que leen las credenciales de **variables de entorno de servidor** y ejecutan la solicitud con el **token del usuario** (sin `service_role`), de modo que la base verifique la autorización |
| R4 | **Grupo de desarrollo** | El rol CEO del comercio no sirve. Se propone una tabla **`developer_access`** (cuentas de AImpulse Tech), sin políticas para clientes, y una función `is_developer()` de ejecución restringida; todo el circuito fiscal exige esa función **en la base y en el servidor**. Alta de cuentas **a mano por SQL** (como hoy los usuarios) |
| R5 | **ARCA sin credenciales ni datos fiscales** | No hay CUIT, certificado, punto de venta ni acceso al entorno de homologación. Se desarrolla **solo la estructura** (tablas, estados, auditoría, gating, rutas con interfaz de integración, pruebas con un simulador **explícitamente marcado como de prueba**) y se documenta lo que falta. **No se simulan facturas válidas ni se emiten comprobantes reales** |
| R6 | Seguridad de WhatsApp | El número es público (ya está en `config/contact.ts`). El carrito no registra nada ni reserva stock |
| R7 | Alcance | El pedido equivale a una etapa completa. Se entrega por fases con pruebas y documentación en cada una, sin declarar terminado lo que quede parcial |
| R8 | CI | Corre tsc, lint, test y build, pero **no las pruebas de base**; se mantiene como riesgo documentado |
| R9 | Recuperación de contraseña | `login-form.tsx` no la ofrece. Supabase Auth la soporta (`resetPasswordForEmail`), pero requiere **URL de redirección y plantilla de correo configuradas en el panel de Supabase**, que no se pueden verificar desde acá. Se implementará solo si se puede configurar; si no, quedará **Bloqueado** y documentado |

## 7. Decisiones que se asumen para no frenar el trabajo

| Tema | Decisión asumida |
| --- | --- |
| Panel | Se mantiene claro (decisión vigente) |
| Métodos de pago | Se agrega QR; no se agregan Mercado Pago ni otros no definidos |
| Disponibilidad pública | No se muestra stock |
| Fiscal | Solo estructura y restricciones; sin emisión |
| Anulaciones y devoluciones | No existen; no se muestran |
| Carrito público | Estado en el navegador (persistente), mensaje por WhatsApp, sin registro de pedidos en la base |
| Dato por confirmar con el cliente | Texto exacto del mensaje de WhatsApp y los textos comerciales de la portada (se propondrán sin inventar promociones ni precios) |

## 8. Funcionalidades terminadas, incompletas y defectuosas

| Clasificación | Elementos |
| --- | --- |
| **Terminadas** | Ingreso único con Supabase Auth; roles y RLS; `confirm_sale` atómica e idempotente con recuperación; stock y movimientos; dashboard básico (ventas, facturación, unidades, stock bajo, más vendidos); búsqueda y filtros de Productos; consulta por WhatsApp por producto; ficha modal y página propia; auditoría |
| **Incompletas** | Ficha y tarjetas (diseño básico); comprobante interno (sin logo ni consulta posterior); movimientos (sin lista compacta); escáner (sin ventana contextual con tres acciones ni modo venta explícito) |
| **No existen** | Carrito público; método QR; análisis por método de pago; ticket promedio; circuito fiscal; grupo de desarrollo; recuperación de contraseña |
| **Defectuosas** | Ninguna comprobada en esta lectura. Observaciones: comentarios obsoletos sobre la demostración; la CI no corre las pruebas de base; el sitio publicado está desactualizado |

## 9. Plan de implementación por fases

Cada fase termina con: pruebas (TypeScript, lint, `npm test`, `supabase/tests` si hubo SQL, build), documentación (`estado.md`, `decisiones.md`, `CLAUDE.md` si cambia una regla) y commit local. **Nada se aplica en producción ni se sube sin autorización.**

| Fase | Contenido | Depende de | Pruebas principales |
| --- | --- | --- | --- |
| **0. Preparación** | Servidor local simulado de las vistas públicas con datos de prueba marcados; comentarios obsoletos; línea base | — | Arranque y lectura desde el sitio local |
| **1. Base de datos** | Migraciones: (a) método `qr`; (b) `sales_by_payment_method(p_from, p_to)` (invoker, respeta RLS); (c) `developer_access` + `is_developer()`; (d) estructura fiscal mínima (`fiscal_documents` y `fiscal_events`, RLS solo para desarrollo, sin secretos). Todas con pruebas en PGlite | — | `supabase/tests`: venta con QR, permisos por rol, rechazo para CEO sin acceso de desarrollo, RLS |
| **2. Ventas y escáner** | Ventana contextual con tres acciones; modo venta; confirmación al agregar; cancelación con confirmación; QR en el selector; comprobante interno (logo, vista previa, imprimir, consulta desde el detalle) | 1 | Pruebas unitarias del flujo (código válido, inexistente, incompleto, repetido, stock insuficiente, doble envío, cancelación, QR) |
| **3. Carrito público** | Tienda persistente, drawer, desde tarjeta y ficha, variantes, cantidades, estado vacío, mensaje de WhatsApp, animaciones sobrias | 0 | Pruebas de la tienda y del mensaje; sin imágenes ni variantes |
| **4. Catálogo visual** | Ficha editorial, tarjetas, sección de descubrimiento | 0, 3 | Revisión en 320 a 1920 px, claro y oscuro, zoom 200 %, movimiento reducido |
| **5. Panel** | Productos (buscador animado, reorganización); dashboard (ticket promedio, métodos de pago, mes seleccionable); movimientos compactos; login pulido | 1 | Cálculos con datos de prueba; períodos; ausencia de datos |
| **6. Fiscal (estructura)** | Rutas de servidor, estados, auditoría, bloqueo por `is_developer()` en base y servidor, simulador de prueba marcado, documentación de lo que falta | 1 | Usuario no autorizado, autorizado, credenciales ausentes, error, repetición, rechazo, auditoría, **ausencia de emisión accidental** |
| **7. Cierre** | Estándar de diseño y accesibilidad; documentación (`CLAUDE.md`, README, modelo de datos, ventas, pagos, comprobantes, permisos, variables, despliegue); informe final | Todas | Suite completa y revisión de interfaz |

## 10. Qué necesito del usuario (solo lo imprescindible)

Nada bloquea el comienzo de las fases 0 a 5. Para el cierre completo hará falta, **más adelante**:

1. Que **apliques a mano** las migraciones de la fase 1 en Supabase (yo las dejo versionadas y probadas en PGlite, no contra Supabase real).
2. **Datos fiscales y credenciales de ARCA** (CUIT, punto de venta, certificado y acceso de homologación) cuando se quiera pasar de la estructura a la integración real.
3. **Configurar en Supabase** la URL de redirección y el correo de recuperación de contraseña si se quiere esa función.
4. Confirmar o corregir las decisiones de §7, en particular **D2 (panel siempre claro)**.

**Siguiente paso:** empezar por la Fase 0 y la Fase 1, que desbloquean el resto.
