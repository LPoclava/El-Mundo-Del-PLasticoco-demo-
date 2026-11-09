# Protocolo de validación con cuentas reales y del punto de venta

Lo ejecutan el responsable del comercio y quien administra el sistema. **Claude no lo ejecuta**: no usa credenciales, no hace ventas ni toca el stock de producción. Este protocolo valida lo que las pruebas automáticas no pueden: Supabase Auth real, el navegador real, el celular y el lector.

## 0. Antes de empezar

**Decisiones del responsable (marcar):**

| Decisión | Opciones | Elegida |
| --- | --- | --- |
| Entorno de la prueba | (a) proyecto de Supabase **de prueba** con las migraciones aplicadas (recomendado) · (b) producción | |
| Migración `20261108000001_admin_list_users` | Aplicada en el entorno de prueba (necesaria para las secciones de Usuarios) | |
| Cuentas | Tres cuentas autorizadas por el responsable: una `empleado`, una `gerente`, y un CEO. Las de prueba se crean a mano en Supabase Auth y se les da acceso desde Usuarios | |

**Advertencia sobre ventas de prueba.** El historial de ventas y de movimientos de stock es de **solo agregado**: una venta no se borra ni se edita, y no existe anulación. Una venta de prueba en producción queda para siempre. Por eso se recomienda el entorno de prueba. Si se decide usar producción, la venta debe hacerse con un producto de prueba creado para ese fin, y el stock de prueba se retira con un ajuste negativo con nota («prueba»).

**Reglas:**
- Las contraseñas no se escriben en chats, capturas ni este documento.
- No desactivar ni cambiar el rol de una cuenta real de trabajo. Esas pruebas se hacen solo con la cuenta de prueba.
- Antes de cada bloque anotar fecha, navegador, dispositivo y quién lo hace.

## 1. Sin sesión (sin iniciar sesión)

| # | Paso | Resultado esperado | Resultado real |
| --- | --- | --- | --- |
| 1.1 | Abrir `/panel` en una ventana privada | Va a `/panel/login` | |
| 1.2 | Abrir `/panel/stock`, `/panel/usuarios`, `/panel/productos/nuevo`, `/panel/precios` | Todas van a `/panel/login` | |
| 1.3 | Abrir `/panel/crm` y `/panel/configuracion` | Página «no encontrada» (ya no existen) | |
| 1.4 | Mirar el formulario de ingreso | Correo y contraseña **vacíos**; sin selector de perfil; sin botones de demostración | |
| 1.5 | Enviar el formulario vacío | Mensajes «Ingresá tu correo electrónico» y «Ingresá tu contraseña» | |
| 1.6 | Ingresar un correo existente con contraseña incorrecta | «El correo o la contraseña no son correctos» (igual que con un correo inexistente) | |
| 1.7 | Apagar el Wi-Fi e intentar ingresar | Mensaje de falta de conexión | |

## 2. Para cada perfil: empleado, gerente y CEO

Repetir el bloque completo con cada cuenta. Anotar el perfil: ____________.

### 2.1 Ingreso, sesión y cierre

| # | Paso | Resultado esperado | Real |
| --- | --- | --- | --- |
| 2.1.1 | Ingresar con la cuenta | Entra al Dashboard; abajo a la izquierda aparecen su nombre y su rol | |
| 2.1.2 | Recargar la página | Sigue con la sesión iniciada | |
| 2.1.3 | Cerrar la pestaña y abrir `/panel` de nuevo | Sigue con la sesión iniciada | |
| 2.1.4 | Abrir `/panel` en una segunda pestaña | Entra directo | |
| 2.1.5 | Cerrar sesión en una pestaña | La otra pestaña vuelve a `/panel/login` | |
| 2.1.6 | Estando en el login con sesión cerrada, usar «Atrás» | No muestra el panel con datos | |
| 2.1.7 | Dejar el panel abierto 1 hora y operar | La sesión se renueva sola, sin pedir contraseña | |

### 2.2 Menú esperado

| Perfil | Secciones que debe ver |
| --- | --- |
| Empleado | Dashboard, Escáner y ventas |
| Gerente | Lo anterior + Control de stock, Productos, Categorías, Banners promocionales |
| CEO | Lo anterior + Usuarios y permisos |

Anotar lo que se ve: ____________. Debe coincidir exactamente; no deben aparecer CRM ni Configuración.

### 2.3 Acceso directo a rutas no autorizadas

Escribir la dirección a mano estando con sesión. Resultado esperado: «Sección fuera de tu perfil» (sin datos ni formularios).

| Perfil | Rutas que debe rechazar |
| --- | --- |
| Empleado | `/panel/stock`, `/panel/productos`, `/panel/productos/nuevo`, `/panel/categorias`, `/panel/banners`, `/panel/usuarios` |
| Gerente | `/panel/usuarios` |
| CEO | Ninguna |

### 2.4 Operaciones permitidas y rechazadas

| Perfil | Debe poder | Debe ser rechazado |
| --- | --- | --- |
| Empleado | Buscar productos, armar el carrito, ver **sus** ventas y el resumen de **sus** ventas, dar de alta un producto nuevo (queda sin publicar y con stock 0) | Ver stock de otros, ajustar stock, editar productos, banners o categorías, ver ventas de otros |
| Gerente | Todo lo del empleado, ver todas las ventas, cargar entradas y ajustes de stock, crear y editar productos, categorías y banners | Ver o cambiar usuarios |
| CEO | Todo lo del gerente y administrar usuarios | Cambiar su propio rol o estado; dejar la app sin un CEO activo |

Notas de la prueba: ____________.

## 3. Usuarios (cuenta de CEO; requiere la migración aplicada)

| # | Paso | Resultado esperado | Real |
| --- | --- | --- | --- |
| 3.1 | Abrir `/panel/usuarios` | Lista de personas con acceso y de cuentas sin acceso, con correo y último ingreso | |
| 3.2 | Mirar su propia fila | Los botones de rol y de activar/desactivar están deshabilitados | |
| 3.3 | Crear en Supabase Auth una cuenta de prueba y recargar | Aparece en «Cuentas sin acceso» | |
| 3.4 | Darle acceso como Empleado, con nombre | Pasa a «Personas con acceso» | |
| 3.5 | Cambiarle el rol a Gerente (pide confirmación) y volver a Empleado | Cambia y se avisa | |
| 3.6 | Cambiarle el nombre | Se actualiza | |
| 3.7 | Con una cuenta de gerente o empleado abrir `/panel/usuarios` | «Sección fuera de tu perfil» | |
| 3.8 | Antes de aplicar la migración, abrir Usuarios como CEO | Aviso claro de que falta aplicarla (no datos falsos) | |

## 4. Desactivar una cuenta (solo la cuenta de prueba)

Con la cuenta de prueba (empleado) abierta en un navegador, y el CEO en otro:

| # | Paso | Resultado esperado | Real |
| --- | --- | --- | --- |
| 4.1 | El CEO desactiva la cuenta de prueba (pide confirmación) | Pasa a «Inactivo» | |
| 4.2 | En la sesión abierta de la cuenta de prueba, buscar un producto o intentar vender | La operación **se rechaza de inmediato** con un aviso de falta de permiso (anotar el texto exacto) | |
| 4.3 | Recargar la página de esa cuenta | «Esta cuenta no tiene acceso al panel» | |
| 4.4 | Cerrar sesión e ingresar de nuevo con la contraseña correcta | Autentica pero informa que no tiene acceso; no entra al panel | |
| 4.5 | El CEO reactiva la cuenta y la cuenta ingresa | Vuelve a funcionar | |
| 4.6 | El CEO intenta desactivarse o cambiarse el rol | El botón está deshabilitado | |

Nota conocida: sin recargar, la pantalla de una cuenta recién desactivada puede seguir mostrando el menú hasta el próximo refresco de sesión (hasta 1 hora); lo que importa es que **las operaciones ya se rechazan** (4.2).

## 5. Prueba del punto de venta con una cuenta de empleado

> El procedimiento completo y vigente del punto de venta (cámara, lector, carrito, medios de pago, stock e impresión) está en [protocolo-prueba-fisica-pos.md](protocolo-prueba-fisica-pos.md), y se hace en el proyecto de prueba descrito en [proyecto-supabase-de-prueba.md](proyecto-supabase-de-prueba.md). Esta sección queda como resumen.

**Nada de esta sección se ejecuta sin la presencia y la autorización explícita del responsable.** Los pasos 5.1 a 5.5 no modifican datos; el 5.6 sí.

Preparación: el producto de prueba tiene código de barras real, una foto, precio y **stock cargado**. Anotar el stock inicial: ____. (Cargarlo es una operación de gerente.)

| # | Paso | Resultado esperado | Real |
| --- | --- | --- | --- |
| 5.1 | Ingresar como empleado y abrir «Escáner y ventas» | Abre el punto de venta; el menú solo tiene Dashboard y Escáner | |
| 5.2 | Buscar por nombre (mínimo 2 letras) y por código | Aparece el producto con variantes, precio y stock | |
| 5.3 | Buscar algo inexistente | Mensaje claro y la opción «Registrar producto nuevo» | |
| 5.4 | Escáner con cámara (celular físico, HTTPS): aceptar el permiso y leer el código real | Pita, agrega al carrito; el mismo código a la vista no se suma de nuevo | |
| 5.5 | Probar un producto sin stock y uno sin precio | No llegan al carrito y se explica por qué | |
| 5.6 | **(Con autorización)** Elegir un medio de pago y confirmar la venta de 1 unidad | Comprobante con número, fecha, vendedor, producto, medio de pago y total | |
| 5.7 | Verificar el stock | Quedó en (stock inicial − 1) | |
| 5.8 | Con una cuenta de gerente, revisar los movimientos de stock | Hay un movimiento de tipo «venta» de −1 con el stock resultante | |
| 5.9 | Con la cuenta de empleado, abrir «Ventas recientes» | Aparece solo su venta | |
| 5.10 | Hacer doble clic en «Confirmar» o reintentar con mala señal | Una sola venta, un solo descuento | |
| 5.11 | Con el empleado, intentar `/panel/stock` | «Sección fuera de tu perfil» | |
| 5.12 | Cerrar sesión con una venta armada | Pregunta antes de descartarla | |
| 5.13 | Retirar el stock de prueba con un ajuste negativo con nota «prueba» (cuenta de gerente) | Queda registrado el movimiento de ajuste | |

## 6. Registro de la validación

| Dato | Valor |
| --- | --- |
| Fecha | |
| Entorno (prueba o producción) | |
| Navegador y versión | |
| Dispositivo (modelo) y lector de códigos | |
| Cuentas usadas (solo el rol, no la contraseña) | |
| Quién ejecutó | |
| Pruebas aprobadas | |
| Pruebas fallidas y qué pasó | |
| Evidencia (capturas, números de comprobante) | |

Al terminar, actualizar `estado.md` §4 con lo que se validó y lo que no.
