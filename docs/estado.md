# Estado del proyecto

**Fecha de corte: 8 de noviembre de 2026 (cierre del Bloque 0 de la fase 0.6).** Es la única fuente del estado actual. Cuando algo cambie, se corrige acá primero. Solo se afirma lo confirmado; lo demás figura como pendiente.

## 1. Git

| Rama | Estado |
| --- | --- |
| `main` | En `de4b9c2`, igual que `origin/main`. **No se tocó** durante la Etapa 0. |
| `etapa-0-estabilizacion` | Rama actual, solo en local. Parte de `de4b9c2`. Toda la Etapa 0 (fases 0.1 a 0.5) se consolidó en un único commit local, `chore: consolidate stage 0 stabilization`. **Sin subir a GitHub, sin merge, sin despliegue.** |
| Respaldo previo al commit | `C:\Users\lauty\Respaldos-AImpulse\mundo-del-plastico_etapa-0_respaldo_2026-11-08.tar.gz` (fuera del repositorio y de OneDrive), con su `.sha256` y su manifiesto. |
| Sin versionar a propósito | `Logos de categorias/` y `Logo/` (recursos de marca pesados, respaldados), `.impeccable/` (salidas de una herramienta de diseño), `docs/capturas/` (capturas que podrían mostrar material de prueba o datos personales; la documentación que las cita queda con esos enlaces rotos hasta decidir). |

Repositorio remoto: `https://github.com/LPoclava/El-Mundo-Del-PLasticoco-Catalogo-.git` (privado). Desde este commit **`docs/` y `supabase/` sí se versionan** (migraciones, pruebas, semilla de prueba y correcciones de datos); se quitaron de `.gitignore`. Siguen fuera `supabase/tests/node_modules`, `.env.local` y los scripts sueltos que no son pruebas.

## 1 bis. Estado de las fases de la Etapa 0

| Fase | Estado real |
| --- | --- |
| 0.1 Auditoría inicial | Hecha |
| 0.2 Panel real | Hecha en código y pruebas: ingreso único con Supabase Auth, CRM, Configuración y demostración retirados. **Sin validar con cuentas reales de cada rol** |
| 0.3 Infraestructura | Cabeceras, CSP, SEO y CI implementados y probados en local. **La CI nunca corrió en GitHub; Vercel sin verificar; escáner con cámara sin probar bajo la CSP** |
| 0.4 Validación operativa | Circuito de venta auditado y probado; H1 corregido en código. **No cerrada:** falta proyecto de Supabase de prueba, prueba física, impresión real y corte de red real |
| 0.5 Material comercial | Auditoría hecha. **C1 resuelto en la fuente** (cachés externas sin verificar). **C2: el archivo del logo ya no es accesible** (producto despublicado, foto inexistente), pero lo hizo alguien fuera de esta intervención; **pendiente de confirmación del responsable** |
| 0.6 Validación integral | **En curso.** Bloque 0 (respaldo, revisión y commit local) hecho en este corte; quedan los bloques siguientes |

## 2. Migraciones de Supabase

**Confirmado por el usuario el 4 de noviembre de 2026: todas las migraciones de `supabase/migrations/` están aplicadas en la base de producción.** La confirmación es de palabra; no hay un registro técnico en este repositorio. **El 8 de noviembre de 2026 se comprobó en solo lectura, con la clave pública, que las tres últimas se ven en producción:** `public_promo_banners` devuelve `image_mobile_path` (20261103), `public_product_images` y `public_product_variants` responden 200 (20261102) y `low_stock_variants` existe y rechaza sin sesión (20261101). Para comprobarlo en cualquier momento: `select version from supabase_migrations.schema_migrations order by version;` en el SQL Editor.

| Migración | Contenido | Documento |
| --- | --- | --- |
| `20261028000001` a `…005` | Modelo original: extensiones, `staff`, categorías, productos, variantes, fotos, RLS, vistas públicas, bucket `product-images` | [modelo-de-datos.md](modelo-de-datos.md) |
| `20261029000001` a `…008` | Roles `empleado/gerente/ceo`, perfiles, auditoría, archivado de productos, funciones `scan_*` | [autorizacion-roles.md](autorizacion-roles.md) |
| `20261030000001` | Subcategorías, cuatro categorías principales, `promo_banners` y su vista pública | [promociones-y-banners.md](promociones-y-banners.md) |
| `20261031000001` | `product_variants.stock`, medios de pago, `sales`, `sale_items`, `stock_movements`, `pos_find`, `confirm_sale`, `adjust_stock` | [pos-ventas.md](pos-ventas.md) |
| `20261101000001` | Movimientos de stock con `stock_before` y tipo «entrada»; alta rápida de productos incompletos desde el escáner; resúmenes para el Inicio del panel; administración de las categorías principales. Reemplaza funciones propias de las migraciones 20261030 y 20261031 | Solo en el SQL (cabecera del archivo) |
| `20261102000001` | Vistas públicas `public_product_images` y `public_product_variants` para la ficha de producto. No expone stock, SKU ni código de barras | Solo en el SQL |
| `20261103000001` | `promo_banners.image_mobile_path`: arte para celular, opcional. Redefine `public_promo_banners` | [promociones-y-banners.md](promociones-y-banners.md) |

**`20261108000001_admin_list_users.sql` — APLICADA en producción, por confirmación del responsable (8 de noviembre de 2026). No se vuelve a aplicar.** Agrega `admin_list_users()` (solo CEO activo; correo, rol, estado y fechas de todas las cuentas de Auth, con o sin perfil). Auditada y probada con 19 pruebas en PGlite (`supabase/tests/admin-users.test.mjs`). Lo que está confirmado y lo que no:

| Punto | Estado |
| --- | --- |
| La función existe en producción | **Sí** (consulta pública en solo lectura: rechaza con «no autorizado» en vez de «no existe») y el responsable confirmó haberla aplicado |
| Quién y cuándo la aplicó | Sin registro técnico en el repositorio (confirmación de palabra) |
| Que exista **no equivale a que esté validada** | La pantalla Usuarios **no se probó con una cuenta CEO real** |
| Validación de roles reales (empleado, gerente, CEO) | **Pendiente** (`protocolo-validacion-cuentas.md`) |

Fuera de `migrations/` a propósito:

| Archivo | Estado |
| --- | --- |
| `supabase/pending/20261029000099_close_drop_staff.sql` | **No aplicar todavía.** Borra `is_staff()` y `staff_legacy`; es irreversible salvo con copia de seguridad. Requiere aprobación explícita. |
| `supabase/correcciones/20261103_catalogo_datos.sql` | Correcciones de **datos** (no es esquema). **Aplicadas** (comprobado en solo lectura el 8 de noviembre de 2026 en las vistas públicas: banners con `/?q=termos` y `/#catalogo`, Juego de Cuchillos en `cocina`, Bolsas de residuos en `bano`, «Palitos» con mayúscula). Contenía: banner Stanley a `/?q=termos`, banner general a `/#catalogo`, Juego de Cuchillos a Cocina, Bolsas de residuos a Limpieza, nombre «Palitos». También se puede hacer desde el panel. |
| `supabase/rollback/` | Reversión del catálogo y de los roles. No son migraciones. |
| `supabase/queries/categorias-sin-clasificar.sql` | Solo lectura: productos fuera de las cuatro categorías principales. |
| `supabase/tests/` | Pruebas de la base sobre PGlite y `concurrency.mjs` sobre un PostgreSQL temporal. |

## 3. Panel (`/panel`)

**Etapa 0, fase 0.2 (rama local `etapa-0-estabilizacion`, sin subir a GitHub ni desplegar): el panel tiene un único ingreso real con Supabase Auth y ya no existe ningún modo demostración.** El rol sale de `public.profiles` y define el menú; la base lo exige con RLS y funciones. El código está probado con pruebas automáticas y local; **no se probó contra el Supabase real con una cuenta de cada rol** (pendiente, ver §4).

| Sección | Estado | Fuente |
| --- | --- | --- |
| Inicio | Real: resúmenes de ventas y stock | `home-section.tsx`, `lib/pos/dashboard.ts` |
| Productos | Real | `products-section.tsx`, `lib/products/admin.ts` |
| Categorías | Real | `categories-section.tsx`, `lib/categories/admin.ts` |
| Banners promocionales | Real, gerente o superior | `banners-section.tsx`, `lib/banners/` |
| Stock | Real | `stock-section.tsx`, `lib/pos/` |
| Escáner y ventas (`/panel/precios`) | Real | `scanner-section.tsx`, `pos/pos-section.tsx` |
| Usuarios (solo CEO) | Código real: lista, rol, estado, nombre y «dar acceso». La migración `20261108000001_admin_list_users` **está aplicada** (confirmación del responsable). **Sin probar con una cuenta CEO real**: la validación de roles reales sigue pendiente | `users-section.tsx`, `lib/users/` |
| CRM | **Retirado** (no tenía tablas ni funciones reales; el código de demostración se borró) | — |
| Configuración | **Retirada** (igual) | — |

## 3 bis. Infraestructura (Etapa 0, fase 0.3: rama local, sin subir ni desplegar)

Detalle, verificaciones y pasos manuales: [despliegue.md](despliegue.md).

| Pieza | Estado |
| --- | --- |
| Cabeceras de seguridad y CSP (`next.config.ts`) | Implementadas y verificadas en un servidor de producción local (catálogo, ficha, login). **No desplegadas.** El escáner con cámara no se pudo probar en vivo bajo la CSP |
| `robots.txt` y `sitemap.xml` | Implementados y verificados localmente con un dominio de prueba |
| Canonical y Open Graph | Ya existían; solo se publican con dominio configurado. Verificados localmente |
| `NEXT_PUBLIC_SITE_URL` | **Sin confirmar en Vercel** (pendiente manual) |
| IP de desarrollo | Pasó a la variable `ALLOWED_DEV_ORIGINS` (`.env.local`); ya no hay IP fija en el código |
| CI (`.github/workflows/ci.yml`) | Creada y validada como YAML; cada paso corrido localmente. **Nunca corrió en GitHub** |
| Sesión del panel al volver a la pestaña | Se reevalúa; una cuenta desactivada vuelve al ingreso. Probada con pruebas de código; no con cuentas reales |
| Vercel | **No verificado** (sin acceso) |

## 3 ter. Circuito de venta (Etapa 0, fase 0.4: rama local)

Auditoría completa en [auditoria-pos-fase-0-4.md](auditoria-pos-fase-0-4.md).

| Pieza | Estado |
| --- | --- |
| Atomicidad de `confirm_sale` | Verificada: fallos inyectados en 4 puntos (PGlite) y 7 pruebas de concurrencia con un PostgreSQL real temporal local. Sin defectos en la base |
| Controles de stock y consistencia (libro) | Verificados por pruebas; el stock siempre cierra con sus movimientos |
| Permisos por rol, cuenta desactivada y sesión sin usuario | Verificados en la base por pruebas (7 operaciones × 3 roles). La expiración del token la controla PostgREST y no se puede probar en PGlite |
| Comprobante interno | Corregido: identifica al negocio, aclara que no es factura ni comprobante fiscal y no imprime el stock restante. **No existe emisión fiscal** y no se simula. Impresión en papel real sin verificar |
| Hallazgo H1 (posible venta duplicada tras un corte de red si se edita o recarga antes de reintentar) | **Corregido** (rama local, sin desplegar): [recuperacion-de-ventas-pendientes.md](recuperacion-de-ventas-pendientes.md). La pantalla nueva no se probó con un navegador y una red reales |
| Anulación o devolución de ventas | No existe (el historial es de solo agregado); decisión del negocio pendiente |
| Proyecto de Supabase de prueba | **No existe todavía**; requisitos y semilla listos (`proyecto-supabase-de-prueba.md`, `supabase/seed-prueba/`) |
| Prueba física del POS | **Pendiente**: protocolo listo (`protocolo-prueba-fisica-pos.md`); requiere al responsable |

## 3 quater. Material comercial (Etapa 0, fase 0.5: auditoría y corrección C1)

Detalle: [auditoria-material-comercial-fase-0-5.md](auditoria-material-comercial-fase-0-5.md). **Criterio corregido el 8 de noviembre de 2026: los productos y fotos que hoy aparecen en el catálogo son MATERIAL DE PRUEBA** (0 productos reales confirmados; los no publicados, desconocidos). **Los productos y las fotos que quedan NO son el catálogo definitivo.** No se mejora ni se reemplaza material de prueba. Solo se ejecutó C1.

| Pieza | Estado |
| --- | --- |
| Foto de «Bolsas de residuos» | **C1 RESUELTO EN LA FUENTE (8 de noviembre):** el producto se despublicó y se quitó su única foto (el archivo ya no existe en el almacenamiento; la URL anterior responde 400). El producto, su variante y su precio se conservan. **La caché local de imágenes de esta computadora (`.next/cache/images`, 78 archivos) se borró** con autorización del responsable. **NO se afirma que las copias externas estén eliminadas:** WhatsApp, buscadores, la caché de imágenes del sitio publicado en Vercel y cualquier copia guardada por terceros no se pueden verificar ni borrar desde acá. Detalle: `auditoria-material-comercial-fase-0-5.md` §0.5 |
| Foto de «Termos 700ml» (C2) | Era el logo de AImpulse (incongruencia de material de prueba). **Al abrir la fase 0.6 (8 de noviembre) el archivo ya no existía en el almacenamiento y el producto estaba despublicado**: no se muestra públicamente. **No consta quién lo hizo ni cuándo**; C2 se da por resuelto en cuanto a exposición pública solo cuando el responsable lo confirme. No se prepara foto; el procedimiento de reemplazo sigue documentado (§0.6). No debe llegar al catálogo definitivo |
| Fotos y datos de los productos restantes | Material de prueba (no es el catálogo definitivo): no se corrige. Se evaluarán con material real (productos reales, nombres y marcas confirmados, fotos de cada producto y precios autorizados) |
| Banners | **0 vigentes** hoy (había 2 hace horas); confirmar si fue intencional. Sin arte para celular |
| Marca | Coherente con la guía (colores exactos) |
| Catálogo público | **Al abrir la fase 0.6 solo 1 producto publicado** («Juego de Cuchillos», material de prueba); Termos, Mermelada, Palitos y Bolsas estaban despublicados y sus archivos de foto ya no existían (cambios hechos fuera de esta intervención, sin registro de quién ni cuándo). **Confirmar si el sitio ya es visible para clientes**. Propuesta (con aprobación): llevar el material de prueba al proyecto de Supabase de prueba y dejar producción solo con material real |

## 4. Qué no se verificó nunca

- Una **venta real** de punta a punta contra el Supabase de producción.
- La persistencia de productos y fotos contra Supabase real, y las políticas de Storage en producción.
- Un **celular físico**, Safari, un lector de códigos físico y un lector de pantalla real.
- Tiempos en Vercel (se midió con servidor local).
- El estado del **registro público de Auth** en Supabase: la última evidencia decía abierto. Conviene desactivarlo (Authentication → Sign In / Providers).
- La subida del arte móvil de un banner con sesión real.
- El **ingreso real del panel** con una cuenta de cada rol (empleado, gerente, CEO): menú, redirecciones, cierre de sesión y la pantalla de Usuarios contra el Supabase real, que depende de la migración `20261108000001` (aplicada, pero nunca probada con una cuenta CEO real). Protocolo preparado: `protocolo-validacion-cuentas.md` (lo ejecuta el responsable).
- El **escáner con cámara bajo la CSP nueva**, en un celular real y con una vista previa desplegada.
- La **primera ejecución de la CI en GitHub** y el **despliegue en Vercel** con las cabeceras nuevas.
- El **punto de venta con una cuenta de empleado real** y una venta de prueba: pendiente de la presencia y la autorización del responsable (las ventas no se pueden anular).

## 5. Pendientes abiertos

**Del usuario o del negocio**

1. ~~Correcciones de datos de `supabase/correcciones/`~~: hechas (verificado el 8 de noviembre de 2026). Ya no queda ningún P1 abierto.
2. Arte de banners para celular: 1200 × 900 px, cargado desde el panel.
3. Configurar `NEXT_PUBLIC_SITE_URL` en Vercel con el dominio real. Estado actual de Vercel: sin confirmar.
4. Cargar stock inicial de cada variante (sin stock, nada es vendible) y crear las cuentas de empleados.
5. Fotos reales de los productos.
6. Confirmar barrio, manzana, lote y horario del local, que salen de un volante. Aclarar si hay retiro o envío.
7. «Bolsas de residuos»: el nombre dice 80x90 y la variante 20x23.
8. Instagram: sin cuenta no se muestra el botón (`CONTACT.instagramUrl`).
9. Logos de pago: Visa, Mastercard y Naranja X vienen de Wikimedia Commons; reemplazar por el kit de marca si el adquirente lo entrega.
10. Librería no tiene productos publicados: su boleto y su opción de menú aparecen solos al publicar uno.

**Técnicos**

1. Aplicar `close_drop_staff` tras un período de uso, con aprobación.
2. Definir la retención de `audit_log`, que crece sin límite.
3. Opcional: `set_primary_image(product_id, image_id)` para que el cambio de foto principal sea atómico.
4. No implementado: precios promocionales y combos (hay un diseño mínimo sugerido en `promociones-y-banners.md`).
5. Opcional: banner más apaisado que 2:1 exige ampliar la regla de banners del panel.
6. CRM y Configuración se retiraron del panel; si el negocio los necesita hay que diseñarlos con sus tablas desde cero.
8. ~~Hallazgo H1~~: corregido. Quedan los riesgos R1 a R7 de `recuperacion-de-ventas-pendientes.md` §5 (por ejemplo, probar la pantalla con un corte de red real y decidir si la base debe rechazar «misma clave con otro contenido»).
9. Decidir cómo se corrige una venta equivocada (hoy no hay anulación ni devolución).
10. Crear el proyecto de Supabase de prueba y correr la prueba física (`proyecto-supabase-de-prueba.md`, `protocolo-prueba-fisica-pos.md`).
11. **C1 (fase 0.5):** resuelto en la fuente y en la caché local; **sin verificar** las copias externas ni la caché del sitio publicado (decidir si se vacía desde Vercel). El material de prueba restante no se toca; el definitivo se arma con material real (`auditoria-material-comercial-fase-0-5.md` §0).
12. **Fase 0.4, todavía NO cerrada:** proyecto de Supabase de prueba, validación física del punto de venta, prueba real de impresión, prueba de recuperación con cortes de red reales y riesgos residuales de H1.
7. ~~Aplicar `20261108000001_admin_list_users`~~: aplicada (confirmación del responsable). **Falta probar el ingreso real con una cuenta de cada rol**, incluida la pantalla Usuarios con un CEO real.
7. Pendientes menores de diseño: ver `historico/informe-intervencion-final.md`, sección final.

## 6. Datos del negocio confirmados

- Localidad: **Río Turbio, Santa Cruz** (confirmada el 2 de noviembre de 2026).
- El volante trae un teléfono fijo (425111) que **no se muestra**; el sitio usa el número ya configurado en `src/config/contact.ts`.
