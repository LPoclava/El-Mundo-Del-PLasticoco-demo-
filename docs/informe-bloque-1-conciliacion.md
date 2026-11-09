# Informe del Bloque 1 (Fase 0.6): conciliación de producción y documentación

Fecha de las verificaciones: **8 de noviembre de 2026** (hora de Argentina; el servidor respondió con fecha del 9 de noviembre, 00:52 UTC, que es la misma noche). **Solo lectura:** no se modificó ningún producto, categoría, foto, precio, stock, variante, banner, cuenta, migración ni dato de Supabase; no se hicieron ventas, commits, push, merge ni deploy; no se limpió ninguna caché ni se tocó Vercel. Lo único que se consultó fue lo que ve cualquier visitante (clave pública) y un servidor de producción **local** construido a propósito con un dominio de prueba (escribe solo en `.next/`, ignorada por Git).

**Cómo se lee la evidencia** (misma convención que el informe de apertura):
- **[U] Confirmado por el usuario**: lo dijo el responsable; no hay registro técnico en el repositorio.
- **[O] Observado hoy**: comprobado en esta intervención.
- **[H] Evidencia histórica**: la dejó una fase anterior y no se repitió hoy.
- **[N] No verificable**: requiere acceso privado, credenciales o permisos que no tengo.

## A. Hechos confirmados por el usuario [U]

| # | Hecho | Fecha |
| --- | --- | --- |
| 1 | El usuario **aplicó** la migración `20261108000001_admin_list_users`. | Noviembre de 2026; sin fecha ni hora exacta |
| 2 | El usuario **despublicó manualmente** los productos Termos, Mermelada, Palitos y Bolsas. | Noviembre de 2026; sin fecha ni hora exacta |
| 3 | El usuario **eliminó manualmente** de Supabase Storage las cuatro fotografías correspondientes. | Noviembre de 2026; sin fecha ni hora exacta |
| 4 | Motivo: el flujo de eliminación ejecutado mediante Claude Code tardaba **aproximadamente cinco minutos** por producto. | (dato aportado por el usuario) |

No hay evidencia de la fecha ni de la hora de estas operaciones y **no se inventan**. Lo único que se puede acotar: la apertura de la fase 0.6 (8 de noviembre) ya las encontró hechas [H].

**Rectificación de C1 (corrección final del Bloque 1, noviembre de 2026).** Este informe señaló primero una discrepancia: el registro de C1 (`auditoria-material-comercial-fase-0-5.md` §0.5) atribuía a Claude Code la despublicación de «Bolsas de residuos» y el retiro de su foto, y el usuario las incluía entre sus operaciones manuales. **El usuario aclaró que las cuatro bajas (Termos, Mermelada, Palitos y Bolsas) y la eliminación de sus fotografías las hizo él manualmente**, por la demora del procedimiento automatizado. La atribución anterior era incorrecta. Responsable: usuario, operación manual. Fecha: noviembre de 2026. Hora: no confirmada. Acción sobre Bolsas: despublicación y eliminación de su fotografía. La discrepancia queda **cerrada**; el texto anterior se conserva en la auditoría con una nota de rectificación.

## B. Verificaciones actuales y evidencia

### B.1 Git y migración

| Verificación | Resultado [O] |
| --- | --- |
| Rama y commit | `etapa-0-estabilizacion` en `bdcdd6d0344ff904d5b2dc2eb0ba7364668b7ba1`; padre `de4b9c2` |
| `main` y `origin/main` | Sin cambios, ambos en `de4b9c2` |
| Árbol de trabajo | Limpio salvo `Logos de categorias/` (excluida a propósito) |
| Función `admin_list_users` | Existe: una llamada pública responde 401 «no autorizado» (si no existiera, respondería 404). Concuerda con lo que dice el usuario [U]. **No se volvió a aplicar.** |
| Quién y cuándo la aplicó | Sin registro técnico [N]; solo la palabra del usuario [U] |
| Funcionamiento con una cuenta CEO real | **No probado.** Que la función exista no equivale a que la pantalla Usuarios funcione con un CEO real |

### B.2 Catálogo, banners y recursos públicos (consultas de solo lectura)

| Verificación | Resultado [O] | Comparación con la documentación |
| --- | --- | --- |
| Productos en el catálogo público | **1:** «Juego de Cuchillos» (Cocina) | `estado.md` §3 quater (versión del 8 nov, C1) decía 5 publicados; ya reconciliado en el Bloque 0 con el informe de apertura |
| Categorías públicas | Solo `cocina` | Esperable: una categoría pública solo aparece si tiene producto publicado |
| Banners vigentes | **0** | Igual que en la apertura; se desconoce si fue intencional |
| Termos, Mermelada, Palitos, Bolsas en el catálogo | **Ninguno aparece** (por nombre) | Concuerda con la acción del usuario [U] |
| URL pública de la foto de Bolsas (C1) | HTTP **400** (JSON de 88 bytes) | Igual que tras C1 [H] |
| URL pública de la foto de Termos (C2, el logo de AImpulse) | HTTP **400** (88 bytes; antes eran 37.048 bytes) | Cambió respecto de la preparación de C2: **el archivo ya no existe** |
| Fotos de Mermelada y Palitos | **No se pudo repetir la consulta**: sus rutas no están en las vistas públicas porque los productos no están publicados y no tengo acceso privado [N]. La apertura registró 400 para las cuatro [H] | — |
| Listado público del bucket `product-images` | Responde 200 con **0 elementos** (no se puede enumerar el contenido desde fuera) | — |
| Tablas base (`products`, `sales`, `profiles`, `stock_movements`, `audit_log`) con la clave pública | 401 en todas | Igual que las verificaciones de la fase 0.2 |
| Funciones sensibles (`pos_find`, `low_stock_variants`, `admin_list_users`) sin sesión | 401 en todas | Sin cambios |
| **Registro público de cuentas (Auth)** | **Cerrado** (`disable_signup`: true); solo el proveedor de correo; correo sin autoconfirmar | **Difiere** de `estado.md` §4, que decía «la última evidencia decía abierto». Quién lo cerró y cuándo: sin registro [N]. Mejora de seguridad, pero hay que documentarla |

### B.3 Sitemap, páginas públicas y metadatos

Se construyó la aplicación **en local** con un dominio de prueba (`dominio-de-prueba.example`) y se consultó un servidor local de producción, que lee el Supabase real en solo lectura. Nota de método: un primer `build` sin dominio dio un sitemap vacío (comportamiento previsto: sin dominio no se inventan direcciones); por eso se repitió con dominio.

| Verificación | Resultado [O] |
| --- | --- |
| `sitemap.xml` | 2 direcciones: la portada y «Juego de Cuchillos». **0 referencias** a Bolsas, Termos, Mermelada, Palitos ni a los ids de C1 y C2 |
| `robots.txt` | Permite el sitio y bloquea `/panel` |
| Portada | 0 referencias a los ids de producto o de archivo afectados ni a los cuatro nombres; imágenes optimizadas: el logo, el nombre de marca y la foto de Cuchillos |
| Ficha del producto de C1 (`/producto/<id>`) | HTTP 200 con «Producto no disponible», `noindex`; la vista previa social usa la **imagen genérica de marca** (`/brand/og-image.png`), no la foto del producto |
| Ficha del producto de C2 | Igual: «Producto no disponible», `noindex`, imagen genérica |
| Fichas de Mermelada y Palitos | **No verificables por id**: sus ids no son públicos y no tengo acceso privado [N]. Por construcción (la ficha lee la vista pública) ocurre lo mismo que con C1 y C2, pero no se comprobó |

**Qué no demuestra nada:** un HTTP 400 en la URL de Storage prueba que **el servidor de Supabase ya no entrega el archivo**. **No prueba** que no exista ninguna copia: pueden quedar la caché del optimizador de imágenes del sitio publicado, vistas previas ya generadas por redes de mensajería, cachés de buscadores o de intermediarios, y copias descargadas o capturadas por terceros. Nada de eso se puede consultar desde acá [N].

### B.4 Lo que no se pudo verificar [N]

- El sitio de producción en Vercel: dominio, despliegue vigente, variables de entorno (`NEXT_PUBLIC_SITE_URL`) y caché de imágenes. La documentación no registra la dirección pública y no hubo acceso a Vercel.
- Los ids y las rutas de las fotos de Mermelada y Palitos, y el estado interno de los productos despublicados (necesita sesión del panel).
- La tabla `audit_log` (quién cambió qué y cuándo): necesita un CEO con sesión; permitiría fechar las operaciones manuales, pero no se accedió.
- Cualquier copia externa de las imágenes.

## C. Diferencias entre documentación, código y producción

| # | Tema | Documentación | Estado observado | Acción |
| --- | --- | --- | --- | --- |
| 1 | `admin_list_users` | Bloque 0 ya la registró como aplicada [U] | Existe en producción [O] | Se agrega la **fecha de observación** y el origen (operación manual del usuario) en la bitácora |
| 2 | Quién despublicó y quitó fotos | C1 atribuía Bolsas a Claude Code; la apertura decía «no consta quién» | El usuario confirma que fueron operaciones manuales, **incluida la de Bolsas** [U] | Se registra en la bitácora; la atribución de C1 se rectifica (§A) |
| 3 | C2 | «Preparado, sin ejecutar» (§0.6 de la auditoría) | Archivo del logo inexistente [O]; retirado por el usuario [U] | Se actualiza la auditoría, `estado.md` y las decisiones |
| 4 | Registro público de Auth | «Última evidencia: abierto» (`estado.md` §4) | **Cerrado** [O] | Se corrige `estado.md` §4 (sin atribuir autoría) |
| 5 | Borrado de productos | `gestion-de-productos.md`: «sin borrado de productos: solo archivar» | Hubo operaciones manuales de despublicar y borrar archivos en Storage | Se agrega el procedimiento real y la incidencia de rendimiento |
| 6 | Catálogo | Varios documentos hablan de «5 productos» | 1 publicado [O] | Ya corregido en el Bloque 0; se mantiene la advertencia de que no es un catálogo definitivo |
| 7 | Código | `saveProduct` borra el archivo de Storage solo si ninguna otra fila lo usa | Un borrado manual en Storage **no pasa por esa verificación** | Riesgo documentado en §G (una fila de `product_images` podría apuntar a un archivo inexistente) |

No hay diferencias entre el código y las pruebas: el Bloque 0 dejó 258/258, 253/253 y 10/10.

## D. Bitácora de operaciones manuales

Registro por **orden causal conocido**; las fechas exactas **no constan**. «Noviembre de 2026» es la única referencia segura.

| # | Operación | Autor [U] | Cuándo | Evidencia |
| --- | --- | --- | --- | --- |
| 1 | Aplicar la migración `20261108000001_admin_list_users` en Supabase | Usuario | Noviembre de 2026; no es posterior a la apertura de la fase 0.6 | Confirmación del usuario; la función existe [O] |
| 2 | Despublicar Termos, Mermelada, Palitos y Bolsas | Usuario | Noviembre de 2026; ya hecho al abrir la fase 0.6 | Confirmación; ninguno figura en el catálogo [O] |
| 3 | Eliminar de Storage las cuatro fotos de esos productos | Usuario | Igual | Confirmación; 400 en las rutas conocidas (C1 y C2) [O]; las otras dos [H] |
| 4 | Cerrar el registro público de Auth | **Sin autor ni fecha conocidos** | Antes del 8 de noviembre de 2026, noche | Estado observado [O]; no confirmado por el usuario |

Operación ejecutada por Claude Code con autorización (para distinguirla): borrado de la caché local `.next/cache/images` (78 archivos), el 8 de noviembre de 2026. **La despublicación de Bolsas y la eliminación de su foto (C1) no son de Claude Code: las hizo el usuario** (ver la rectificación en §A); un registro anterior las atribuía mal.

## E. Estado de C1 y C2

| Punto | C1: foto con datos personales (Bolsas de residuos) | C2: foto con el logo de AImpulse Tech (Termos 700ml) |
| --- | --- | --- |
| Origen | **Retirada del origen** (el archivo ya no existe en Storage; HTTP 400) [O] | **Retirada del origen por el usuario** [U]; HTTP 400 [O] |
| Producto | Despublicado; no figura en catálogo, sitemap ni portada [O] | Despublicado [U]; igual [O] |
| Ficha | «Producto no disponible», `noindex`, imagen genérica [O] | Igual [O] |
| Caché local de esta computadora | Borrada (autorizado) [H] | Borrada (misma caché) [H] |
| Caché del sitio publicado (Vercel) | **Sin verificar** [N] | **Sin verificar** [N] |
| Vistas previas ya generadas, buscadores, copias de terceros | **Sin verificar** [N] | **Sin verificar** [N] |
| ¿Se puede afirmar que no quedan copias? | **No** | **No** |
| Qué falta | Decidir si se vacía la caché de imágenes del sitio publicado o se redespliega; no hay forma de verificar copias de terceros | Igual; además, el logo no es un dato personal, así que el riesgo es de coherencia de marca, no de privacidad |

## F. Incidencia de rendimiento: eliminación de un producto mediante Claude Code

**Incidencia registrada [U]:** quitar un producto del catálogo público mediante Claude Code demoraba **aproximadamente cinco minutos por operación**. Es un dato de percepción del usuario; **no hay mediciones** y no se atribuye a ninguna causa. No se cambió código ni se optimiza ahora: queda fuera del cierre de la Etapa 0.

**Cómo es el flujo hoy (descripción del código, no medición).** El panel no tiene «borrar producto»: despublicar es una acción, y quitar una foto es parte de «Guardar» (`saveProduct`, `src/lib/products/admin.ts`). `saveProduct` ejecuta **pasos secuenciales**, cada uno una consulta de red al servidor: despublicar, actualizar los campos, actualizar o insertar cada variante, cambiar la foto principal en dos pasos, actualizar posiciones, borrar filas de fotos, volver a consultar qué archivos siguen en uso, borrar el archivo de Storage, releer el producto completo y, si corresponde, publicar. La primera pulsación de «Despublicar» abre además un diálogo de confirmación.

**Posibles puntos de demora (hipótesis a medir, ninguna confirmada):**

| Punto | Por qué podría influir | Cómo se mediría |
| --- | --- | --- |
| Operaciones secuenciales de Storage | Subida y borrado esperan la respuesta uno por uno | Tiempo de cada llamada al almacenamiento desde las herramientas del navegador |
| Consultas y actualizaciones de base de datos | Unas 8 a 12 consultas en serie por «Guardar» | Pestaña de red: duración de cada solicitud REST |
| Eliminación de registros relacionados | Filas de fotos y variantes se tocan de a una o en grupo | Igual |
| Revalidación de rutas / caché | El panel es del lado del cliente y no parece disparar revalidación en servidor (no se encontró en `lib/products`); la visibilidad pública depende de las cachés del sitio | Medir cuánto tarda en reflejarse el cambio en el catálogo, aparte de cuánto tarda en guardarse |
| Espera de respuestas del servidor | Latencia o límites del proyecto de Supabase | Repetir la operación a mano con el cronómetro, sin Claude Code |
| Comportamiento de la interfaz | Diálogo de confirmación, mensajes de estado y relectura al terminar | Observar con el panel de rendimiento del navegador |
| **El propio método de automatización** | Cada acción mediante Claude Code (leer la pantalla, hacer clic, esperar, volver a leer) es un ciclo de ida y vuelta adicional; podría explicar buena parte de los minutos aunque la aplicación fuera rápida | Comparar el tiempo manual contra el automatizado para la misma operación |

**Medición mínima propuesta (para cuando se autorice, en el proyecto de prueba y no en producción):** repetir la misma operación tres veces a mano con cronómetro y con la pestaña de red abierta; después repetirla mediante Claude Code. La diferencia entre ambas separa el costo de la aplicación del costo del método.

## G. Riesgos y dependencias pendientes

| # | Riesgo o dependencia | Nivel | Estado |
| --- | --- | --- | --- |
| 1 | **Roles reales sin validar**: nunca se probó el ingreso con una cuenta de cada rol ni la pantalla Usuarios con un CEO real | Alto | Pendiente (`protocolo-validacion-cuentas.md`) |
| 2 | **CI** nunca corrió en GitHub y **Vercel** no se verificó (despliegue, cabeceras nuevas, `NEXT_PUBLIC_SITE_URL`) | Alto | Pendiente; requiere acceso |
| 3 | Copias externas y caché del sitio publicado de C1 y C2 sin verificar | Medio | Pendiente de decisión del responsable |
| 4 | Borrado manual de fotos en Storage sin pasar por la verificación del panel: podría quedar una fila de `product_images` que apunte a un archivo inexistente | Medio | Revisar con sesión del panel (solo lectura de productos despublicados); no consta |
| 5 | Cambios hechos fuera de la aplicación (despublicar, borrar fotos, cerrar el registro de Auth) sin registro técnico propio | Medio | Se anotan acá; fechar con `audit_log` cuando haya un CEO con sesión |
| 6 | Banners: 0 vigentes; el sitio puede verse sin la zona promocional | Bajo | Confirmar si es intencional |
| 7 | El catálogo actual no representa un catálogo comercial definitivo | Bajo | Decisión del negocio (material real) |
| 8 | Fase 0.4 sin cerrar: proyecto de Supabase de prueba, prueba física del POS, impresión real, corte de red real, riesgos residuales H1 (R1 a R7) | Alto | Pendiente |
| 9 | ~~Aclarar quién ejecutó la baja de Bolsas~~ | — | **Resuelto:** la hizo el usuario (rectificación en §A) |
| 10 | Incidencia de rendimiento del borrado sin medir | Bajo | Registrada; no se corrige ahora |

## H. Documentos actualizados

| Documento | Cambio |
| --- | --- |
| `docs/informe-bloque-1-conciliacion.md` | Nuevo (este informe) |
| `docs/estado.md` | Nueva sección de bitácora de operaciones manuales; C1, C2, catálogo y registro de Auth corregidos con fechas; fila de la fase 0.6 |
| `docs/decisiones.md` | Decisiones nuevas: registro de las operaciones manuales y aplazamiento de la optimización del borrado |
| `docs/auditoria-material-comercial-fase-0-5.md` | Nota fechada al final de §0.6 (C2 retirada por el usuario); el texto anterior se conserva |
| `docs/informe-apertura-fase-0-6.md` | Nota de actualización del Bloque 1 (se conserva el texto original) |
| `docs/gestion-de-productos.md` | Procedimiento real para quitar un producto del público y nota sobre la incidencia |
| `docs/README.md` | Entrada del informe nuevo |

No se borró el historial anterior: las aclaraciones se agregaron con fecha y etiqueta de evidencia.

## I. Recomendación para iniciar el Bloque 2

1. **Cerrar primero lo que depende del usuario** (sin código): decidir si se vacía la caché de imágenes del sitio publicado o se redespliega, y confirmar si el banner en cero es intencional.
2. **Bloque 2 propuesto: validación con cuentas y entorno de prueba.** Crear el proyecto de Supabase de prueba con la semilla ya preparada y ejecutar `protocolo-validacion-cuentas.md` con una cuenta de cada rol (incluida la pantalla Usuarios con un CEO real). Es el mayor riesgo abierto y no exige tocar producción.
3. **Dejar para después** la verificación de CI y Vercel (necesita acceso del usuario a GitHub y Vercel) y la prueba física del POS (necesita presencia del usuario).
4. **No incorporar ahora** la optimización del borrado: medir primero con el procedimiento de §F.
5. Antes de empezar, pedir autorización explícita: el Bloque 2 implica crear un proyecto y cuentas de prueba.

**Resultado del Bloque 1:** verificación **parcial**. Completa para el catálogo público, el sitemap, `robots.txt`, la ficha de C1 y C2, los banners, la función `admin_list_users` y el estado de Git. **No completa** para Mermelada y Palitos por id, las fotos de esos dos, el sitio de producción en Vercel, las cachés y copias externas, y la fecha de cada operación manual.
