> **Histórico, foto del 2 de noviembre de 2026. No manda.** Desde entonces `main`, `rediseno-integral` y `origin/main` quedaron en el mismo commit (el rediseño se integró y se subió), así que la frase «`main` y GitHub no se tocaron» ya no vale. La sección «Migraciones anteriores pendientes» quedó resuelta: todas están aplicadas (ver [../estado.md](../estado.md)). El pie integral posterior reemplazó la sección de contacto con globo; ver el informe de intervención final.

# Rediseño integral del catálogo: informe final

Rama local `rediseno-integral` (commits `81c0e95` y siguientes). `main` y GitHub no se tocaron. Nada del esquema de Supabase, RLS ni permisos cambió.

## Lo implementado

Portada en este orden: navegación flotante, slider, presentación, tickets de categorías, separador, catálogo, beneficios, contacto con globo y formas de pago, pie. Modo claro y oscuro en toda la parte pública, ventana flotante de producto y pantalla de carga de marca.

## Componentes

**Nuevos:** `site-menu`, `site-nav-links`, `location-globe`, `intro-loader`, `catalog/category-tickets`, `catalog/category-icon`, `catalog/business-intro`, `catalog/route-divider`, `catalog/benefits-band`, `contact/payment-methods`, `product/product-modal`, `product/product-quick-view`, `theme-toggle`, `lib/geo.ts`, `lib/catalog/highlight.ts`, `lib/catalog/features.ts`.

**Modificados:** `site-header`, `site-footer`, `contact-section`, `home-front`, `promo-section`, `promo-carousel`, `search-form`, `catalog-results`, `product-grid`, `product-card`, `product-purchase`, `globals.css`, `config/contact.ts`, `config/catalog-copy.ts`, `lib/contact.ts`.

**Eliminados:** `catalog/main-categories` (reemplazado por los tickets) y `catalog/how-to-buy` (no figura en el orden definitivo).

**Recursos:** `public/brand/logo-nombre-claro.png` (mismas letras del logo original, en claro) y `public/brand/pagos/`.

## Rutas

- `/`: portada nueva. Con `?q=` oculta slider, presentación y categorías; con `?categoria=` filtra. Las URL no cambiaron.
- `/producto/[slug]`: sigue existiendo. Se agregó el buscador, que antes estaba en el encabezado.
- `@modal/(.)producto/[slug]`: ventana flotante desde el catálogo. Recargar muestra la página individual.
- `(site)/error.tsx`: nuevo; un error de carga conserva navegación y pie.
- `/panel`: sin cambios funcionales; conserva siempre los colores claros.

## Supabase reutilizado

`public_catalog` (regla de publicación), `public_categories`, `public_promo_banners`, `public_product_images` y `public_product_variants`, todo por `lib/catalog/repository.ts`. No se creó ninguna consulta paralela.

## Funcionalidades conservadas y comprobadas

Categorías, productos, filtros, búsqueda con resultado vacío y WhatsApp, página individual, ventana flotante, galería, variantes, enlaces de WhatsApp con el producto, banners, tema persistente, navegación responsive.

## Decisiones técnicas

- **Logo:** ícono original sobre un disco crema (como en el volante del negocio) y nombre con sus letras originales en claro: el negro y el verde no se leen sobre verde oscuro.
- **Pantalla de carga:** el script previo a la pintura decide si corresponde (primera entrada de la sesión a la portada, sin búsqueda ni filtros). Termina cuando acabó la secuencia y están listos fuentes, logo, datos del catálogo y primer banner, con espera máxima de 1,5 s para el banner. A los 9 s ofrece «Reintentar» y «Entrar igual». Si JavaScript falla se retira sola a los 25 s.
- **Globo:** SVG calculado en el servidor con una proyección real, sin librerías 3D ni JavaScript en el navegador.
- **Cambio de tema:** View Transitions con círculo desde el botón; sin soporte, cambio inmediato.
- **Fotos en oscuro:** fondo claro neutro y sin filtros, para no alterar colores ni perder productos oscuros.
- **Promociones:** el enlace desaparece si no hay banners vigentes.
- **Tickets:** la numeración MP es gráfica y va por slug; los enlaces usan los slugs reales. `bano` es el slug real de Limpieza y no se cambió.

## Pruebas

| Prueba | Resultado |
|---|---|
| TypeScript, ESLint, build de producción | Sin errores (el build avisa que falta `NEXT_PUBLIC_SITE_URL`) |
| `node --test scripts/*.test.mjs` | 90 de 90 (10 nuevas de globo y resaltado) |
| Datos reales, producción | Búsqueda, sin resultados, filtro por categoría, clic en ticket, enlace directo con `#catalogo`, ficha individual, tema persistente, panel en claro |
| Datos reales, 1440, 768 y 375 px | Sin scroll horizontal; ventana flotante con X, Escape y clic afuera, sin perder la posición |
| Teclado | Menú: abre con Enter, foco adentro, Escape lo cierra y el foco vuelve al botón |
| Supabase simulado | Galería con miniaturas, variantes con mensaje de WhatsApp, cuatro tickets, un solo banner sin controles |
| Red simulada | Falla: pantalla de error con reintento. Lentitud (14 s): la pantalla de carga espera y ofrece reintentar o entrar |

## Errores encontrados y corregidos

1. La ventana flotante no volvía a cerrar al reabrirse: Next conserva la ruta oculta y el estado quedaba marcado.
2. La pantalla de carga se anulaba en desarrollo por el doble montaje de React.
3. El nombre del logo se cortaba al desplegarse y la órbita cruzaba las letras.
4. En celular, el título del catálogo ensanchaba la columna.
5. El enlace directo a `#catalogo` quedaba arriba porque el contenido llega por partes.
6. El contenido de un ticket podía desplazarse dentro de la tarjeta.
7. El pie quedaba tapado por el botón de WhatsApp en celular.

## Sin verificar

- Movimiento reducido: los estilos y la lógica están, pero este navegador no permite simularlo.
- Secuencia de carga en un celular real y en Safari.
- Destino real de los enlaces externos: se comprobaron las direcciones, no se abrieron Google Maps ni Facebook.
- Variantes y galería con datos reales: hoy ningún producto tiene más de una foto ni más de una variante.

## Pendientes que dependen de información externa

1. **Localidad:** resuelto. Río Turbio, Santa Cruz quedó confirmada el 2 de noviembre de 2026. El volante no la menciona; se había deducido de la característica 2902 y de que [Los Lupinos figura como barrio de Río Turbio](https://es.hispanopedia.com/wiki/R%C3%ADo_Turbio_(ciudad)).
2. **Vigencia del volante:** confirmar barrio, manzana, lote y horario. El volante también trae el teléfono fijo 425111, que no se muestra; el sitio usa el número ya configurado.
3. **Librería:** no aparece porque hoy no tiene productos publicados. Su ticket (MP / 004) y su opción de menú aparecen solos al publicar uno.
4. **Instagram:** queda preparado en `CONTACT.instagramUrl`; sin cuenta no se muestra ningún botón.
5. **Logos de pago:** Mercado Pago y Prex vienen de sus sitios oficiales. Visa, Mastercard y Naranja X vienen de Wikimedia Commons; conviene reemplazarlos por el kit de marca si el adquirente lo entrega.
6. **`NEXT_PUBLIC_SITE_URL`:** falta configurarla en Vercel para los enlaces canónicos y la vista previa en redes.
7. **Migraciones anteriores:** siguen pendientes de confirmar `20261101000001` y `20261102000001`.
