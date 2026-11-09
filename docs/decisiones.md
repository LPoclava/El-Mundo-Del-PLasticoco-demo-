# Registro de decisiones

Una fila por decisión: qué se decidió, por qué y dónde está el detalle. Las fechas son las de la migración, el commit o el informe donde consta; las marcadas «aprox.» se deducen de ellos. Al sumar una decisión nueva, agregarla al final de su grupo con la fecha del día.

## Datos y negocio

| Cuándo | Decisión | Motivo | Detalle |
| --- | --- | --- | --- |
| Oct 2026 (aprox.) | El catálogo es público, sin inicio de sesión, y se consulta por WhatsApp. Sin carrito ni pagos en línea. | Negocio chico de 1 o 2 personas | `modelo-de-datos.md` §1 |
| Oct 2026 (aprox.) | Precios manuales y **solo enteros** (la base rechaza centavos). | Simplicidad y coherencia con el comercio | `modelo-de-datos.md` §1 |
| Oct 2026 (aprox.) | Variantes por tamaño y color con precio propio; hasta 5 fotos por producto, una principal. | Confirmado por el negocio | `modelo-de-datos.md` §2 |
| Oct 2026 (aprox.) | Código de barras a nivel producto, no variante: el escaneo identifica el producto. | Acordado; costo: la consulta muestra todas las variantes | `modelo-de-datos.md` §8 |
| Oct 2026 (aprox.) | Un producto se publica solo si está habilitado, no archivado, con foto principal y al menos una variante con precio > 0. La regla vive en la vista `public_catalog`. | Que ninguna pantalla pueda publicar algo incompleto | `modelo-de-datos.md` §5 |
| Oct 2026 (aprox.) | Fotos en un bucket **público** con nombre aleatorio y sin listado público. La foto de un producto no publicado es accesible por URL directa. | Aceptado conscientemente; no es una protección | `modelo-de-datos.md` §5 |
| 30 oct 2026 | Las cuatro categorías principales son Cocina, Baño, Librería y Regalería, con slugs estables `cocina`, `bano`, `libreria`, `regaleria`. **`bano` es Limpieza**: no se renombró para no romper enlaces. | Identificador estable aunque cambie el nombre | `promociones-y-banners.md` §2 |
| 30 oct 2026 | Máximo dos niveles de categorías. Elegir una principal muestra también los productos de sus subcategorías. | Mantener el catálogo simple | `promociones-y-banners.md` §2 |
| 30 oct 2026 | Un banner es solo una imagen con un destino; no copia productos ni precios. Proporción 16:7; el arte para celular (4:3, 1200 × 900) es opcional. | Que ninguna oferta quede desincronizada de los precios | `promociones-y-banners.md` §2 |
| 30 oct 2026 | Precios promocionales y combos **no se implementaron**. | Faltan reglas de negocio (¿por variante o producto?, ¿el combo descuenta stock?) | `promociones-y-banners.md` §7 |
| 31 oct 2026 | El stock vive en `product_variants.stock` y baja solo al confirmar la venta. Un producto sin stock no es vendible. | El precio ya vive en la variante | `pos-ventas.md` §3 |
| 31 oct 2026 | La venta se confirma con `confirm_sale`, en una transacción: total calculado en el servidor, variantes bloqueadas, clave de idempotencia por intento. Un medio de pago por venta, sin pagos mixtos ni pasarela. | Evitar ventas dobles, stock negativo y precios falsos | `pos-ventas.md` §4 |
| 31 oct 2026 | `sales`, `sale_items` y `stock_movements` son de solo agregado. Una anulación futura será un registro compensatorio. | Historial confiable | `pos-ventas.md` §4 |
| 31 oct 2026 | Un producto creado desde el escáner queda **sin publicar y con stock 0**. | No exponer productos incompletos ni venderlos sin stock real | `pos-ventas.md` §6 |
| 2 nov 2026 | La localidad es Río Turbio, Santa Cruz. | Confirmada por el negocio | `estado.md` §6 |

## Seguridad y permisos

| Cuándo | Decisión | Motivo | Detalle |
| --- | --- | --- | --- |
| 29 oct 2026 | Tres roles jerárquicos `empleado < gerente < ceo` en `public.profiles` reemplazan la tabla `staff` (todos con los mismos permisos). | Poder dar menos permisos a un empleado | `autorizacion-roles.md` |
| 29 oct 2026 | El empleado no tiene permisos directos sobre las tablas; solo funciones (`scan_*`, `pos_find`, `confirm_sale`). | RLS actúa por fila y no por columna | `autorizacion-roles.md` §2 |
| 29 oct 2026 | Los permisos se aplican en la base con RLS y funciones `security definer` con `search_path` fijo. Ocultar botones no cuenta como protección. El rol se lee solo de `profiles`, nunca del token ni de `user_metadata`. | Que el navegador no pueda saltarse una regla | `autorizacion-roles.md` §4 |
| 29 oct 2026 | Nadie cambia su propio rol ni deja al sistema sin CEO. | Evitar autoascenso y bloqueo | `autorizacion-roles.md` §4 |
| 29 oct 2026 | Auditoría de solo agregado para catálogo y perfiles. No registra lecturas ni archivos de Storage. | Trazabilidad con límites conocidos | `autorizacion-roles.md` §5 |
| 29 oct 2026 | `staff` se renombra a `staff_legacy` y se conserva; su borrado (`pending/…99_close_drop_staff.sql`) espera un período de uso y aprobación. **(Superada el 8 de nov 2026: el borrado ya está aplicado en producción; ver la fila de esa fecha.)** | Poder revertir | `autorizacion-roles.md` §6 |
| Oct 2026 (aprox.) | Las vistas públicas corren con permisos del dueño y `security_barrier`. | Exponer solo las columnas elegidas | `modelo-de-datos.md` §6 |
| 8 nov 2026 | **Un único ingreso al panel**, con Supabase Auth. Se eliminó el login de demostración (contraseña precargada, perfiles ficticios y selección manual de rol). El menú sale del rol de `public.profiles`; las compuertas de cada sección usan esa misma sesión, sin segundo ingreso. | La demostración mostraba un rol inventado y pedía dos ingresos | `src/components/panel/auth-provider.tsx` |
| 8 nov 2026 | La autorización sigue en la base. No hay capa de servidor propia de Next: la sesión vive en el navegador (clave pública) y cada operación la valida Postgres con RLS y funciones. Proteger rutas en el servidor de Next exigiría cookies de sesión y `@supabase/ssr`. **Recomendación (8 nov 2026): no incorporarlo ahora**: no agrega autorización, no hay datos privados renderizados en el servidor y no protege mejor el token. Se reevalúa si aparecen datos privados en el servidor o Server Actions. A la espera de la decisión del responsable. | No sumar dependencias ni cambiar la arquitectura sin acuerdo | `historico/auditoria-fase-0-2.md` |
| 8 nov 2026 | CRM y Configuración se **retiran** del menú, las rutas y el código. | No tenían tablas ni funciones reales; mostrarlos aparentaba funciones terminadas. El historial de Git conserva el código | `estado.md` §3 |
| 8 nov 2026 | Usuarios lista con `admin_list_users()` (solo CEO), que incluye las cuentas de Auth sin perfil. Las cuentas de Auth se siguen creando a mano en Supabase; el panel solo les da acceso (`admin_create_profile`). | Crear cuentas desde el navegador exigiría `service_role`, prohibida | migración `20261108000001` (**aplicada**, confirmación del responsable el 8 nov 2026; sin validar con un CEO real) |
| 8 nov 2026 | La CSP va **sin nonces** y con `'unsafe-inline'` en scripts. Se cierra el resto: sin scripts ni conexiones de otros orígenes (salvo Supabase), sin `eval` en producción, sin embeber el sitio. | Con `cacheComponents` y PPR un nonce por pedido obliga a renderizar todo en cada visita (guía de Next 16); hace falta el script del tema | `despliegue.md` §3 |
| 8 nov 2026 | `Permissions-Policy` deja la cámara a la propia página y cierra micrófono, geolocalización y pagos. HSTS solo en producción y sin `includeSubDomains` ni `preload`. | El escáner usa la cámara (`audio: false`); HSTS con subdominios es difícil de revertir | `despliegue.md` §3 |
| 8 nov 2026 | La IP de desarrollo sale de `ALLOWED_DEV_ORIGINS` (`.env.local`), no del código. | Una IP fija de una red doméstica no debe estar en el repositorio | `.env.local.example` |
| 8 nov 2026 | La CI compila con las variables de Supabase vacías y no despliega ni usa secretos. | Que la CI sea determinista y no consulte la base real | `.github/workflows/ci.yml` |
| 8 nov 2026 | Al volver a una pestaña inactiva el panel reevalúa la sesión y el perfil; una cuenta desactivada vuelve al ingreso. Solo afecta lo que se ve: las operaciones las sigue rechazando la base. | Cerrar el desfasaje de hasta 1 hora de la pantalla | `auth-provider.tsx` |
| 8 nov 2026 | El comprobante de venta es **interno**: lleva la identificación del negocio y la leyenda «No es una factura ni un comprobante fiscal». No se simula ninguna emisión fiscal ni se agregan datos fiscales (CUIT, IVA, CAE). | Que un cliente no tome el papel por una factura; la facturación fiscal depende de un sistema autorizado y de la situación del negocio | `auditoria-pos-fase-0-4.md` §7 |
| 8 nov 2026 | El stock restante se ve en pantalla para quien vende, pero no se imprime en la copia del cliente. | Es un dato interno | idem |
| 8 nov 2026 | Las ventas de prueba se hacen solo en un proyecto de Supabase separado de producción; la semilla de prueba se niega a correr si la base tiene productos reales o ventas. | Una venta es permanente: no hay anulación | `proyecto-supabase-de-prueba.md` |
| 8 nov 2026 | La clave de operación de una venta se guarda en el navegador **antes de enviar**, junto con lo enviado. Con una venta sin confirmar no se puede armar otra: solo consultar, reintentar con la misma clave y contenido, o descartar (con la consulta confirmando que no existe y pasados 2 minutos). Antes de reenviar se consulta siempre si la clave ya tiene una venta. | Un corte de red o una recarga no pueden provocar una venta duplicada; la base ya garantizaba una venta por clave, faltaba que la pantalla no inventara una clave nueva | `recuperacion-de-ventas-pendientes.md` |

## Diseño del catálogo público

| Cuándo | Decisión | Motivo | Detalle |
| --- | --- | --- | --- |
| 2 nov 2026 | Orden de la portada: navegación flotante, slider, presentación, tickets de categorías, catálogo, beneficios, pie. | Brief del negocio | `historico/informe-rediseno-integral.md` |
| 2 nov 2026 | Modo claro y oscuro en toda la parte pública. **El panel conserva siempre los colores claros.** | Brief del negocio | idem |
| 2 nov 2026 | Elegir una categoría es «sacar un boleto» (tickets numerados `MP / 00X`). La numeración es gráfica y va por slug. | Brief del negocio | idem |
| 2 nov 2026 | La pantalla de carga de marca solo aparece en la primera entrada de la sesión a la portada, sin búsqueda ni filtros. Se puede saltar y no aparece con movimiento reducido ni sin JavaScript. | Marca sin bloquear al visitante | `historico/informe-intervencion-final.md` |
| 4 nov 2026 | Pie integral único: reemplaza las secciones separadas de contacto, ubicación y pagos. El menú mantiene sus accesos. | El brief lo pidió | `historico/informe-intervencion-final.md` |
| 4 nov 2026 | Tipografía: Nunito para títulos y precios; Geist para el cuerpo y el panel. El aviso de «fuente muy usada» del detector se acepta. | Decisión de diseño | idem |
| 4 nov 2026 | Paleta crema: la pide el brief; el aviso del detector se acepta. | Brief del negocio | idem |
| 4 nov 2026 | Sin corazón de favoritos ni «Ver todos los productos» fijo. El enlace «Contacto» en la cápsula sí está. | No hay función de favoritos; sin filtro el botón no llevaría a ningún lado | idem |
| 4 nov 2026 | Colores de WhatsApp como tokens fijos (`--color-whatsapp*`), no los que cambian con el tema. | Contraste de 1,8:1 en oscuro al pasar el cursor | idem |
| 2 nov 2026 | Las fotos de producto en modo oscuro llevan fondo claro neutro y ningún filtro. | No alterar colores ni perder productos oscuros | `historico/informe-rediseno-integral.md` |
| Nov 2026 | El carrusel de banners avanza cada 10 s (`AUTOPLAY_MS` en `src/lib/banners/rules.ts`); antes eran 5 s. Se detiene con cursor, foco, dedo, pestaña oculta y pausa; con movimiento reducido no avanza solo. | Más tiempo de lectura | commit `d728b55` |
| 4 nov 2026 | Si no hay dominio configurado, se omiten el enlace canónico y la imagen de vista previa; nunca se publica `localhost`. | Evitar enlaces rotos al compartir | `src/lib/site-url.ts` |
| 4 nov 2026 | Las pruebas `scripts/*.test.mjs` sí se versionan (sin credenciales ni datos de clientes). | Poder correrlas desde un clon | `.gitignore` |

## Proceso

| Cuándo | Decisión | Motivo | Detalle |
| --- | --- | --- | --- |
| Siempre | Todo se hace en una rama local. Nada va a `main` ni a GitHub sin el visto bueno del usuario. | Regla de la empresa | `AImpulse/CLAUDE.md` |
| Siempre | Las migraciones las aplica el usuario a mano en Supabase; el repositorio no las ejecuta. | Control sobre producción | `README.md` |
| 4 nov 2026 | Que una migración esté aplicada se anota en `estado.md`, con quién la confirmó. | La confirmación solo estaba en conversaciones | `estado.md` §2 |
| Oct 2026 (commit `c6fd133`) | `.env` se versiona con la URL y la clave **pública** de Supabase (repositorio privado). `docs/`, `supabase/`, `Logo/`, `.impeccable/` y los scripts sueltos salen del repositorio. | El mensaje del commit no registra el motivo | `.gitignore` |
| 8 nov 2026 | **Revierte la fila anterior para `docs/` y `supabase/`**: ahora se versionan (la Etapa 0 dejó trabajo valioso en una sola computadora). Siguen fuera `docs/capturas/`, `Logo/`, `.impeccable/` y los scripts sueltos. | Riesgo de pérdida; la auditoría de seguridad del Bloque 0 no halló claves ni datos personales | `.gitignore`, `estado.md` §1 |
| Nov 2026 (registrado el 8 nov) | Las operaciones hechas a mano por el usuario (aplicar `admin_list_users`, despublicar Termos, Mermelada, Palitos y Bolsas, borrar sus cuatro fotos) se anotan en una bitácora, sin inventar fecha ni hora. | Hubo cambios en producción sin registro técnico; el motivo fue la lentitud del borrado mediante Claude Code (unos cinco minutos por producto, sin medir) | `estado.md` §2 bis, `informe-bloque-1-conciliacion.md` |
| Nov 2026 (rectificación del Bloque 1) | La despublicación de Bolsas y la eliminación de su foto (C1) las hizo **el usuario a mano**, no Claude Code; el registro anterior lo atribuía mal. Hora no confirmada. | El usuario lo aclaró; el historial no se borra, se rectifica con nota | `auditoria-material-comercial-fase-0-5.md` §0.5, `estado.md` §2 bis |
| 8 nov 2026 | El cierre `close_drop_staff` **figura aplicado en producción** (`staff`, `staff_legacy` e `is_staff()` no existen). Operador y fecha: **desconocidos**; no se atribuye a nadie. Se corrige la documentación que lo daba por pendiente, conservando la decisión original (fila del 29 oct). El script de reversión de roles deja de ser utilizable. | Hallazgo del diagnóstico con el conector de Supabase (solo lectura) | `estado.md` §1 y §2 ter, `autorizacion-roles.md`, `informe-bloque-2-diagnostico-conector.md` |
| 8 nov 2026 | **No se optimiza ahora** el flujo de borrado de productos e imágenes. Primero se mide (manual contra automatizado, en el proyecto de prueba). | No es una funcionalidad de la Etapa 0 y no se atribuye la demora a una causa sin mediciones | `informe-bloque-1-conciliacion.md` §F |
| 9 nov 2026 | **Alcance S2 autorizado:** se eliminan los 10 productos, las 5 ventas de prueba, sus 5 detalles y los 10 movimientos; se conservan categorías, medios de pago, la cuenta CEO, la estructura, las políticas y el `audit_log`. Los dos archivos de Storage se respaldan y se eliminan. Los 3 triggers `*_no_change` del libro pueden deshabilitarse **solo dentro de la transacción** y quedan habilitados antes del `commit`. **Excepción única** a la protección «solo agregado». | Todo lo cargado en producción es de prueba (confirmado por el usuario); el libro no se puede limpiar de otra forma | `plan-limpieza-produccion.md`, `informe-final-etapa-0.md` |
| 9 nov 2026 | **Ejecutada la limpieza S2 en producción (05:21:50 UTC)** tras la confirmación explícita del usuario («Sí, ejecutar»). Quedan 2 archivos de Storage por borrar con una sesión. | Se cumplieron las condiciones: respaldo verificado, simulacro aprobado, producción igual al inventario | `informe-final-etapa-0.md` §3 |
| 9 nov 2026 | La **ejecución en producción exigía una última confirmación explícita** (cumplida) tras el respaldo restaurado y el simulacro aprobado. El simulacro se hace sobre una copia restaurada, no en producción (un simulacro en producción dejaría huecos en la numeración del `audit_log`). | Irreversible sin respaldo | `registro-respaldo-limpieza.md` |
| 9 nov 2026 | La limpieza **no crea esquemas ni tablas permanentes de respaldo en producción** y **no reinicia las secuencias** de ventas y movimientos. La recuperación sale del respaldo externo. | Instrucción final del usuario: enfoque proporcionado; sin necesidad técnica demostrada | `plan-limpieza-produccion.md` §11, `informe-final-etapa-0.md` §3 |
| 9 nov 2026 | El respaldo es una **copia lógica por el conector** porque el entorno no tiene `pg_dump` ni la contraseña de la base; se verificó por restauración e igualdad de huellas. Sigue recomendado un `pg_dump` con la contraseña. | Bloqueo de credenciales | `registro-respaldo-limpieza.md` §3 |

## Decisiones abiertas

| Tema | Pregunta |
| --- | --- |
| Git y respaldo | `docs/` y `supabase/migrations/` solo existen en esta carpeta, sin historial. ¿Se versionan (el repositorio es privado y las pruebas no llevan credenciales) o se mantienen fuera con un respaldo explícito? |
| Registro público de Auth | ¿Se desactiva? Hoy no se sabe su estado. |
| Cierre de `staff_legacy` | ~~¿Cuándo se aplica `close_drop_staff`?~~ **Ya está aplicado** (comprobado el 8 nov 2026). Abierto: ¿quién lo aplicó y cuándo? (desconocido). |
| Validación de roles | Solo existe la cuenta CEO. ¿Se crean cuentas de gerente y empleado de prueba en producción o se usa un proyecto aparte? Hasta decidirlo, las pruebas autenticadas de esos roles siguen pendientes. |
| Ventas de prueba en producción | Hay 5 ventas de prueba (30 oct a 5 nov 2026, confirmado por el usuario el 9 nov), con 10 movimientos de stock, en un historial de solo agregado. ¿Se conviven marcadas como de prueba o se limpian con un procedimiento controlado (copia de seguridad previa y aprobación)? Hasta decidirlo, no se toca. |
| Historial de migraciones | No existe registro de versiones (`supabase_migrations.schema_migrations`). ¿Se quiere un registro en adelante (por ejemplo, anotar cada migración aplicada en `estado.md`)? |
| Promociones y combos | ¿Por variante o por producto? ¿El combo descuenta stock? |
| Material comercial | C1 resuelto en la fuente: ¿se vacía la caché de imágenes del sitio publicado y la de esta computadora (`.next/cache/images`)? ¿El material de prueba se traslada al proyecto de prueba y producción queda solo con material real? ¿Hoy el sitio de producción ya lo ven clientes? |
| Banners | ¿Los dos banners se desactivaron a propósito? ¿Se crea arte para celular de 1200 × 900? |
| Catálogo | ¿El negocio vende alimentos (palitos, mermelada) y en qué categoría van? ¿Se muestra el alquiler de inflables y disfraces? |
| Criterio del 8 nov 2026 | Los productos y fotos que hoy aparecen en el catálogo son **material de prueba**; no se mejora, duplica ni corrige. El catálogo definitivo se construye con productos reales confirmados, nombres, marcas, variantes y fotos correspondientes y precios autorizados. Lo único que no espera es retirar datos personales de terceros (C1). |
