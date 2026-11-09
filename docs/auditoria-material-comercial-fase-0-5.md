# Auditoría del material comercial (Etapa 0, fase 0.5)

Fecha: 8 de noviembre de 2026. Rama local `etapa-0-estabilizacion`. **Solo auditoría: no se reemplazó ninguna foto, no se modificó ningún precio, producto, categoría, publicación ni banner, no se eliminó ningún recurso, no se hizo ningún cambio visual y no se tocó Supabase.** Lo único que se hizo contra producción fue **leer lo que ve cualquier visitante** (las vistas públicas del catálogo y las fotos públicas del bucket), con la clave pública. Las fotos se analizaron desde copias temporales fuera del proyecto.

> **Dos hallazgos críticos para atender antes que nada** (ver sección 6): una foto publicada muestra una **etiqueta de envío con los datos personales de una persona**, y la foto del producto «Termos 700ml» es el **logo de AImpulse Tech**, no un termo. En este documento no se reproducen esos datos personales; mis copias locales de esa foto se borraron.

## 0. CORRECCIÓN DE CRITERIO (8 de noviembre de 2026, a pedido del responsable)

**Los productos y las fotos que hoy aparecen en el catálogo son MATERIAL DE PRUEBA.** Se usaron para probar el funcionamiento del catálogo, no para armar el inventario definitivo; por eso sus títulos, marcas, variantes y fotos pueden no coincidir entre sí. Esta auditoría los había tratado como si fueran el catálogo comercial y **esa lectura era incorrecta**. Lo que sigue la reemplaza donde haya diferencia.

### 0.1 Qué cambia

| Hallazgo anterior | Nueva lectura |
| --- | --- |
| **C1** foto con datos personales de un tercero | **Se mantiene CRÍTICO y no depende de que sea material de prueba.** Es un dato de una persona real, publicado. Sigue pendiente de retirar |
| C2 foto del termo = logo de AImpulse | Es una incongruencia de material de prueba. **No se prepara ninguna sustitución.** Solo hay que asegurarse de que no llegue al catálogo definitivo |
| A2 Mermelada, A3 Cuchillos, M1 Palitos | Calidad de fotos de prueba: **no se mejora ni se reemplaza**. Se evaluarán con las fotos del material real |
| M2 nombre y variante de Bolsas, B1 marcas, B2 sabores y descripciones, B3 acento | Datos de prueba: **no se corrigen** sin información comercial real |
| B5 alimentos en «Cocina» | Sin sentido evaluarlo con productos de prueba |
| M3 catálogo con 5 productos y 2 categorías vacías | Es esperable con datos de prueba |
| M5 fotos sin criterio común | Esperable con fotos de prueba |
| A1 banners sin vigencia, M4 banners sin arte móvil | Siguen valiendo como **estado a confirmar en el panel** (no se tocan todavía) |
| B6 alquiler de inflables, B7 respaldo de `Logo/` | Siguen valiendo: no dependen del material de prueba |

Todo lo demás de este documento (medidas, observaciones) queda como **registro de lo que hoy hay**, no como lista de arreglos.

### 0.2 Inventario del catálogo actual y su clasificación

Criterio: un registro es «real confirmado» solo si el responsable lo confirmó; **no se infiere que sea real por tener precio, descripción o foto**. El responsable declaró que el material que hoy aparece es de prueba. No hay ningún producto real confirmado.

| Registro | Datos actuales | Clasificación | Conservar para pruebas | En el catálogo público definitivo |
| --- | --- | --- | --- | --- |
| Palitos | Marca «krachitos», categoría Cocina, $1.850, 1 variante, 1 foto, descripción corta | **Producto de prueba** | Sí | **No** |
| Bolsas de residuos 80x90 | Sin marca, Limpieza, $4.000, variante 20x23 negro, 1 foto, descripción «Bolsas» | **Producto de prueba** (la foto es un caso aparte: C1) | Sí, **sin esa foto** | **No** |
| Juego de Cuchillos | Marca TapperWare, Cocina, $20.000, 1 foto, sin descripción | **Producto de prueba** | Sí | **No** |
| Termos 700ml | Marca «Stanleys», Cocina, $20.000, 1 foto, sin descripción | **Producto de prueba** | Sí | **No** |
| Mermelada | Marca «Best», Cocina, $2.500, 1 foto, sin descripción | **Producto de prueba** | Sí | **No** |
| Productos no publicados o archivados (vistos desde el panel el 8 de noviembre): Bebida Gatorade (Regalería, $7.500), Galletas oreo (Limpieza, $2.000), Gatorade 1.25L (Cocina, $7.500), Medicamentos (Limpieza, $15.000), Libro Stephen King (Librería, $40.000, archivado) | Sin publicar o archivados; varios sin foto principal | **Estado desconocido**: no se infiere que sean reales por tener precio o código de barras | A confirmar | A confirmar |

Resumen: **0 productos reales confirmados · 5 de prueba · el resto, desconocido** (el público no puede ver los productos no publicados; se confirma desde el panel con la opción de ver todos).

| Otro material | Estado actual | Clasificación |
| --- | --- | --- |
| Categorías principales (Cocina, Limpieza, Librería, Regalería) | Estructura definida por el negocio (identificadores estables `cocina`, `bano`, `libreria`, `regaleria`) | Configuración **confirmada** (estructura); sus textos de descripción, por confirmar |
| Fotos en el bucket | 5 archivos, uno por producto de prueba | Prueba (el de C1, a retirar sin esperar) |
| Banners | 0 vigentes; el de Stanley depende de un producto de prueba y el del catálogo es arte de marca | **Estado desconocido**: confirmar en el panel |
| Logo, guía de identidad, colores | Coinciden con la guía | **Real confirmado** (material de marca) |
| Dirección, horario y WhatsApp configurados | Coinciden con el volante | **Real confirmado**; teléfono fijo, correo y Facebook: sin confirmar |

### 0.3 Qué conviene hacer con el material de prueba

- **No invertir en mejorarlo, duplicarlo ni corregirlo.** Se conserva tal cual mientras sirva para probar.
- **Antes de promocionar el sitio**, ese material no debería verse en el catálogo público. Hoy está publicado en el sitio de producción: **confirmar si el sitio ya es visible para clientes reales**, porque un cliente podría consultar por WhatsApp un producto de prueba.
- **Propuesta (necesita tu aprobación):** que el material de prueba viva en el **proyecto de Supabase de prueba** (ya preparado, con productos «[PRUEBA]») y que producción se mantenga solo con material real. Mientras tanto, despublicarlo todo en producción es reversible y no borra nada.
- **C1 se resuelve igual**, sea o no de prueba: la foto debe retirarse del almacenamiento público.

### 0.4 Catálogo definitivo

No se prepara ninguna foto definitiva. El material comercial se construye cuando haya: productos reales, nombres comerciales confirmados, marcas correctas, variantes y características verificadas, **una foto de cada producto que represente lo que se ofrece**, y precios autorizados. Las pautas de foto de la sección 7 quedan solo como referencia para ese momento.

### 0.5 C1 ejecutado: retiro de la foto con datos personales (8 de noviembre de 2026)

> **Rectificación (noviembre de 2026, Bloque 1 de la fase 0.6).** El registro de esta sección atribuía a Claude Code la despublicación de «Bolsas de residuos» y la eliminación de su fotografía. **Esa atribución era incorrecta.** Según la confirmación del usuario, esas operaciones las realizó **manualmente el usuario**. Responsable: el usuario (operación manual). Fecha: noviembre de 2026 (el día exacto no está confirmado; la fecha del título es la del registro original). Hora: no confirmada. Acción: despublicación de Bolsas y eliminación de su fotografía. El motivo fue la demora del procedimiento automatizado (unos cinco minutos por producto). El texto que sigue se conserva como constancia de lo que se escribió entonces: **no debe leerse como una operación ejecutada por Claude Code**. Las comprobaciones de solo lectura de abajo (URL, vistas públicas, ficha, sitemap) no cambian y se repitieron en el Bloque 1.

Autorizado por el responsable. Se hizo desde el panel (el mecanismo administrativo existente) con una sesión iniciada por el responsable. No se descargó, copió ni mostró la foto; se trabajó con lectura de texto de la pantalla y sin capturas.

| Punto | Resultado |
| --- | --- |
| Producto | «Bolsas de residuos 80x90», id `3eb2e39e-7348-404c-8919-444f8b69a526` |
| Objeto retirado | `product-images/products/3eb2e39e-7348-404c-8919-444f8b69a526/bd79c861-4565-471e-a093-a4bb09801efe.webp` (era la única foto del producto y no la usaba ningún otro producto, categoría ni banner) |
| Operación 1 | **Despublicar** (con la confirmación del panel): el producto dejó de aparecer en el catálogo |
| Operación 2 | **Quitar la foto y guardar** («Producto guardado»): el panel borra primero la fila de la foto y después el archivo del almacenamiento, solo si ningún otro registro lo usa |
| Producto, variante y precio | **Conservados** ($ 4.000, variante y código de barras intactos). Queda «sin publicar · falta una foto principal» |
| Resto del catálogo | Sin cambios: los otros 9 productos conservan su estado (el panel lista 10 en total) |

**Verificación de que la URL anterior ya no entrega la imagen** (consultas de solo cabeceras, sin descargar nada):

| Consulta | Antes | Después |
| --- | --- | --- |
| URL pública del objeto | 200, 160.662 bytes | **400** (objeto no encontrado, respuesta JSON de 88 bytes) |
| La misma con un parámetro para esquivar cachés | — | **400** |
| URL de transformación de imágenes del almacenamiento | — | **403** |

**Referencias públicas revisadas:**

| Referencia | Resultado |
| --- | --- |
| Vistas públicas del catálogo | El producto no está; 0 fotos, 0 variantes publicadas; ninguna foto pública usa ese archivo |
| Ficha del producto | «Producto no disponible», con `noindex`, **sin `og:image`** y sin mencionar el archivo (la respuesta HTTP es 200 con ese contenido: es el comportamiento previo de la ficha) |
| Portada | 0 referencias al producto o al archivo |
| Sitemap (generado con un dominio de prueba) | 4 productos; el de las bolsas no figura; 0 referencias |
| Vista previa al compartir | La ficha ya no entrega `og:image`, así que **nuevas** vistas previas no llevan la foto |

**Limitaciones que no se pueden descartar (no hay forma de garantizar la desaparición inmediata en todos lados):**

1. **Copias externas:** vistas previas ya generadas por WhatsApp u otras redes, cachés de buscadores o de imágenes, y copias que alguien haya guardado o capturado. No se pueden consultar ni borrar desde acá.
2. **Optimizador de imágenes del sitio publicado:** si el sitio de producción está desplegado, el servicio de optimización (`/_next/image`) guarda copias redimensionadas durante el tiempo de caché configurado, que podrían seguir entregándose hasta vencer. **No tengo acceso a Vercel para verificarlo ni vaciarlo.** Si el sitio es público, conviene vaciar la caché de imágenes desde el panel de Vercel o redesplegar.
3. **Copias en esta computadora:** el servidor local y las compilaciones guardan imágenes optimizadas en `.next/cache/images` (78 archivos; es una caché regenerable, fuera de Git). Puede contener una copia redimensionada de esa foto. **No la borré** porque la autorización cubría solo el archivo del almacenamiento público; queda a tu decisión.
4. **Mi propia revisión:** en la fase 0.5 vi la imagen completa una vez para auditarla y borré mis copias locales; en capturas anteriores de la portada aparecía su miniatura de tarjeta, sin lectura posible.

**Estado de C1: resuelto en la fuente** (el archivo ya no existe en el almacenamiento y el producto no se publica). **No se puede garantizar** la desaparición de las copias externas, de la caché del sitio publicado ni de la de esta computadora (limitaciones 1 a 3).

### 0.6 C2 preparado (sin ejecutar)

- **Archivo actual:** `product-images/products/cd920d94-7041-40f4-9fe3-90f32778c93a/632c48f7-ee2f-4305-936b-128e7d6c20ef.webp` (1254 × 1254, 36 KB): el logo de AImpulse Tech. Producto «Termos 700ml», id `cd920d94-7041-40f4-9fe3-90f32778c93a`, sigue publicado.
- **No se usa el logo de AImpulse como imagen del producto, no se inventó una foto ni se tomó la de otro producto.** El producto y sus datos no se tocaron.
- **Cómo se sustituye cuando haya una foto correcta del termo real:** Panel → Productos → «Termos 700ml» → Editar → «Reemplazar la foto 1 con una nueva» (conserva su lugar como principal) → Guardar. El panel sube la nueva y recién después borra el archivo anterior del almacenamiento. La foto debe cumplir las reglas del panel (mínimo 500 px; se recomienda 1000 × 1000) y mostrar el producto que se ofrece.
- Mientras tanto es material de prueba: no se prepara ninguna foto.

**Nota del 8 de noviembre de 2026 (Bloque 1 de la fase 0.6; el texto anterior se conserva como historia):** C2 ya **no está «preparado sin ejecutar»**. El usuario confirmó que despublicó Termos y borró a mano su foto de Storage; la consulta pública de hoy da HTTP 400 en esa ruta y el producto no figura en el catálogo. C2 queda como **retirada del origen por el usuario**. **No se afirma** que se hayan eliminado copias externas ni la caché del sitio publicado. Lo mismo para C1: el origen está retirado, y caché externa y copias de terceros siguen sin verificar. Detalle: `informe-bloque-1-conciliacion.md` §E.

---

## 1. Estado general

| Área | Estado |
| --- | --- |
| Identidad visual (colores, logo, tipografías) | **Coherente.** Los colores del sitio son exactamente los de la guía de marca (`#E88B4A`, `#39834A`, `#202020`, `#FAF8F3`); el logo y la imagen para compartir son correctos |
| Fotos de productos | **Deficiente.** Las 5 fotos publicadas tienen problemas; una es un error grave de contenido y otra expone datos personales |
| Banners promocionales | **Hoy no hay ninguno vigente** (hace unas horas había 2). Los que existían no tenían arte para celular |
| Datos de productos y categorías | **Aceptables con inconsistencias** menores y algunas preguntas comerciales abiertas |
| Cobertura del catálogo | **Escasa:** 5 productos; 2 de las 4 categorías principales no tienen productos |
| Visualización | El sitio funciona bien en escritorio y celular (sin desborde, textos legibles); los problemas son de **contenido**, no de maquetación |

Datos del catálogo público hoy: 5 productos, 5 fotos principales (una por producto), 5 variantes con precio, 2 categorías con productos (Cocina 4 productos, Limpieza 1), 0 banners vigentes.

## 2. Auditoría de fotografías

Medidas reales (todas las fotos son WebP cuadradas 1:1; el sitio las muestra enteras dentro de una tarjeta 4:3, sin recortarlas ni deformarlas). La regla del panel pide mínimo 500 px y recomienda 1000 × 1000; avisa por debajo de 800 px.

| Producto | Resolución | Peso | Qué muestra realmente | Problemas | Gravedad |
| --- | --- | --- | --- | --- | --- |
| **Bolsas de residuos 80x90** | 1600 × 1600 | 157 KB | Una bolsa negra con una **etiqueta de envío pegada** (nombre completo, domicilio, código postal, códigos de barras y QR de un tercero), un parche de piel y objetos al borde | **Datos personales de un tercero visibles públicamente.** Además, encuadre desordenado, bolsa arrugada sin mostrar el producto | **Crítica** |
| **Termos 700ml** | 1254 × 1254 | 36 KB | El **logo de AImpulse Tech** (monograma «A» con pulso, sobre negro) | **No es el producto.** Imagen equivocada en el producto estrella de la promoción de Stanley | **Crítica** |
| **Mermelada** | 1600 × 1600 | 267 KB | Un frasco abierto y ya usado, sobre un mantel con platos, anteojos, celulares y un cuchillo | Fondo muy desordenado y objetos personales; el producto no se ve como se vende (frasco abierto); la etiqueta («Best, mermelada de ciruela») sí se lee | Alta |
| **Juego de Cuchillos** | 500 × 500 | **9 KB** | Foto de catálogo de otra marca (**«3 Claveles»** visible en las hojas y en el taco) sobre fondo blanco | Resolución en el piso permitido y muy comprimida (se ve blanda al ampliar); la marca visible **no coincide** con la marca cargada (TapperWare); parece una imagen tomada de internet (derechos de imagen sin verificar) | Alta |
| **Palitos** | 1600 × 1600 | 502 KB | Bolsa de «Krachitos» sacada con poca luz **delante de una pantalla y un teclado** | Oscura y desenfocada (nitidez medida 111, entre las más bajas), fondo con distracciones; legible pero poco profesional | Media |

Observaciones transversales:
- **No hay fotos deformadas ni pixeladas** por el sitio: todas son cuadradas y se muestran con su proporción.
- **Ningún producto tiene más de una foto** (el sitio admite hasta 5).
- **Inconsistencia total de presentación:** fondo blanco de estudio, fondo negro, mesa de cocina, pantalla de computadora. El catálogo se ve heterogéneo.
- Las fotos con fondo oscuro o desordenado se ven peor en el modo oscuro del sitio (el recuadro de foto es claro y la foto negra queda como un bloque).
- Pesos: Palitos pesa 502 KB; el sitio las optimiza al servirlas, así que no es un problema de velocidad hoy.

## 3. Auditoría de banners

**Hoy no hay ningún banner vigente** (`public_promo_banners` devuelve 0 filas; la portada no muestra carrusel y el menú no tiene «Promociones»). Hace unas horas, el 8 de noviembre, había dos. No sé si se desactivaron o se venció su vigencia: **el público no puede ver los banners inactivos**, así que solo se puede confirmar desde el panel. Si fue intencional, no hay problema; si no, hay que revisarlo.

Lo que había (observado antes en esta sesión, ya no verificable):

| Banner | Destino | Resultado |
| --- | --- | --- |
| «Termos Stanleys» | `/?q=termos` | El destino **funciona** (la búsqueda devuelve «Termos 700ml»), pero el producto al que lleva tiene como foto el logo de AImpulse |
| «NO TE PIERDAS LA OFERTAS» (el arte decía «¡Ya disponible! Catálogo del Mundo Del Plástico») | `/#catalogo` | El destino **funciona**. El título interno tiene un error («LA OFERTAS») y **no coincide con el arte** (que habla del catálogo, no de ofertas) |

Arte para celular: **ninguno de los dos tenía** (`image_mobile_path` vacío), así que el celular usaba la imagen apaisada.

**Legibilidad en celular** (estimación sobre el arte fuente `Logo/Catálogo del Mundo del Plástico.png`, 1774 × 887, proporción 2:1, justo en el límite permitido de 2,0 a 2,6): a 343 px de ancho (un celular de 375 px con márgenes) el título principal se lee, pero la línea «Conocé todos nuestros productos desde el catálogo» queda en unos **8 a 9 px**, por debajo de lo legible. Es un problema de **diseño del arte**, no del sitio.

Arte disponible en `Logo/` (fuera de Git): un banner apaisado del catálogo, un banner «Cocina» apaisado (verde sobre fondo liso), y cuatro ilustraciones 4:3 de 1448 × 1086 px que sirven como base para arte de celular (proporción 4:3 es la que pide el sistema).

## 4. Revisión de categorías y productos

| Producto | Categoría | Precio | Observaciones |
| --- | --- | --- | --- |
| Palitos | Cocina | $1.850 | Marca «krachitos» y descripción «palitos sabor panceta» en minúscula. El sabor está en la descripción pero no en el nombre. Es un alimento |
| Bolsas de residuos 80x90 | Limpieza | $4.000 | **El nombre dice 80x90 y la variante dice 20x23** (ya estaba pendiente). La descripción es la palabra «Bolsas». Sin marca |
| Juego de Cuchillos | Cocina | $20.000 | Marca TapperWare, pero la foto muestra «3 Claveles». Sin descripción (cuántas piezas, material) |
| Termos 700ml | Cocina | $20.000 | Marca «Stanleys» (la marca es Stanley). Nombre en plural. Sin descripción. Foto equivocada |
| Mermelada | Cocina | $2.500 | Falta el sabor (la etiqueta dice ciruela). Es un alimento. Sin descripción |

- **Categorización:** los productos están en categorías coherentes con las correcciones de datos ya aplicadas (Cuchillos en Cocina, Bolsas en Limpieza). **Pregunta comercial abierta:** hay dos alimentos (palitos y mermelada) en «Cocina». Si el negocio vende golosinas y almacén, quizá falte una categoría o un criterio; si no, son productos fuera de línea.
- **Precios:** las 5 variantes tienen precio entero válido y mayor que 0. **No hay lista de precios real contra la cual verificarlos**, así que no se puede afirmar que sean correctos; solo se pueden marcar los que merecen confirmación (por ejemplo, que Cuchillos y Termos cuesten exactamente lo mismo).
- **Categorías sin productos:** Librería y Regalería no tienen ninguno publicado, así que sus tickets no aparecen. Hoy el visitante ve solo dos categorías.
- **Descripción de la categoría Limpieza:** «Productos para tu dia a dia» (falta el acento de «día»); Cocina no tiene descripción. Ninguna categoría tiene imagen cargada (el sitio usa íconos, funciona bien).
- **Publicaciones:** los 5 productos cumplen la regla (habilitados, con foto principal y precio). Nada despublicado por error que se pueda ver desde el público.
- **Enlaces de banners a categorías:** las categorías con productos responden (`?categoria=cocina` 4 productos, `?categoria=bano` 1). Los enlaces a Librería o Regalería llevarían a una lista vacía.

### Contraste con información real disponible

La única fuente real disponible es el volante del negocio (`Logo/475254990_….jpg`):

| Dato | Volante | Sitio |
| --- | --- | --- |
| Dirección | Bº Los Lupinos, Mza 103, Lote 1 | Igual |
| Horario | Lunes a sábado de 14 a 20 hs | Igual |
| Teléfono | 425111 (fijo) | 2902 40-4916 (el celular configurado; el fijo no se muestra) |
| Correo | elmundodelplastico@hotmail.com | No aparece |
| Facebook | «el mundo del plástico Navarrete» | Enlace a `plasticosnavarrete` (no se pudo comprobar si es la misma página) |
| **Servicio** | **«Alquiler de inflables y disfraces»** | **No aparece en el sitio** |

El alquiler es un servicio real del negocio que el catálogo no menciona. Decidir si se muestra es del negocio.

## 5. Visualización en escritorio y celular

Revisado con el sitio local (que lee los datos reales) a 1366 px y a 375 px:

- **Sin desborde horizontal** en celular (ancho de contenido 375 = ancho de pantalla). El texto más chico es de 12 px (la nota de tarjetas del pie); el resto, de 14 px o más.
- **Tarjetas de producto:** la foto cuadrada se muestra entera dentro de un recuadro 4:3 con fondo claro, sin recortes. Con las fotos actuales se nota el contraste entre estudios y fotos caseras.
- **Menú:** sin banners vigentes, «Promociones» no aparece en la barra de escritorio (correcto). En celular el enlace puede verse un instante mientras carga (estado de espera del menú), sin banners. Menor.
- **Portada sin banner:** la sección de arriba queda con el título y las categorías; funciona y no se ve rota.
- **Imagen para compartir:** la de la portada (`og-image.png`, 1200 × 630, logo sobre crema) es correcta. **Las fichas de producto comparten la foto del producto**: hoy, al compartir el enlace de las bolsas por WhatsApp o redes, la vista previa lleva la foto con la etiqueta de envío.

Clasificación de los problemas:

| Tipo | Hallazgos |
| --- | --- |
| **Contenido** | Fotos (todas), datos personales, foto equivocada, nombres y marcas, descripciones, falta de productos, banners ausentes |
| **Diseño** | Arte de banner con texto chico en celular, falta de arte móvil, fotos sin criterio común, ilustraciones de categoría fuera de la paleta de marca (no usadas hoy) |
| **Funcionamiento** | Sin hallazgos de funcionamiento: los destinos de los banners respondían, el sitio no se rompe sin banners ni con categorías vacías |

## 6. Hallazgos priorizados

| # | Gravedad | Hallazgo | Impacto | Tipo |
| --- | --- | --- | --- | --- |
| C1 | **Crítica** | La foto de «Bolsas de residuos» muestra una **etiqueta de envío con nombre, domicilio, código postal y códigos de un tercero**, accesible por la ficha, la imagen para compartir, el sitemap y la URL pública de la foto | **Privacidad y posible responsabilidad legal** por exponer datos personales; también reputación | Contenido |
| C2 | **Crítica** | La foto de «Termos 700ml» es el **logo de AImpulse Tech** | Producto con foto equivocada; engaña al cliente; es el destino del banner de Stanley | Contenido |
| A1 | Alta | Los banners dejaron de estar vigentes (había 2 hace horas) | La portada pierde su espacio promocional; confirmar si fue intencional | Funcionamiento / contenido |
| A2 | Alta | «Mermelada»: foto desordenada, frasco abierto y usado, objetos personales | Mala imagen; no sirve para vender | Contenido |
| A3 | Alta | «Juego de Cuchillos»: foto de otra marca (3 Claveles) y de 500 px; marca cargada distinta | Inconsistencia de marca; posible problema de derechos de imagen | Contenido |
| M1 | Media | «Palitos»: foto oscura y desenfocada, delante de una pantalla | Imagen poco profesional | Contenido |
| M2 | Media | Nombre de «Bolsas» (80x90) distinto de su variante (20x23) y descripción de una palabra | Confusión del cliente sobre el tamaño | Contenido |
| M3 | Media | Solo 2 de 4 categorías tienen productos; 5 productos en total | Catálogo escaso; pérdida de ventas y de la estructura planteada | Contenido |
| M4 | Media | Banners sin arte para celular y con texto chico (≈ 8–9 px) | Texto ilegible en celular | Diseño |
| M5 | Media | Fotos sin criterio común (fondos, luz, encuadre) | Catálogo heterogéneo | Diseño |
| B1 | Baja | Marca «Stanleys» (Stanley), «krachitos» en minúscula; nombre en plural «Termos» | Detalles de calidad y búsqueda | Contenido |
| B2 | Baja | Falta el sabor en «Mermelada» y «Palitos» (nombre) y descripciones en 3 de 5 | Poca información | Contenido |
| B3 | Baja | Descripción de Limpieza sin acento («dia»); Cocina sin descripción | Detalle de calidad | Contenido |
| B4 | Baja | Título interno de un banner con error («LA OFERTAS») distinto del arte | Detalle administrativo | Contenido |
| B5 | Baja | Dos alimentos en «Cocina» | Pregunta comercial (¿corresponde?) | Contenido |
| B6 | Baja | El servicio de alquiler de inflables y disfraces no aparece en el sitio; correo y fijo del volante no se muestran | Decisión del negocio | Contenido |
| B7 | Baja | `Logo/` (recursos de marca) está fuera de Git y `Logos de categorias/` sin versionar: un solo lugar, sin historial | Riesgo de perder el material original | Proceso |
| B8 | Baja | Las ilustraciones de categoría (por ejemplo, Limpieza en azul y amarillo) no siguen la paleta de marca; hoy no se usan | Solo importaría si se publican | Diseño |

## 7. Recomendaciones concretas (todas requieren tu aprobación)

1. **C1, urgente y reversible:** **despublicar «Bolsas de residuos 80x90»** desde el panel (Productos → «Despublicar») hasta tener una foto nueva. Despublicar **no borra** la foto: la dirección pública seguiría funcionando. Para cortar el acceso hay que **eliminar el archivo del bucket** una vez cargada la foto nueva (borrar una foto desde el formulario del producto limpia también el archivo). Se podría haber guardado en cachés (WhatsApp, buscadores): tenerlo en cuenta.
2. **C2:** reemplazar la foto de Termos por una foto real del termo (o despublicarlo hasta tenerla). Corregir marca («Stanley») y nombre.
3. **A1:** confirmar en el panel de Banners si los dos banners están inactivos o vencidos y reactivarlos si fue un error.
4. **Estándar de foto para reponer** (A2, A3, M1, M5): una sola unidad **cerrada y nueva**, sobre fondo liso claro (hoja blanca o cartulina), con luz de ventana, el producto centrado y entero, sin objetos personales, cuadrada de **1000 × 1000 px o más** (el panel exige mínimo 500 y avisa por debajo de 800), la etiqueta de frente. Si se usan imágenes del fabricante, confirmar que el uso está permitido.
5. **Cuchillos:** una foto propia del juego que se vende, y revisar la marca cargada (¿TapperWare o 3 Claveles?).
6. **Bolsas:** confirmar la medida real (80x90 o 20x23) y alinear el nombre con la variante; agregar una descripción útil.
7. **Banners (M4):** diseñar arte para celular de **1200 × 900 px (4:3)** con un solo mensaje y texto de al menos 28 px a ese tamaño (para verse a ≥ 12 px en celular); las ilustraciones 4:3 de `Logo/` pueden ser base. Corregir el título interno «LA OFERTAS».
8. **Cobertura (M3):** cargar productos de Librería y Regalería, o decidir si esas categorías se mantienen; completar descripciones y sabores.
9. **Textos (B1–B3):** unificar mayúsculas y acentos (Krachitos, Stanley, «día a día»).
10. **Negocio (B5, B6):** decidir si se venden alimentos y en qué categoría, y si el alquiler de inflables y disfraces se muestra.
11. **Respaldo (B7):** versionar `Logo/` y `Logos de categorias/` (son imágenes de marca, sin credenciales ni datos de clientes) o respaldarlos aparte.
12. **Proceso:** antes de publicar una foto, revisar que no muestre datos de terceros (etiquetas de envío, pantallas, documentos). Un chequeo de dos preguntas: «¿se ve el producto entero y solo el producto?» y «¿se lee algún dato de una persona?».

Esta fase no implementó ninguna de ellas.

## 8. Recursos que necesitan reemplazo o mejora

| Recurso | Acción | Prioridad |
| --- | --- | --- |
| Foto de Bolsas de residuos | **Reemplazar** (y retirar la actual del bucket) | Crítica |
| Foto de Termos 700ml | **Reemplazar** | Crítica |
| Foto de Mermelada | Reemplazar | Alta |
| Foto de Juego de Cuchillos | Reemplazar por una propia y de mayor resolución | Alta |
| Foto de Palitos | Mejorar (luz, fondo liso, nitidez) | Media |
| Banners vigentes | Revisar su estado y, si hace falta, reactivarlos | Alta |
| Arte de banner para celular (1200 × 900) | Crear | Media |
| Texto del arte del banner del catálogo | Agrandar la línea inferior | Media |
| Segunda y tercera foto de cada producto (hasta 5) | Opcional: ángulos, uso, detalle | Baja |
| Datos de productos (nombre, marca, sabor, descripción, medida) | Corregir según la sección 4 | Media |
| Productos de Librería y Regalería | Cargar o decidir | Media |
| `Logo/` y `Logos de categorias/` | Respaldar | Baja |

## 9. Estado de la Fase 0.5: **auditoría TERMINADA; diagnóstico CORREGIDO (sección 0); C1 PENDIENTE de ejecución**

La auditoría está completa. Ninguna corrección está hecha. Los hallazgos C1 y C2 conviene resolverlos antes de promocionar el sitio.

**Lo que no pude verificar:**
- Los banners que existían (ya no hay vigentes): no puedo ver los inactivos desde el público, ni reconstruir su arte para celular real.
- Los precios y datos contra información real: solo existe el volante.
- Cómo se ve cada foto en un celular físico (se revisó con emulación).
- Si los productos están correctamente descritos: no hay una ficha de proveedor.

## 10. Pendientes de la Fase 0.4 (siguen abiertos; la fase NO está cerrada)

| Pendiente | Estado |
| --- | --- |
| Proyecto de Supabase de prueba | Pendiente: requisitos y semilla listos; falta crearlo (necesita tu autorización) |
| Validación física del punto de venta | Pendiente: protocolo listo (`protocolo-prueba-fisica-pos.md`); requiere tu presencia |
| Prueba real de impresión | Pendiente: sin impresora real no se verificó legibilidad ni tamaño de papel |
| Prueba de recuperación ante cortes de red reales | Pendiente: probada con simulación y base real, no con un corte real desde el navegador |
| Riesgos residuales de H1 | Abiertos (R1 a R7 en `recuperacion-de-ventas-pendientes.md`): otra pestaña, cerrar la pestaña con un intento pendiente, cuenta desactivada, margen de 2 minutos, la base no rechaza «misma clave con otro contenido», sin anulación de ventas, pantalla sin probar con red real |
