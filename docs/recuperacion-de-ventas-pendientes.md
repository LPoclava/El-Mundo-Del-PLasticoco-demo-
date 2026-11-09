# Ventas con resultado incierto: recuperación sin duplicar (hallazgo H1)

Corrección del hallazgo H1 de la fase 0.4, autorizada el 8 de noviembre de 2026. Rama local `etapa-0-estabilizacion`. **No se tocó la base de datos**: ni migraciones, ni RLS, ni permisos, ni `confirm_sale`. No se hicieron ventas reales ni se tocó stock real.

## 1. Causa raíz

La base ya garantizaba que **una misma clave de operación no puede registrar dos ventas** (restricción única `(user_id, idempotency_key)` más un candado por clave dentro de `confirm_sale`). El problema estaba en la pantalla, que generaba una clave **nueva** para una venta que quizás ya existía:

1. La clave del intento vivía solo en memoria (`attemptRef`): una **recarga** la perdía.
2. Cualquier **edición del carrito** (o vaciarlo) la cambiaba por otra clave, sin avisar y sin saber si el intento anterior se había registrado.
3. Nadie **consultaba** si esa clave ya tenía una venta antes de permitir armar o reenviar.
4. El aviso decía «No se registró nada» también cuando el resultado era desconocido, lo cual podía ser falso.

Con un corte de red justo después de que la base confirmó, el cliente pagaba dos veces y el stock bajaba dos veces.

## 2. Comportamiento antes y después

| Escenario | Antes | Ahora |
| --- | --- | --- |
| **Corte antes de enviar** (el pedido nunca llegó) | Mensaje de resultado incierto con «No se registró nada». Reintentar con la misma clave funcionaba si no se tocaba nada | La clave y lo enviado ya están guardados. Queda un aviso «Hay una venta sin confirmar». Reintentar consulta primero (no hay venta) y reenvía con la **misma** clave: una sola venta |
| **Corte durante el procesamiento** | Igual que el anterior; la base pudo o no registrarla | Igual que el anterior; ahora el reintento consulta antes de reenviar, así que reconoce una venta que sí llegó a registrarse |
| **Venta confirmada pero respuesta perdida** | Con el carrito intacto, el reintento devolvía «ya estaba registrada». Si se editaba el carrito o se vaciaba, **se duplicaba** | La consulta por clave encuentra la venta, se muestra su comprobante y el intento se cierra. No hay forma de armar otra venta antes |
| **Recarga antes de recibir respuesta** | La clave se perdía: «Registrar venta» generaba otra y **se duplicaba** | Al recargar, el intento sigue guardado. La pantalla consulta sola si la venta existe: si existe, muestra el comprobante; si no, ofrece reintentar con la misma clave |
| **Carrito modificado tras un resultado incierto** | Se generaba una clave nueva sin avisar: **riesgo de duplicado** | **No se puede modificar** (cantidades, quitar, vaciar, agregar productos ni cambiar el medio de pago) hasta resolver. La clave pertenece a ese contenido |
| **La misma clave con otro contenido** | La base devolvía la venta original sin avisar | Igual en la base (no registra una segunda), pero la pantalla compara el total y las unidades del comprobante con lo que se envió y, si no coinciden, **no lo presenta como la venta de ahora** |
| **No se puede guardar el intento** (navegador sin espacio o ventana privada) | No aplicaba | La venta sigue y se registra una vez; si el resultado es incierto, el intento queda en memoria, bloquea otra venta y la pantalla avisa «no recargues ni cierres la página» |
| **No se puede consultar** (sin conexión) | No aplicaba | **No se reenvía a ciegas**: queda pendiente hasta poder consultar |

## 3. Solución implementada

### Piezas

| Archivo | Qué hace |
| --- | --- |
| `src/lib/pos/attempt.ts` (nuevo) | El intento (clave, medio de pago, renglones, estado, hora del último envío) y su guardado en `sessionStorage` con lectura estricta; `runConfirm` (confirmar sin duplicar), `verifyAttempt` (solo consultar), `canDiscard` y `planConfirm`. Es lógica pura con dependencias inyectadas |
| `src/lib/pos/api.ts` | Nueva `findSaleByKey(db, userId, key)`: consulta si esa clave ya tiene una venta **de esta cuenta** (filtra por la cuenta además de la clave) y distingue «no hay venta» de «no se pudo consultar» |
| `src/components/panel/pos/pos-section.tsx` | Usa `runConfirm`; carga el intento al entrar y lo verifica de inmediato; bloquea agregar productos, cambiar el carrito y vaciarlo con un intento pendiente; pide confirmación al cerrar la ventana |
| `src/components/panel/pos/pos-cart-drawer.tsx` | Aviso «Hay una venta sin confirmar» con tres acciones (reintentar, verificar, descartar); congela el carrito; ya no dice «No se registró nada» cuando el resultado es incierto |
| `src/components/panel/pos/pos-parts.tsx` | `QuantityStepper` admite `disabled` |

### El flujo

1. **Antes de enviar**, se guarda el intento: clave nueva, medio de pago y los renglones tal como se envían. No depende del borrador del carrito.
2. **Se envía** con esa clave.
3. **Si la base confirma:** se muestra el comprobante, el carrito se vacía y el intento se borra.
4. **Si la base rechaza** (stock, precio, permiso, datos inválidos): la base no registró nada, así que el intento se borra y el carrito se corrige sin vaciarse.
5. **Si no se sabe** (corte, sin respuesta, error desconocido): el intento queda guardado como pendiente y **bloquea cualquier otra venta**.
6. **Resolver un pendiente**, con tres caminos:
   - **Reintentar registro:** primero consulta si esa clave ya tiene una venta. Si la tiene, la muestra y cierra el intento; si no, reenvía con la **misma** clave y el **mismo** contenido (la base reconoce la clave y no puede duplicar). Si la consulta falla, no reenvía.
   - **Verificar si se registró:** solo consulta.
   - **Descartar intento:** solo aparece cuando la consulta confirmó que **no** hay venta, y recién pasados 2 minutos desde el último envío.

### Por qué esos 2 minutos

Una venta que llegó a la base pero todavía no había terminado no puede seguir ejecutándose más allá del límite de duración de las consultas de Supabase (segundos). Si la consulta no la encuentra y pasó ese margen, el pedido original ya no puede registrarse a escondidas. Antes de eso, descartar y armar otra venta con otra clave **sí podría duplicar**.

### Garantía de que una clave no confirme dos ventas

| Nivel | Garantía |
| --- | --- |
| Base de datos (sin cambios) | `unique (user_id, idempotency_key)` y un candado por clave dentro de `confirm_sale`: como máximo una venta por cuenta y clave, aun con pedidos simultáneos |
| Pantalla | Una clave pertenece a **un solo contenido** (la firma del carrito y del medio de pago). Con un intento pendiente no se puede cambiar el contenido ni generar otra clave. La clave se guarda **antes** de enviar y sobrevive a una recarga |
| Defensa adicional | Si una clave devolviera una venta con otro contenido, la pantalla no la toma por la actual |

No se agregó una restricción en la base para rechazar «misma clave con otro contenido» (eso exigiría una migración y cambiar `confirm_sale`). Queda como propuesta opcional en la sección 5.

## 4. Pruebas

| Dónde | Archivo | Resultado |
| --- | --- | --- |
| Lógica del navegador con un servidor simulado | `scripts/pos-intento.test.mjs` | **44 de 44** |
| Base de datos real (PGlite) | `supabase/tests/pos-recuperacion.test.mjs` | **10 de 10** |
| PostgreSQL real, conexiones separadas | `supabase/tests/concurrency.mjs` | **10 de 10** (7 anteriores + 3 nuevas) |

**Casos pedidos, y dónde está cada uno:**

| Caso obligatorio | Cobertura |
| --- | --- |
| Reintento con la misma clave y el mismo carrito | `pos-intento`: corte antes de llegar, y la clave idéntica en cada reintento |
| Reintento con la misma clave y un carrito modificado | `pos-intento`: queda **bloqueado**, sin clave nueva ni envío al servidor; también con otro medio de pago |
| Recarga con una venta todavía pendiente | `pos-intento`: recarga con la venta registrada, sin registrar, y con el intento en estado «enviando» |
| Corte de red después de confirmar en la base | `pos-intento` y `pos-recuperacion`: la base la registró, el reintento la encuentra por consulta y **no reenvía** |
| Respuesta perdida y posterior recuperación | las tres capas; en PostgreSQL real con una respuesta descartada |
| Dos solicitudes simultáneas con la misma clave | `pos-intento` (dos pantallas), y `concurrency.mjs`: 8 envíos a la vez y 6 reintentos a la vez tras una respuesta perdida |
| Error de persistencia del borrador | `pos-intento`: almacenamiento que lanza errores, con venta normal y con resultado incierto |
| No se generan ventas, detalles ni movimientos duplicados | Todas las pruebas comprueban ventas, detalle, movimientos, stock, medio de pago y total; el libro verifica que el stock cierre con sus movimientos |

Además: la consulta por clave no cruza cuentas (un gerente ve ventas de todos, por eso la pantalla filtra por la cuenta); una venta rechazada, sin permiso o con datos inválidos cierra el intento; un intento dañado se descarta entero; el intento de una cuenta no lo retoma otra cuenta en el mismo navegador.

**Verificación de que las pruebas sirven:** se introdujeron tres defectos a propósito en `attempt.ts` y cada uno hizo fallar pruebas (no guardar antes de enviar: 2 fallos; reenviar sin consultar: 3; permitir otra venta con un intento pendiente: 4). Después se restauró el archivo y volvieron a pasar las 44.

**Límites de las pruebas:** el «servidor» de `pos-intento` es una simulación (el comportamiento real de la base lo prueban las otras dos capas); la pantalla en sí (aviso, botones) no se probó con un navegador y un corte de red reales; eso queda en el protocolo físico.

## 5. Riesgos que continúan abiertos

| # | Riesgo | Detalle |
| --- | --- | --- |
| R1 | **Descartar antes de tiempo en una conexión muy lenta** | El margen de 2 minutos cubre el límite de las consultas de Supabase, pero si ese límite se aumentara mucho en la configuración, habría que subir el margen |
| R2 | **Cuenta desactivada con una venta pendiente** | Si desactivan la cuenta justo después de confirmar, la persona no puede ver su venta (RLS) ni reenviar; la base la conserva (probado). Lo resuelve un gerente mirando las ventas |
| R3 | **Otra pestaña del mismo navegador** | `sessionStorage` es por pestaña: un intento pendiente en una pestaña no bloquea a otra pestaña abierta con la misma cuenta. La clave sigue protegiendo la repetición exacta, pero no una venta nueva armada en la otra pestaña |
| R4 | **Cerrar la pestaña con un intento pendiente** | Se pierde el intento guardado (la sesión del navegador termina). La venta, si se registró, está en «Ventas recientes»; hay que mirarla antes de rearmarla |
| R5 | **Misma clave con otro contenido** | La base no lo rechaza (devuelve la original). Se podría endurecer con una migración que guarde una huella del contenido; no se hizo sin autorización |
| R6 | **No existe anulación de ventas** | Una venta equivocada no se puede anular (decisión del negocio pendiente) |
| R7 | **Sin prueba con navegador y red reales** | La pantalla nueva no se probó con un corte real de conexión ni en un celular |

## 6. Compatibilidad

- No cambió ninguna función, tabla, política ni permiso de la base: las ventas existentes y el circuito actual no se tocaron.
- El borrador del carrito conserva su formato y su clave de almacenamiento (`mp-venta-borrador`); el intento usa una clave aparte (`mp-venta-intento`). Sin un intento pendiente, el circuito se comporta como antes.
- El texto de «no se registró nada» solo aparece cuando es cierto.
