# Protocolo de prueba física del punto de venta

**No lo ejecuta Claude: requiere la presencia y la autorización del responsable.** Se hace en el **proyecto de Supabase de prueba** (ver `proyecto-supabase-de-prueba.md`), con la semilla cargada. Las ventas de este protocolo **son permanentes** (el historial es de solo agregado): nunca se hacen en producción.

Este protocolo detalla la parte del punto de venta; el de cuentas, sesiones y desactivación está en `protocolo-validacion-cuentas.md`.

## 0. Preparación

| Elemento | Requisito | Listo |
| --- | --- | --- |
| Proyecto de prueba | Migraciones aplicadas y semilla cargada; URL confirmada en la aplicación | |
| Cuentas | Empleado, gerente y CEO de prueba (contraseñas no compartidas por chat) | |
| Celular | Chrome (Android) o Safari (iPhone), con cámara trasera; la hora y la zona horaria correctas | |
| Conexión segura | HTTPS (túnel o vista previa) o dirección marcada como segura; sin eso la cámara no se habilita | |
| Lector físico | Lector USB o Bluetooth «tipo teclado» (si hay uno): probar antes que escribe números en un bloc de notas y termina con Enter | |
| Códigos de barras | Los 5 códigos de la semilla impresos o en otra pantalla; además, un producto físico real con código EAN-13 | |
| Impresión | Impresora con papel A4 y, si se usa, térmica de 58 u 80 mm; saber desde dónde se imprime (celular o PC) | |
| Hoja de registro | Imprimir la tabla del final | |

Anotar: fecha ______ · navegador y versión ______ · modelo del celular ______ · lector ______ · responsable ______.

## 1. Escáner con cámara (cuenta de empleado, celular)

| # | Paso | Resultado esperado | Real |
| --- | --- | --- | --- |
| 1.1 | Abrir «Escáner y ventas». La cámara **no** debe encenderse sola | Botón «Escanear producto»; ninguna luz de cámara | |
| 1.2 | Tocar el botón y **Permitir** | Se ve la cámara trasera con el marco de lectura | |
| 1.3 | Leer el código del **Balde** | Pita, vibra, muestra «[PRUEBA] Balde 10 litros», precio $1.000, stock 20 | |
| 1.4 | Dejar el mismo código a la vista | No se vuelve a agregar solo | |
| 1.5 | Leer el código de la **Remera** | Muestra dos variantes (M y L) con precio y stock | |
| 1.6 | Leer el código del **Producto agotado** | Se explica que no tiene stock; no se puede agregar | |
| 1.7 | Leer el del **sin precio** y el del **archivado** | Se explica por qué no se pueden vender; no llegan al carrito | |
| 1.8 | Leer un código que no existe (por ejemplo, un producto físico real no cargado) | «Código no registrado» y la opción de registrarlo | |
| 1.9 | Probar con poca luz, torcido y lejos; usar la linterna si el teléfono la tiene | Lee o da consejos; no se cuelga | |
| 1.10 | Cerrar la cámara | La luz de la cámara se apaga | |
| 1.11 | Cambiar de app y volver | Avisa que la cámara se detuvo y permite reintentar | |
| 1.12 | Bloquear el permiso a propósito y reintentar | Mensaje con los pasos para habilitarla | |

Cámara bajo las cabeceras de seguridad: si la cámara no abre en una vista desplegada, anotar el texto exacto de la consola («Refused to …»).

## 2. Lector físico (si se usa)

| # | Paso | Resultado esperado | Real |
| --- | --- | --- | --- |
| 2.1 | Tocar el campo «Escribí el código o el nombre» para darle el foco y leer el código del Balde | Escribe los números, envía Enter y muestra el producto | |
| 2.2 | Leer sin darle foco al campo | **Anotar qué pasa** (el lector necesita el foco; puede no hacer nada) | |
| 2.3 | Leer el mismo código dos veces seguidas | Muestra el producto; para sumar otra unidad se usa el + del carrito | |
| 2.4 | Leer un código inexistente | «Código no registrado» | |

## 3. Búsqueda manual

| # | Paso | Resultado esperado | Real |
| --- | --- | --- | --- |
| 3.1 | Escribir «balde» | Lista con el producto para elegir | |
| 3.2 | Escribir «bal» y «ba» | Con 2 letras busca; con 1 el botón queda deshabilitado | |
| 3.3 | Escribir «%» y «_» | Los trata como texto, no como comodines | |
| 3.4 | Escribir algo que no existe | Mensaje «No encontramos productos» | |
| 3.5 | Escribir un código de 13 dígitos | Va directo al producto | |

## 4. Carrito

| # | Paso | Resultado esperado | Real |
| --- | --- | --- | --- |
| 4.1 | Agregar 2 baldes y 1 remera M | Contador y total correctos ($ 2.000 + $ 2.500) | |
| 4.2 | Subir la cantidad con + hasta pasar el stock de la remera L (3) | Se detiene en el stock y avisa | |
| 4.3 | Escribir la cantidad a mano: 0, -1, 1.5, «abc» | Se rechaza; solo enteros de 1 al stock | |
| 4.4 | Quitar una línea y vaciar el carrito | Pide confirmación para vaciar | |
| 4.5 | Armar un carrito y **recargar** la página | Recupera la venta («Recuperamos la venta que estabas armando») | |
| 4.6 | Cerrar sesión con una venta armada | Pregunta antes de descartarla | |

## 5. Venta, medios de pago y stock

Con la cuenta de **empleado**. Anotar el stock inicial del Balde: ____ (esperado 20).

| # | Paso | Resultado esperado | Real |
| --- | --- | --- | --- |
| 5.1 | Armar 3 baldes y confirmar con **Efectivo** | «¡Venta concretada!»; comprobante con número, fecha, vendedor, medio de pago, renglón y total $ 3.000 | |
| 5.2 | Verificar el stock del Balde (buscarlo de nuevo) | 17 | |
| 5.3 | Vender 1 remera L con **Transferencia** | Total $ 2.600; stock de L: 2 | |
| 5.4 | Vender con **Tarjeta de débito** y con **Tarjeta de crédito** (1 balde cada una) | El comprobante muestra el medio elegido | |
| 5.5 | Confirmar sin elegir medio de pago | El botón no deja confirmar | |
| 5.6 | **Doble toque** rápido en «Confirmar» | Una sola venta y un solo descuento | |
| 5.7 | Cortar la conexión (modo avión) justo al confirmar y volver a conectar | Aparece el aviso **«Hay una venta sin confirmar»**; no dice «No se registró nada» | |
| 5.8 | Con el aviso a la vista, intentar agregar un producto, cambiar una cantidad, vaciar el carrito o cambiar el medio de pago | Todo está bloqueado con un mensaje; el carrito no cambia | |
| 5.8b | Tocar «Reintentar registro» con la conexión ya restablecida | Se registra **una sola vez**, o muestra el comprobante de la venta que ya estaba registrada («Esta venta ya estaba registrada»); en «Ventas recientes» hay **una** venta | |
| 5.8c | Repetir el corte y, con el aviso a la vista, **recargar la página** | Al volver, la pantalla consulta sola: muestra el comprobante si la venta existía, o el aviso para reintentar con la misma operación | |
| 5.8d | Provocar un corte justo DESPUÉS de que la venta quedó registrada (por ejemplo, cortar apenas tocar «Registrar» con la conexión lenta) y comprobar el stock | El stock baja **una sola vez** aunque se reintente varias veces | |
| 5.8e | Con el aviso a la vista y sin conexión, tocar «Verificar si se registró» | Dice que no pudo consultar y **no** reenvía nada | |
| 5.8f | «Descartar intento» antes de los 2 minutos y después | Antes: pide esperar. Después, solo si la consulta confirmó que no hay venta: descarta y el carrito queda como estaba | |
| 5.9 | Vender todo el stock de la remera L (2 unidades) y volver a escanearla | Queda sin stock; no se puede agregar | |
| 5.10 | Con el stock bajo, armar una venta y, desde la cuenta de **gerente** en otra ventana, bajar ese stock; confirmar la venta del empleado | La base rechaza con «No alcanza el stock» e indica cuánto hay; el carrito se corrige sin vaciarse | |
| 5.11 | Con el gerente, cambiar el precio del Balde y confirmar una venta que el empleado tenía armada | Avisa que el precio cambió y muestra el nuevo; no cobra el viejo | |
| 5.12 | Abrir «Ventas recientes» (empleado) | Solo las suyas; el filtro por fecha y medio funciona | |

## 6. Comprobante e impresión

Con una venta concretada en pantalla.

| # | Paso | Resultado esperado | Real |
| --- | --- | --- | --- |
| 6.1 | Mirar el comprobante en pantalla | Nombre del negocio, dirección y localidad, «Comprobante #N», fecha y hora, vendedor, medio de pago, renglones con importe, total | |
| 6.2 | Comprobar la cuenta a mano | La suma de los importes es el total | |
| 6.3 | Buscar la leyenda | «Comprobante interno de operación. No es una factura ni un comprobante fiscal.» | |
| 6.4 | Tocar «Imprimir» | La vista previa muestra **solo** el comprobante (sin menú ni botones) | |
| 6.5 | Revisar lo impreso | Legible; **no** muestra el stock restante; entra en el papel | |
| 6.6 | Imprimir en la impresora térmica (si hay) | Anotar si cambia el tamaño y si hay que elegir el papel en el diálogo | |
| 6.7 | Tocar «Compartir» (celular) o «Copiar» (PC) | El texto lleva la identificación, los renglones con su importe, el total y la leyenda | |
| 6.8 | Comparar el número de comprobante con el de «Ventas recientes» | Coinciden | |
| 6.9 | Mirar la hora | Es la hora local correcta | |

## 7. Permisos con las tres cuentas

| # | Paso | Empleado | Gerente | CEO |
| --- | --- | --- | --- | --- |
| 7.1 | Menú | Dashboard y Escáner y ventas | + Stock, Productos, Categorías, Banners | + Usuarios |
| 7.2 | Vender | Sí | Sí | Sí |
| 7.3 | Ver ventas | Solo las propias | Todas | Todas |
| 7.4 | Entrada de stock y ajuste | **Rechazado** (ni siquiera se ofrece) | Sí | Sí |
| 7.5 | Abrir `/panel/stock` a mano | «Sección fuera de tu perfil» | Abre | Abre |
| 7.6 | Dar de alta un producto desde el escáner | Sí (queda sin publicar y sin stock) | Sí | Sí |
| 7.7 | Movimientos de stock | No los ve | Los ve | Los ve |

Anotar cualquier diferencia.

## 8. Stock y movimientos (cuenta de gerente)

| # | Paso | Resultado esperado | Real |
| --- | --- | --- | --- |
| 8.1 | Abrir «Control de stock» y el movimiento de la venta 5.1 | Tipo «venta», −3, stock resultante 17, quién y cuándo | |
| 8.2 | Entrada de 5 unidades con motivo | Stock +5; movimiento «entrada» | |
| 8.3 | Ajuste de −1 con motivo; sin motivo | Con motivo se registra; sin motivo lo rechaza | |
| 8.4 | Intentar dejar el stock en negativo | Lo rechaza | |
| 8.5 | Comprobar que cada stock actual = inicial + entradas − ajustes − ventas | Cierra | |

## 9. Lo que no se prueba aquí

Facturación fiscal (el sistema no la emite), anulaciones y devoluciones (no existen), pagos con tarjeta reales (no hay pasarela: el medio de pago solo se registra).

## 10. Registro

| Dato | Valor |
| --- | --- |
| Fecha y hora | |
| Proyecto de Supabase usado (confirmar que es el de prueba) | |
| Dispositivo, navegador, lector, impresora | |
| Ventas hechas (números de comprobante) | |
| Pasos aprobados | |
| Pasos fallidos, con el texto exacto del error y captura | |
| Hallazgos nuevos | |
| Responsable | |

Después: actualizar `estado.md` §4 con lo que se validó y lo que no.
