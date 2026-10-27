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

## Mensajes de error

| Situación | Qué se muestra |
|---|---|
| Permiso denegado | «Sin permiso para usar la cámara», con cómo habilitarlo y «Reintentar» |
| Sin cámara | «No hay cámara disponible» y opción de ingresar a mano |
| Cámara en uso por otra app | «No se pudo acceder a la cámara» y «Reintentar» |
| Sin HTTPS | «La cámara necesita una conexión segura (HTTPS)», con la dirección actual |
| 12 segundos sin leer nada | Consejos: acercar o alejar, mejorar la luz, linterna si el teléfono la tiene |
| Lectura dudosa o no es un código de producto | Aviso en la propia vista previa, y sigue escaneando |

## Qué se probó y qué no

Probado en la computadora, con un **flujo de video sintético** (un lienzo que dibuja un EAN-13), no con
una cámara real:

- Permiso denegado, sin cámara y cámara ocupada: los tres mensajes y sus botones.
- Lectura de un código conocido y de uno desconocido; el alta con el código ya completado.
- Una sola lectura por escaneo: tras leer, el video queda en pausa y no hay lecturas nuevas.
- Reanudar con el mismo código a la vista: no se repite en el acto (pausa de 2 s desde reanudar).
- Al cerrar la cámara, las pistas de video terminan (la luz de la cámara se apaga).
- Decodificación de EAN-13 limpios, reducidos, desenfocados y girados (`node --test scripts/barcode-decode.test.mjs`).

**No probado:** una cámara real, la calidad de lectura con productos físicos, el cambio de cámara
frontal y trasera, la linterna, el sonido y la vibración, ni los navegadores de iPhone. Eso solo se
verifica en un teléfono.
