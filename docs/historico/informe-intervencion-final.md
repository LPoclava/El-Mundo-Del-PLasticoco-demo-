> **Histórico, foto del 4 de noviembre de 2026. No manda.** El estado vigente y los pendientes están en [../estado.md](../estado.md). Desde este informe: todas las migraciones, incluida `20261103000001` (arte móvil de banners), quedaron aplicadas según el usuario; «Lo que falta de tu parte» sigue vigente solo en lo que `estado.md` conserve.

# Intervención de calidad del catálogo: informe final

Rama local `rediseno-integral`, último commit `d72e3b7`. `main` y GitHub no se tocaron.

**Estado:** el código no tiene problemas P0 ni P1 abiertos. El trabajo todavía **no está terminado de punta a punta**: faltan correcciones de datos y una migración que requieren tu acceso a Supabase (ver «Lo que falta de tu parte»).

## Puntuaciones

| Auditoría | Inicial | Final | Objetivo |
|---|---|---|---|
| Diseño (`critique`) | 25/40 | **28/40** | Superar 25: cumplido |
| Técnica (`audit`) | 15/20 | **17/20** | Superar 15: cumplido |
| Detector de código | 0 hallazgos | 0 hallazgos | |

La puntuación de diseño la dio una evaluación independiente, que en una ronda intermedia bajó el relleno borroso del slider por verse peor; se quitó. La técnica la asigné yo a partir de las mediciones de abajo. El análisis del detector en el navegador mantiene dos avisos: `gray-on-color` en el pie, falso positivo porque mide 6,95:1, y `cream-palette`, que pide el brief. `overused-font` por Geist en el cuerpo es correcto y queda como decisión de diseño.

### Auditoría técnica

| Dimensión | Puntaje | Motivo |
|---|---|---|
| Accesibilidad | 3 | Sin fallas medidas en contraste, foco ni teclado; falta probar con un lector de pantalla real |
| Rendimiento | 3 | 439-444 KB y JS de 162 KB; la animación de marca sigue sumando tiempo en la primera visita |
| Temas | 4 | Tokens con una sola función, sin parches globales |
| Responsive | 4 | Sin desborde de 320 a 1920 px, controles de 44 px y texto al 200 % |
| Integridad | 3 | Detector limpio y pruebas versionadas; quedan datos y arte por completar |

## Diagnóstico inicial

| Problema | Archivo | Causa | Solución | Efecto a vigilar |
|---|---|---|---|---|
| WhatsApp con 1,8:1 al pasar el cursor en oscuro | `whatsapp-float`, `catalog-results`, `product-purchase` | `brand-green-ink` (token de texto que cambia con el tema) usado como fondo | Tokens `--color-whatsapp*`, fijos | Ninguno; el panel no usaba ese estado |
| Foco perdido al cerrar la ventana | `product-modal` | Next oculta la ruta y el foco cae en `body` | Guardar quién abrió y devolverle el foco; si ya no está, a la tarjeta o al catálogo | Reapertura: la ruta queda conservada oculta |
| Foco detrás de la pantalla de carga y espera por JavaScript | `intro-loader`, `layout` | Contenido enfocable, y retiro atado a React y a los datos | `visibility:hidden` por CSS, retiro por CSS y salto desde el script inicial | Si JS falla igual se retira, a los 1,85 s |
| Favicon de 161 KB | `src/app/icon.png` | PNG de 322 px | Ícono de 48 px y `apple-icon` de 180 px | Ninguno |
| Texto al 200 % con desborde | `site-footer`, `site-header`, `product-card`, `product-grid` | Fila del logo y número sin poder partirse, columna implícita, cortes en px | `flex-wrap`, `minmax(0,1fr)` y cortes en rem | Sin `overflow-x:hidden` |
| Banner de 490 px y controles encima | `promo-carousel`, `promo-section` | Mismo arte y proporción para todo | Alto contenido, flechas al costado, puntos debajo, arte móvil | Arte móvil pendiente de carga |
| Boletos con nombres cortados y uno suelto | `category-tickets` | `truncate` y fila con cantidad impar | Sin truncar; con cantidad impar, filas parejas en celular | Pruebas con 3 y 4 categorías |
| Secciones separadas de ubicación y pagos | `contact-section`, `payment-methods`, `site-footer` | Decisión anterior, reemplazada por el brief | Pie integral único | El menú mantiene sus accesos |
| Enlaces con `localhost` posibles | `layout`, `page`, `producto/[slug]/page` | `metadataBase` ausente | `lib/site-url.ts`: si no hay dominio, se omiten | Requiere la variable para el canónico |
| Pruebas fuera de Git | `.gitignore` | Exclusión explícita de `/scripts/` | Se versionan solo `*.test.mjs` | Sin credenciales: revisadas |
| **Panel con 404 en desarrollo** (hallado durante la validación) | `@modal/[...catchAll]` | El comodín también capturaba `/panel`; producción no fallaba | Se quitó: la ventana no tiene enlaces internos | Se comprobó abrir, cerrar y reabrir |

## Cambios por prioridad

**P1**
- Contraste de WhatsApp: 5,35 en reposo, 7,29 al pasar el cursor y 9,62 al presionar, en ambos temas.
- Foco: vuelve a la tarjeta con Escape, con la X y queda atrapado dentro de la ventana. La ventana tiene `role="dialog"`, `aria-modal` y el nombre del producto.
- Pantalla de carga: se retira a los 2,18 s sin tocar nada, y en unos 0,3 s con botón, tecla o toque. No aparece con movimiento reducido ni sin JavaScript.
- Slider contenido a unos 353 px en un alto de 768, sin recortes forzados.

**P2**
- Pie integral de 4 columnas; dos en tablet y bloques apilados en celular.
- Cápsula con buscador, sección activa correcta y lupa en pantallas chicas.
- Catálogo «Nuestro catálogo» con la explicación de WhatsApp; tarjeta con consulta propia y foto completa.
- Arte móvil de banners: panel, lectura pública y migración.
- Controles de 44 × 44 px; texto al 200 % sin desborde.
- Favicon, `apple-icon`, `theme-color` acorde al tema elegido y sin `localhost`.

**P3**
- Título oculto «Promociones» quitado: el H1 es el primero visible; regiones sin duplicar.
- Nunito para títulos y precios; Geist sigue en el cuerpo y el panel.
- Pruebas versionadas y `npm test`.
- Botón flotante oculto en celular mientras el catálogo está a la vista, para no tapar «Consultar».

## Archivos

**Nuevos:** `src/lib/site-url.ts`, `src/components/site-nav-search.tsx`, `src/components/catalog/whatsapp-float-guard.tsx`, `src/app/apple-icon.png`, `scripts/catalog-final.test.mjs`.

**Eliminados:** `src/components/contact/contact-section.tsx`, `src/components/catalog/route-divider.tsx`, `src/app/(site)/@modal/[...catchAll]/page.tsx`.

**Modificados:** `globals.css`, `layout.tsx`, `icon.png`, `error.tsx`; en `(site)`: `layout`, `page`, `producto/[slug]/{page,error,not-found}`, `@modal/(.)producto/[slug]/page`; en `catalog`: `business-intro`, `catalog-results`, `category-nav`, `category-tickets`, `home-front`, `product-card`, `product-grid`, `promo-carousel`, `promo-section`, `search-form`, `whatsapp-float`; `contact/payment-methods`; en `product`: `product-gallery`, `product-modal`, `product-purchase`, `product-quick-view`; `site-footer`, `site-header`, `site-nav-links`, `theme-toggle`, `intro-loader`; `config/catalog-copy`; `lib/banners/{admin,image,rules}`, `lib/catalog/{product,repository}`, `types/product`; panel: `sections/banners-section`; `.gitignore`, `.env.local.example`, `package.json`.

Las pruebas de `scripts/*.test.mjs` pasan a versionarse. `docs/` y `supabase/` siguen fuera de Git por tu decisión anterior.

## Pruebas y resultados

| Prueba | Resultado |
|---|---|
| `npm test` | 96 de 96 |
| TypeScript, ESLint, build de producción | Sin errores |
| 320, 360, 390, 768, 1366 y 1920 px, en ambos temas | Sin desborde, ningún control chico ni texto cortado |
| Texto al 200 % (tamaño de fuente real del navegador), 320, 390 y 1366 px | Sin desborde; la cápsula deja de ser fija en celular |
| Teclado | Orden lógico y foco visible; foco atrapado y devuelto a la tarjeta; scroll conservado |
| Ventana | Cierra con X, Escape y clic afuera; se reabre bien; el clic real en celular la abre |
| Carga | Salto con botón, tecla y toque; no repite al recargar; movimiento reducido y sin JS correctos |
| Tacto sintetizado, Chromium | Deslizar en ambos sentidos, vertical mueve la página, gesto interrumpido no traba |
| Búsqueda | Con resultados, marca el término y oculta slider y categorías; sin resultados, una salida y WhatsApp |
| Sección activa | Inicio, Catálogo y Contacto correctos; búsqueda sin resultados marca Catálogo |
| Enlaces del pie | WhatsApp, teléfono, Facebook y Google Maps con la dirección correcta (se comprobaron las direcciones, sin abrirlas) |
| Logos de pago | Los 5 cargan en sus colores |
| Rutas | `/`, `/panel`, `/panel/login` y `/panel/banners` responden en desarrollo y producción |
| Consola | Sin errores en la carga medida |

**Con Supabase simulado** (ronda previa a los ajustes finales de slider y boletos, que no se repitió): arte móvil con su `srcset` y proporción 4:3, carrusel de uno y varios banners, cuatro boletos sin cortes a 320 px, grillas de 1, 2, 3 y 7 productos, galería, variantes y mensaje de WhatsApp. Falla y lentitud de red se probaron en la ronda anterior del rediseño, con la pantalla de carga anterior; en esta se comprobó solo que no bloquea.

### Rendimiento (390 px, 4G lenta simulada, CPU a un cuarto, servidor local)

| Medida | Primera visita | Sesión ya vista |
|---|---|---|
| Primer contenido (FCP) | 1,18 s | 2,03 s |
| Datos listos | 1,0 s | 1,06 s |
| Catálogo utilizable | 3,31 s | 1,85 s |
| LCP | 3,55 s | 2,53 s |
| CLS | 0,006 | 0 |

La animación dura 1,85 s más 0,3 s de salida desde la primera pintura, y se puede saltar. Es la diferencia entre ambas columnas de «utilizable». Los valores de FCP varían entre corridas porque la medición es local. Peso total: de 577 KB a unos 440 KB; ícono del sitio: de 161 KB a 3 KB.

## Lo que falta de tu parte

1. **Migración `supabase/migrations/20261103000001_banner_mobile_image.sql`:** sin aplicar. Solo agrega una columna opcional; el sitio y el panel funcionan antes y después.
2. **Correcciones de datos `supabase/correcciones/20261103_catalogo_datos.sql`:** sin aplicar. Banner Stanley a `/?q=termos`, banner general a `/#catalogo`, Juego de Cuchillos a Cocina, Bolsas de residuos a Limpieza, «Palitos». También se puede hacer desde el panel. **Es el único P1 abierto, y es de datos.** Mientras tanto el catálogo ya muestra «Palitos» con mayúscula.
3. **Arte de banners para celular:** 1200 × 900 px, para cargar desde el panel. Sin él, el celular sigue usando la imagen apaisada, con textos chicos.
4. **Banner más apaisado (opcional):** tu referencia muestra uno mucho más bajo, y los actuales son 2:1. Un arte de esa proporción exige ampliar la regla de banners del panel.
5. **`NEXT_PUBLIC_SITE_URL` en Vercel:** con el dominio real. Sin ella, Vercel usa su dominio de producción y fuera de Vercel se omiten el canónico y la imagen de vista previa.
6. **Fotos reales** de los productos, y confirmar barrio, manzana, lote y horario, que salen del volante.
7. **Bolsas de residuos:** el nombre dice 80x90 y la variante 20x23.

## Riesgos para validar en producción

- Formulario del banner móvil en el panel: compila y sus reglas están probadas, pero no se usó con una sesión real; requiere la migración.
- Sin probar en un celular físico, Safari ni lector de pantalla real.
- Tiempos de Vercel: se midió con servidor local.
- Permiso de escritura: los archivos SQL no se ejecutaron contra la base real.

## Decisiones respecto de tu referencia

- **Sin corazón de favoritos:** no existe esa función y sería un botón decorativo.
- **Sin «Ver todos los productos» fijo:** sin filtro no llevaría a ningún lado; aparece al elegir una categoría.
- **Enlace «Contacto» en la cápsula:** está en tu imagen, aunque no en la lista del brief.
- **Librería:** no aparece porque no tiene productos publicados; su boleto aparece solo al publicar uno.

## Pendientes menores de diseño

- P2: la presentación y la franja de beneficios repiten ideas. La franja la pide el brief, así que se mantuvo.
- P2, dato: el sitio no aclara retiro ni envío, porque es información del negocio.
- P3: la franja y el pie quedan como dos masas verdes seguidas; los recuadros de foto siguen muy claros en oscuro; a 390 px la primera tarjeta solo asoma al final de la pantalla (y=810 de 844).

## Capturas

En `docs/capturas/`: `claro-320`, `claro-360`, `claro-390`, `claro-768`, `claro-1366`, `claro-1920`, `oscuro-390`, `oscuro-1366`, `texto200-390`, `carga-vuelta`, `carga-nombre`, `lupa-390`, `busqueda-1366` y `simulado-320`.
