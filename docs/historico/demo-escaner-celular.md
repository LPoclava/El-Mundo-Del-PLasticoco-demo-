> **Histórico: describe la etapa de demostración del escáner (28 de octubre de 2026).** El escáner ya vende contra Supabase (ver [../pos-ventas.md](../pos-ventas.md)). Siguen vigentes las secciones de HTTPS, permisos de cámara y mensajes de error.

# Escáner con cámara en la demo del panel

Estado: implementado y probado **sin cámara real** (ver "Qué se probó y qué no"). Falta probarlo en un
celular con un producto real.

## Cómo funciona

- Pantalla: **Panel → Consulta de precios → «Escanear código de barras»**.
- Pide permiso de cámara, muestra la vista previa con un marco de lectura y lee solo lo que queda
  **dentro del marco**. Al leer un código: pita, vibra, marca el marco en verde y **pausa** la lectura.
  Luego ofrece «Escanear otro código» y «Cerrar cámara».
- El ingreso manual queda debajo, como alternativa. En computadora no hace falta abrir la cámara.
- El video se procesa en el navegador. No se graba ni se envía a ningún servidor.
- Todo lo que sigue a la lectura (consultar, cambiar precio, dar de alta) sigue siendo **simulado**:
  vive en la memoria del navegador y no toca Supabase.

## Biblioteca y formatos

- **`@zxing/library` 0.23** (JavaScript puro, sin WebAssembly), cargada solo al abrir la cámara.
- Si el navegador trae `BarcodeDetector` con EAN-13, se usa ese (más rápido). Si no, o si falla,
  se usa ZXing. No se depende de `BarcodeDetector`.
- Formatos: **EAN-13, EAN-8, UPC-A, UPC-E y Code 128**.
- Se descartan lecturas dudosas: en EAN-13, EAN-8 y UPC-A se verifica el dígito verificador, y solo
  se aceptan códigos de 8 a 14 dígitos (el formato que admite la base).
- Código: `src/lib/barcode/` (lectura y dígito verificador) y `src/components/panel/barcode-scanner.tsx`.

## Requisito: HTTPS

Los navegadores solo permiten usar la cámara en un **contexto seguro**: `https://` o `localhost`.
Con `http://192.168.x.x:3000` desde el celular, **la página carga pero la cámara no se habilita**, y
la demo lo avisa con un mensaje. Opciones para probar en el celular:

| Opción | Pasos | Notas |
|---|---|---|
| **A. Marcar la dirección como segura en Chrome (Android)** | 1) Misma red Wi-Fi que la PC. 2) En el celular abrí `chrome://flags/#unsafely-treat-insecure-origin-as-secure`. 3) Escribí `http://192.168.1.232:3000`, elegí **Enabled** y reiniciá Chrome. 4) Abrí `http://192.168.1.232:3000/panel/login`. | Lo más rápido, sin instalar nada. Es solo para ese teléfono: desactivalo al terminar. La IP puede cambiar. |
| **B. Túnel HTTPS (Cloudflare Tunnel)** | 1) Con el servidor corriendo, en otra terminal: `cloudflared tunnel --url http://localhost:3000`. 2) Copiá la dirección `https://….trycloudflare.com`. 3) Agregala a `allowedDevOrigins` en `next.config.ts` (solo el host, sin `https://`) y reiniciá el servidor. | Funciona en cualquier celular. **Expone tu servidor local en internet mientras el túnel esté abierto**; la demo solo tiene datos ficticios. Requiere instalar `cloudflared`. |
| **C. Versión de prueba publicada** | Subir el código y publicar una vista previa (por ejemplo en Vercel). | Da HTTPS real sin tener la PC prendida, pero requiere subir a GitHub. |

No recomendado: `next dev --experimental-https`, porque instala un certificado propio en el sistema
y el celular tendría que confiar en él.

## Cómo comprobar el escaneo con un producto real

1. Abrí el panel desde el celular (por A o B), elegí un perfil y entrá a **Consulta de precios**.
2. Tocá **«Escanear código de barras»** y aceptá el permiso de cámara.
3. Apuntá al código de un producto real (cualquier EAN-13 de un paquete). Se va a leer y mostrar
   **«Código no registrado»**, porque la demo solo conoce sus productos ficticios.
4. Tocá **«Dar de alta este producto»**: el código ya viene completo. Cargá nombre, categoría y
   precio, y creá el producto (simulado, queda sin publicar).
5. Tocá **«Escanear otro código»** y volvé a apuntar al **mismo producto**: ahora debe mostrar el
   producto y su precio, con las acciones de «Modificar precio» y «Vincular código».

Los datos se pierden al recargar la página.

**Sin un producto real:** en la sección «Probar la cámara sin un producto real» (debajo de la
pantalla) hay códigos EAN-13 de ejemplo. Abrilos en la computadora y apuntá el celular a la pantalla.
Tres corresponden a productos de la demo y el cuarto es desconocido, para probar el alta.

## Permisos de cámara en Google Chrome

- La cámara **no se enciende al cargar la página**. Se pide recién al tocar «Escanear código de barras»
  (o «Reintentar» / cambiar de cámara): `getUserMedia` se llama dentro de ese toque.
- Pide la cámara trasera (`facingMode: { ideal: "environment" }`); en una computadora usa la webcam.
- Al cerrar el lector, o al salir de la pantalla, se detienen **todas** las pistas del `MediaStream`:
  la luz de la cámara se apaga.
- Si Chrome ya tenía el permiso concedido, abre directo, sin volver a preguntar.
- Si cerrás el aviso sin elegir, Chrome puede volver a preguntar al tocar «Reintentar». Si elegiste
  «Bloquear», ya no pregunta: hay que habilitarla a mano (Chrome → ícono a la izquierda de la
  dirección → Permisos → Cámara → Permitir). Si sigue bloqueada, Ajustes de Android → Aplicaciones →
  Chrome → Permisos → Cámara.

## Mensajes de error

Cada error tiene su propio mensaje: **no todo es «permiso denegado»**.

| Situación | Qué se muestra |
|---|---|
| Permiso bloqueado (`NotAllowedError`, Chrome en «denied») | «Chrome tiene bloqueada la cámara para este sitio», con los pasos para habilitarla y «Reintentar» |
| Aviso cerrado sin elegir (`NotAllowedError`, Chrome en «prompt») | «No se otorgó el permiso de la cámara»: tocá «Reintentar» y elegí «Permitir» |
| Sin cámara (`NotFoundError`) | «No hay cámara disponible» y opción de ingresar a mano |
| Cámara en uso o con falla (`NotReadableError`) | «No se pudo usar la cámara»: cerrá la otra aplicación y «Reintentar» |
| Sin HTTPS | «La cámara necesita una conexión segura (HTTPS)», con la dirección actual |
| La cámara se detuvo (Chrome la cerró al cambiar de app) | «La cámara se detuvo» y «Reintentar» |
| No cargó el lector de códigos | «No se pudo iniciar el lector de códigos» y «Reintentar» |
| 12 segundos sin leer nada | Consejos: acercar o alejar, mejorar la luz, linterna si el teléfono la tiene |
| Lectura dudosa o no es un código de producto | Aviso en la propia vista previa, y sigue escaneando |

## Qué se probó y qué no

Probado en una computadora (navegador integrado de la herramienta, no Chrome de un celular):

- La cámara **no se pide al cargar** la página (0 llamadas a `getUserMedia` antes del toque).
- `getUserMedia` se llama dentro del mismo toque, con `facingMode: { ideal: "environment" }`. El toque de
  la prueba fue simulado por código, así que no se pudo comprobar la «activación del usuario» real.
- Permiso **realmente denegado** (el navegador integrado bloquea la cámara y la Permissions API devolvió
  «denied»): aparece el mensaje de bloqueo con los pasos.
- Los demás errores (sin cámara, cámara ocupada, sin HTTPS, lector sin cargar) con `node --test scripts/camera-errors.test.mjs`.
- Con un **video sintético** (un lienzo que dibuja un EAN-13, no una cámara): lectura de un código, una sola
  lectura por escaneo, reanudar sin repetir en el acto, cerrar (las pistas pasan a «ended» y `srcObject` queda
  vacío) y volver a abrir.
- Decodificación de EAN-13 limpios, reducidos, desenfocados y girados (`node --test scripts/barcode-decode.test.mjs`).

**No probado:** Chrome en un celular, el primer aviso de permiso real, el permiso «ya concedido», cámara real,
lectura de un producto físico, cambio de cámara frontal y trasera, linterna, sonido, vibración, ni iPhone.
Eso solo se verifica en un teléfono. Lista de comprobación para hacerlo:

1. Abrí la demo con HTTPS en Chrome del celular: debe verse el botón y **ninguna cámara encendida**.
2. Tocá «Escanear código de barras»: Chrome muestra su aviso. Elegí **«Permitir»** y verificá que se vea la cámara trasera.
3. Leé un código real. Debe pitar, pausar y mostrar el resultado.
4. Tocá «Cerrar cámara»: la luz de la cámara y el ícono de grabación en la barra de Chrome deben apagarse.
5. Volvé a abrir: no debe preguntar de nuevo (permiso ya concedido).
6. Cerrá el sitio y repetí eligiendo **«Bloquear»** (o bloqueá la cámara desde Permisos del sitio): debe aparecer el mensaje con los pasos.
