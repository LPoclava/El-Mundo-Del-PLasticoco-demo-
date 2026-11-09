# Comprobantes: interno y fiscal (ARCA)

Hay **dos circuitos separados**. Registrar una venta no crea, no solicita ni dispara ningún comprobante fiscal.

## 1. Comprobante interno (habilitado)

- Se genera al confirmar una venta y se puede **reabrir desde el detalle de cada venta** («Ver comprobante», en el escáner y en el dashboard).
- Contiene: logo, nombre, dirección y localidad del comercio, número y fecha, quién atendió, medio de pago, tabla con producto/variante, cantidad, precio unitario y subtotal, total y la leyenda **«Comprobante interno de operación. No es una factura ni un comprobante fiscal.»**
- Vista previa en pantalla; imprimir o **Guardar como PDF** desde el diálogo de impresión del navegador (nombre sugerido «Comprobante interno 000042»).
- No incluye stock restante ni códigos de barras.
- Código: `src/components/panel/pos/receipt-view.tsx`, `src/lib/pos/receipt.ts`.

## 2. Circuito fiscal (estructura preparada, SIN emisión)

**Estado: no emite nada.** No existe ninguna llamada a ARCA en el código. El adaptador de ARCA es un stub que falla con «no implementado».

### Acceso: solo el grupo de desarrollo de AImpulse Tech

- Tabla `developer_access` (sin políticas: no se toca por la API). Alta y baja **a mano desde el SQL Editor**:
  `insert into public.developer_access (user_id, note) values ('<uuid de auth.users>', 'AImpulse Tech');`
- `is_developer()` exige estar en la tabla **y** tener perfil activo. **Ser CEO del comercio no alcanza.**
- Validación en dos barreras independientes: el servidor (`/api/fiscal/*` pregunta `is_developer()` con la sesión de la persona) y la base (cada función `fiscal_*` llama a `require_developer()` y las tablas solo se leen con `is_developer()`).

### Endpoints (solo servidor, `src/app/api/fiscal/*`)

Todos exigen `Authorization: Bearer <token de sesión>`; sin cookies (no hay CSRF); respuestas sin caché, sin mensajes internos ni secretos.

| Ruta | Qué hace |
|---|---|
| `GET /api/fiscal/status` | Qué falta configurar (nombres, no valores), llaves de producción y `emission: "no-implementada"`. |
| `GET /api/fiscal/documents?venta=<uuid>` | Comprobantes fiscales registrados. |
| `POST /api/fiscal/request` | Registra la solicitud para una venta (`saleId`, `idempotencyKey`, `environment`). No envía nada a ARCA. |
| `POST /api/fiscal/process` | Procesa un pendiente (`documentId`, `retry?`). Hoy termina en «sin credenciales» (409) o en «error» registrado. |

### Estados y trazabilidad

`pendiente → en_proceso → emitido | rechazado | error`, y `error → pendiente` (reintento). «No solicitado» es no tener fila. **«Anulado» no existe**: exige notas de crédito y no hay circuito real que lo respalde.
Cada paso deja un evento de solo agregado (`fiscal_events`): solicitud, solicitud a ARCA, respuesta, error, cambio de estado (quién, cuándo, de qué a qué). Los eventos rechazan por base cargas con campos que parezcan credenciales y el servidor las descarta antes.

### Idempotencia y duplicados

- Una venta, un comprobante (`unique(sale_id)`); la solicitud es idempotente por venta y por clave.
- Un comprobante resuelto (`emitido`, `rechazado`) o en curso no vuelve a llamar al proveedor; la transición bloquea la fila.
- Un `emitido` exige tipo, punto de venta, número, CAE (14 dígitos) y vencimiento.

### Producción: dos llaves, ambas apagadas

1. Base: `fiscal_settings.production_enabled = false` (solo el propietario puede cambiarla por SQL Editor).
2. Servidor: `FISCAL_PRODUCTION_ALLOWED` vacío (debe valer exactamente `1`).

Con cualquiera apagada, no se puede solicitar ni procesar en producción.

### Secretos

Solo variables de entorno del **servidor** (sin `NEXT_PUBLIC_`), nunca en el repositorio ni en la base: `FISCAL_ARCA_CUIT`, `FISCAL_ARCA_POINT_OF_SALE`, `FISCAL_ARCA_CERT`, `FISCAL_ARCA_KEY`, `FISCAL_ARCA_ENV`. `.gitignore` excluye `*.pem`, `*.p12`, `*.pfx`, `*.crt`, `*.key`. No se usa `service_role`: las llamadas a la base corren con la sesión de la persona.

## Qué falta para habilitar producción (lista de verificación)

Bloqueado hoy por **datos y credenciales que no existen en el proyecto**:

1. Datos fiscales del comercio confirmados: razón social, CUIT, condición frente al IVA, punto de venta electrónico habilitado en ARCA.
2. Certificado digital y clave privada de ARCA (homologación primero, producción después), cargados como variables de servidor en Vercel.
3. Integración real en `src/lib/fiscal/provider.ts`: WSAA (ticket de acceso) y WSFEv1 (autorizar comprobante, consultar último número), con manejo de vencimientos y de reintentos que no dupliquen numeración.
4. Una función de base (security definer, solo desarrollo) que entregue al servidor los datos de la venta a facturar sin depender del rol del comercio de quien opera.
5. Definir tipo de comprobante (A, B, C o E), alícuotas e importes, datos del receptor y el diseño del comprobante fiscal (CAE, QR de ARCA).
6. Anulaciones: notas de crédito (hoy fuera de alcance).
7. Pruebas contra el entorno de **homologación** de ARCA, con un usuario de desarrollo dado de alta en `developer_access`.
8. Recién entonces: `fiscal_settings.production_enabled = true` y `FISCAL_PRODUCTION_ALLOWED=1`, con autorización explícita del responsable.
9. Pendiente de seguridad: límite de frecuencia por cuenta en `/api/fiscal/*` y una prueba de bloqueo de fila con conexiones reales.
10. Interfaz del panel para desarrolladores (hoy el circuito se usa por las rutas del servidor).
