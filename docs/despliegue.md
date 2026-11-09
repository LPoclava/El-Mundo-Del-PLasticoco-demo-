# Despliegue, cabeceras de seguridad, SEO y CI

Estado al 8 de noviembre de 2026 (Etapa 0, fase 0.3, rama local `etapa-0-estabilizacion`, sin subir ni desplegar). **No se verificó nada en Vercel ni en GitHub**: no hay acceso desde esta máquina (`gh` sin sesión, sin `.vercel/`, sin dirección de producción). Lo marcado «manual» lo hace quien administra esas cuentas.

## 0. Estado del sitio publicado (verificado el 9 de noviembre de 2026, solo lectura)

Sitio: <https://el-mundo-del-plastico.vercel.app/> (Vercel). **Sirve la versión anterior a la Etapa 0**: la portada y `/panel/login` responden 200, pero **no tiene** `robots.txt` ni `sitemap.xml` (404) y la portada **no trae** las cabeceras de seguridad de `next.config.ts` (solo el HSTS que agrega Vercel). Los cambios de la Etapa 0 (cabeceras, CSP, SEO, ingreso único del panel, recuperación del POS) llegan a producción **solo con un `push` y un despliegue**, que están **pendientes por acceso y por decisión del usuario**. Hasta entonces las secciones 2 y 3 de este documento describen lo implementado y probado **en local**, no lo publicado. La CI de GitHub tampoco corrió nunca.

**Despliegue, cuando se autorice:** (1) `git push` de `main`; (2) confirmar en Vercel `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_SITE_URL` (dominio real con `https://`); (3) abrir `/robots.txt`, `/sitemap.xml` y revisar las cabeceras; (4) probar el catálogo, `/panel/login` y el escáner con cámara bajo la CSP; (5) revisar la ejecución de la CI en GitHub.

## 1. Variables de entorno

| Variable | Dónde | Para qué | Estado |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env` (versionado), Vercel | Conexión pública a Supabase | En `.env`; confirmar en Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env` (versionado), Vercel | Clave **pública** (nunca `service_role`) | En `.env`; confirmar en Vercel |
| `NEXT_PUBLIC_SITE_URL` | **Vercel (manual)** | Dominio real con `https://`: canonical, Open Graph, `robots.txt` y `sitemap.xml` | **Sin confirmar**; no está en `.env` local, a propósito |
| `ALLOWED_DEV_ORIGINS` | `.env.local` (no versionado) | Solo desarrollo: IP desde la que se abre el servidor local (celular en la misma red). **No va en Vercel** | Nueva; antes la IP estaba fija en `next.config.ts` |

`publicSiteUrl()` (`src/lib/site-url.ts`) centraliza el dominio: usa `NEXT_PUBLIC_SITE_URL` y, si falta, `VERCEL_PROJECT_PRODUCTION_URL` (que Vercel expone solo si «Automatically expose System Environment Variables» está activo). Sin ninguno, **se omiten** canonical, imagen para compartir, el aviso de sitemap en `robots.txt` y el contenido del sitemap: nunca se usa `localhost` ni se inventa un dominio. Para no depender del dominio `*.vercel.app` (que podría indexarse en paralelo al dominio propio), conviene fijar `NEXT_PUBLIC_SITE_URL`.

## 2. SEO técnico

| Pieza | Archivo | Comportamiento |
| --- | --- | --- |
| `robots.txt` | `src/app/robots.ts` | Permite todo menos `/panel` y `/panel/`; anuncia el sitemap solo con dominio configurado |
| `sitemap.xml` | `src/app/sitemap.ts` | Portada y una entrada por producto publicado (lee la vista pública a través de `getCatalogPage`, con la caché de 60 s); nada del panel; vacío sin dominio; si el catálogo no responde, deja al menos la portada |
| Canonical | `(site)/page.tsx`, `producto/[slug]/page.tsx` | Solo con dominio configurado; la ficha redirige al slug correcto |
| Open Graph | `src/app/layout.tsx`, ficha de producto | Título, descripción, `og:url`, `og:image` (la ficha usa la foto del producto; la portada, `public/brand/og-image.png`) |
| Panel fuera del índice | `src/app/panel/layout.tsx` | `noindex, nofollow` además del `Disallow` |
| JSON-LD | portada y ficha | Ya existía; escapa `<` |

Comprobado con un servidor de producción local y un dominio **de prueba** (`https://example.test`): `robots.txt` y `sitemap.xml` correctos con los 5 productos publicados, canonical y `og:url` con ese dominio, `og:image` de Supabase. Con el build sin dominio, el sitemap sale vacío y `robots.txt` sin la línea `Sitemap`.

Después de configurar el dominio real (manual): abrir `https://DOMINIO/robots.txt` y `https://DOMINIO/sitemap.xml`, y enviar el sitemap en Google Search Console.

## 3. Cabeceras de seguridad (`next.config.ts`)

Se aplican a todas las rutas (también a los archivos estáticos).

| Cabecera | Valor | Nota |
| --- | --- | --- |
| `Content-Security-Policy` | Ver abajo | Sin nonces |
| `X-Content-Type-Options` | `nosniff` | |
| `X-Frame-Options` | `DENY` | Refuerza `frame-ancestors 'none'` en navegadores viejos |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=(), payment=(), usb=()` | La cámara queda disponible **solo para esta página** (escáner y foto de producto); el micrófono no se usa (`getUserMedia` pide `audio: false`) |
| `Strict-Transport-Security` | `max-age=31536000` (solo en producción) | Sin `includeSubDomains` ni `preload`, difíciles de revertir; se pueden sumar cuando se confirme que todo el dominio va por HTTPS |
| `X-Powered-By` | eliminado (`poweredByHeader: false`) | |

### CSP

`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: <Supabase>; font-src 'self' data:; connect-src 'self' <Supabase>; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`

`<Supabase>` es el origen del proyecto, tomado de `NEXT_PUBLIC_SUPABASE_URL` al compilar.

**Por qué `'unsafe-inline'` en scripts (límite conocido).** El sitio usa `cacheComponents` y `partialPrefetching`. La guía de Next 16 declara que una CSP con nonces es **incompatible con PPR** (obliga a renderizar todo por pedido). Hacen falta scripts en línea: el del tema (`layout.tsx`) y los de arranque de Next. Lo que sí se cierra: ningún script de otro origen, sin `eval` en producción, sin plugins ni `<base>` ajeno, nadie puede embeber el sitio, y las conexiones solo van al sitio y a Supabase. La alternativa sin `unsafe-inline` es la integridad de subrecursos (SRI) experimental de Next; no se adoptó por ser experimental.

**Compatibilidad comprobada** (servidor de producción local, con datos reales de solo lectura):

| Caso | Resultado |
| --- | --- |
| Catálogo: portada, 5 productos con foto, banners, fuentes Geist y Nunito | Carga completa, 0 violaciones |
| Ficha de producto: imágenes, JSON-LD, script del tema | Correcto |
| `/panel/login`: formulario, hidratación | Correcto |
| `connect-src` hacia Supabase | Permitido (respuesta HTTP 401 sin clave: llegó) |
| `connect-src` hacia otro sitio (control negativo) | **Bloqueado**, con la violación registrada |
| `Permissions-Policy` en el navegador | cámara permitida; micrófono, geolocalización y pagos bloqueados |
| Código del lector ZXing ya compilado | Sin `eval`, `new Function` ni WebAssembly |
| Desarrollo (`next dev`) | La CSP de desarrollo agrega `'unsafe-eval'` y `ws:`; el panel hidrata sin violaciones |

**No se pudo probar en vivo: el escáner con la cámara** (hace falta una sesión real, HTTPS o localhost y una cámara). La conclusión sale del análisis: el video se muestra con `srcObject` (no depende de la CSP), `media-src` y `img-src` admiten `blob:`, `AudioContext` y `vibrate` no están regulados por estas políticas, y el lector se carga como archivo propio. **Verificar en el celular** con el protocolo (`protocolo-validacion-cuentas.md`, §5.4) apenas se despliegue una vista previa.

**Si algo se rompe** (síntoma: la consola dice «Refused to …» o una función deja de andar): cambiar el nombre de la cabecera a `Content-Security-Policy-Report-Only` en `next.config.ts` y volver a desplegar. Sigue informando las violaciones sin bloquear nada, y se corrige la política con calma.

**Al sumar un servicio externo** (analítica, mapas incrustados, fuentes de otro sitio, widgets) hay que agregar su origen en la directiva que corresponda. Las vistas previas de Vercel inyectan una barra («Vercel Live») que esta CSP bloquea; es inofensivo y solo afecta a esa barra.

## 4. Integración continua (GitHub Actions)

Archivo: `.github/workflows/ci.yml`. Corre en cada pull request y en cada push a `main`, con permisos de solo lectura y sin secretos. Pasos, en orden: `npm ci`, `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. Node sale de `.nvmrc` (24). La compilación corre con las variables de Supabase **vacías**: no consulta la base real y el catálogo sale vacío (comportamiento documentado). Una compilación con errores hace fallar la ejecución.

**No se pudo ejecutar en GitHub** (no se sube nada en esta etapa). Lo que sí se hizo: cada paso se corrió localmente con el mismo comando, y el build con las variables vacías, como lo hará la CI. El archivo fue validado como YAML y sus pasos comprobados por una prueba (`scripts/infra.test.mjs`). **Queda por ver el primer resultado real en GitHub.**

Alcance: la CI cubre `scripts/*.test.mjs`. Las pruebas de la base de datos (`supabase/tests`) **no corren en la CI** porque `supabase/` no está en Git (decisión abierta, ver `decisiones.md`).

La CI **no despliega**: de eso se ocupa la integración de Vercel con GitHub. Por defecto Vercel no espera el resultado de la CI.

## 5. Configuración manual pendiente

**Vercel**
1. Proyecto → Settings → Environment Variables: confirmar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; **agregar `NEXT_PUBLIC_SITE_URL`** con el dominio real (`https://…`), al menos en Production. No agregar `ALLOWED_DEV_ORIGINS`.
2. Settings → General → Node.js Version: 24.x (Vercel no lee `.nvmrc`).
3. Settings → Domains: confirmar el dominio principal; si hay más de uno, redirigir al principal.
4. Redesplegar después de cambiar variables `NEXT_PUBLIC_*` (se incorporan al compilar).
5. Confirmar que el último despliegue corresponde al commit esperado y que compiló sin errores.
6. Revisar Deployment Protection de las vistas previas.

**GitHub**
1. Confirmar que Actions está habilitado en el repositorio.
2. Tras el primer push de este trabajo, revisar que la ejecución «CI / verificar» termine en verde.
3. Opcional: proteger `main` exigiendo ese chequeo antes de integrar.

**Verificación posterior al despliegue** (solo lectura):

```bash
curl -sI https://DOMINIO/ | grep -iE "content-security|x-frame|x-content|referrer|permissions|strict-transport"
curl -s https://DOMINIO/robots.txt
curl -s https://DOMINIO/sitemap.xml | head -20
```
