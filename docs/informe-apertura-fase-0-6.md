# Informe de apertura de la Fase 0.6: validación integral y cierre técnico de Etapa 0

Fecha: 8 de noviembre de 2026. Solo diagnóstico: **no se modificó código, configuración, datos, imágenes, productos, precios, categorías ni banners; no se creó ni aplicó ninguna migración; no se hicieron ventas, commits, push ni deploy; no se limpió ninguna caché.** Lo único que se hizo contra producción fue **leer lo que ve cualquier visitante** (vistas públicas y cabeceras de archivos). Se reejecutaron las pruebas y la compilación, que solo escriben en carpetas de compilación ignoradas por Git.

**Cómo se lee la evidencia:**
- **[E] Evidencia actual**: comprobada en esta intervención.
- **[H] Evidencia histórica**: la dejó una fase anterior y no se repitió hoy.
- **[N] No verificado**: afirmado en un informe o supuesto, sin comprobación posible hoy.

## A. Estado general

**El código de la Etapa 0 funciona y pasa todas sus pruebas, pero no está respaldado ni validado en el mundo real, y la documentación quedó desactualizada respecto de producción.**

| Verificación de hoy [E] | Resultado |
| --- | --- |
| TypeScript, ESLint, build de producción | Sin errores |
| Pruebas de la aplicación (`npm test`) | **258 de 258** |
| Pruebas de la base (PGlite) | **253 de 253** |
| Concurrencia (PostgreSQL real temporal local) | **10 de 10** |
| Restos del modo demostración | Ninguno |

**Tres cosas que cambiaron en producción y que no figuran en ningún informe ni en la documentación** [E] (las hizo alguien con acceso al panel o a Supabase, no esta intervención):

1. **La migración `20261108000001_admin_list_users` parece aplicada.** La función existe en producción (llamada pública: 401 «no autorizado»; si no existiera, la respuesta sería 404). No tengo una comprobación anterior de esa función concreta, así que no puedo decir cuándo apareció; la documentación y tu mensaje la dan por pendiente.
2. **El catálogo público tiene hoy 1 solo producto publicado** («Juego de Cuchillos»). Termos, Mermelada, Palitos y Bolsas están despublicados.
3. **Los archivos de foto de Termos, Mermelada, Palitos y Bolsas ya no existen** en el almacenamiento (la URL de cada uno responde 400). Solo queda la de Cuchillos (9.152 bytes). Eso incluye el archivo del logo de AImpulse (C2).

**Consecuencia sobre C2:** el logo de AImpulse **ya no es accesible públicamente**, porque el archivo no existe y el producto no se muestra. No consta quién lo hizo ni cuándo, así que C2 se puede dar por resuelto en cuanto a exposición pública **solo después de que el responsable lo confirme**.

**Git** [E]: la rama `etapa-0-estabilizacion` tiene **0 commits propios**. `main`, `origin/main` y las demás ramas siguen en `de4b9c2`. **Todo el trabajo de la Etapa 0 (47 cambios) está sin commitear**: 21 archivos modificados, 11 eliminados (con stage) y 15 nuevos. Además `docs/`, `supabase/` (migraciones, pruebas, semilla) y `Logo/` están fuera de Git por `.gitignore`. Hoy todo eso existe en una sola computadora, sin historial.

## B. Matriz de pendientes

Estados: **TERMINADO**, **PARCIAL**, **PENDIENTE**, **BLOQUEADO** (necesita algo que no tengo).

| # | Tarea | Fase | Estado | Evidencia | Riesgo | Dependencia |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Login único con Supabase Auth, sin modo demo | 0.2 | **TERMINADO (código)** | [E] 0 restos de demo; 258 pruebas; build | Bajo | — |
| 2 | Roles y menú por rol, permisos en la base | 0.2 | **TERMINADO (lógica)**; **PARCIAL (real)** | [E] pruebas; [E] tablas y RPC rechazan al público (401) | Medio: nunca se probó con cuentas reales | Cuentas empleado, gerente y CEO |
| 3 | Reevaluar la sesión al volver a la pestaña | 0.2/0.3 | **PARCIAL** | [E] código y pruebas estáticas; [N] comportamiento real | Bajo | Cuentas reales |
| 4 | Pantalla Usuarios con `admin_list_users` | 0.2 | **PARCIAL** | [E] la función existe en producción; [N] quién y cuándo la aplicó; [N] pantalla probada con un CEO real; documentación desactualizada | Medio | Confirmación del responsable; cuenta CEO |
| 5 | Sin `@supabase/ssr` (decisión) | 0.2 | **TERMINADO** | [H] decisión aprobada | Bajo | — |
| 6 | Cabeceras de seguridad y CSP | 0.3 | **PARCIAL** | [H] verificadas en servidor local de producción; [N] nunca desplegadas; [N] escáner con cámara bajo CSP sin probar en vivo | Medio: una CSP puede romper la cámara en producción | Vista previa de Vercel; celular |
| 7 | `robots.txt`, `sitemap.xml`, canonical, Open Graph | 0.3 | **PARCIAL** | [H] verificados localmente con un dominio de prueba; [N] `NEXT_PUBLIC_SITE_URL` en Vercel | Bajo | Acceso a Vercel |
| 8 | CI de GitHub | 0.3 | **PARCIAL** | [E] el archivo existe; [E] sin versionar; [N] nunca corrió en GitHub | Medio: no hay chequeo automático | Push autorizado |
| 9 | Revisión de Vercel (despliegue, variables, Node) | 0.3 | **BLOQUEADO** | [N] sin acceso ni dirección de producción | Medio | Acceso a Vercel o la URL |
| 10 | Atomicidad, idempotencia y control de stock de `confirm_sale` | 0.4 | **TERMINADO (en pruebas)** | [E] 253 + concurrencia 10/10 | Bajo en la base | — |
| 11 | Recuperación de ventas pendientes (H1) | 0.4 | **PARCIAL** | [E] 44 pruebas de lógica y base; [N] pantalla con un corte de red real; riesgos residuales R1 a R7 abiertos | Medio | Prueba física |
| 12 | Comprobante interno (contenido) | 0.4 | **TERMINADO (contenido)**; **PENDIENTE (impresión)** | [E] pruebas del texto; [N] papel real | Bajo | Impresora |
| 13 | Proyecto de Supabase de prueba | 0.4 | **PENDIENTE** | [E] no existe; requisitos y semilla listos (253 pruebas incluyen la semilla) | Alto: bloquea todo lo operativo | Autorización y cuentas |
| 14 | Validación física del POS (celular, cámara, lector) | 0.4 | **PENDIENTE** | [E] protocolo escrito | Alto | Presencia del responsable, dispositivos |
| 15 | Anulación de ventas | 0.4 | **PENDIENTE (decisión)** | [E] no existe | Medio | Decisión del negocio |
| 16 | Auditoría comercial y corrección de criterio | 0.5 | **TERMINADO** | [E] documento | Bajo | — |
| 17 | C1: foto con datos personales | 0.5 | **TERMINADO en la fuente**; **PARCIAL en copias** | [E] URL anterior: 400; producto fuera del catálogo; [N] caché del sitio publicado y copias externas | **Alto** hasta verificar | Vercel; vigilancia externa |
| 18 | C2: foto con el logo de AImpulse | 0.5 | **PARCIAL** | [E] archivo inexistente (400) y producto no publicado; [N] quién lo hizo | Bajo | Confirmación del responsable |
| 19 | Caché local de imágenes | 0.5 | **TERMINADO** | [H] autorizada y verificada | Bajo | — |
| 20 | Catálogo definitivo (productos reales y fotos) | 0.5 | **PENDIENTE** | [E] 1 producto publicado, de prueba; 0 banners | Alto si el sitio es público | Material real |
| 21 | Banners | 0.5 | **PENDIENTE** | [E] 0 vigentes | Medio | Estado en el panel; arte |
| 22 | Trabajo sin commit y fuera de Git | 0.6 | **PENDIENTE** | [E] 0 commits propios; 47 cambios; `docs/`, `supabase/`, `Logo/` ignorados | **Alto** (pérdida de trabajo) | Autorización de commit o respaldo |
| 23 | Documentación al día con producción | 0.6 | **PENDIENTE** | [E] `estado.md` dice «migración sin aplicar» y lista 5 productos publicados | Medio | Conciliar con la realidad |
| 24 | Registro de los cambios hechos en producción por fuera de esta sesión | 0.6 | **PENDIENTE** | [E] las 3 diferencias de la sección A | Medio | Confirmación del responsable |

## C. Riesgos críticos

| # | Área | Riesgo | Por qué importa |
| --- | --- | --- | --- |
| R1 | **Datos** | **Todo el trabajo de la Etapa 0 existe solo como cambios sin commit** en una computadora; `docs/` y `supabase/` ni siquiera están en Git | Un borrado, un error de OneDrive o un cambio de rama accidental pierde meses de trabajo y sus pruebas |
| R2 | **Seguridad e imágenes** | C1 resuelto en el origen, pero **la caché de Vercel y las copias externas siguen sin verificar** (vistas previas de WhatsApp, buscadores, copias guardadas) | Los datos personales de un tercero pueden seguir circulando |
| R3 | **POS** | Las ventas son permanentes, no hay anulación, y **el circuito nunca se probó con Supabase real, cuentas reales, celular, cámara ni impresora** | El primer error real puede ser una venta mal cobrada o duplicada sin vuelta atrás |
| R4 | **POS (H1)** | Riesgos residuales abiertos: otra pestaña, cerrar la pestaña con un intento pendiente, cuenta desactivada, la base no rechaza «misma clave con otro contenido» | Casos raros, pero con efecto sobre dinero y stock |
| R5 | **Producción** | **Cabeceras y CSP nunca se desplegaron ni se probaron con la cámara real**; Vercel sin acceso; se desconoce qué commit está desplegado | Una CSP puede dejar sin cámara al escáner, y no se sabe qué hay en línea |
| R6 | **Producción y registro** | **Se cambió producción fuera de esta sesión** (migración, despublicaciones, borrado de fotos) y no hay bitácora ni la documentación lo refleja | Se decide sobre información vieja, y una auditoría no puede reconstruir qué pasó |
| R7 | **Comercial** | El sitio de producción muestra hoy **1 producto de prueba** con la foto de otra marca; 0 banners; no se sabe si ya lo ven clientes | Mala impresión o consultas por un producto inexistente |
| R8 | **Calidad** | La CI nunca corrió en GitHub y el archivo ni siquiera está versionado | Ningún chequeo automático protege a `main` |
| R9 | **Autorización** | Roles y permisos solo probados en simulación; un error de configuración real (por ejemplo, un empleado con rol de gerente) no se detectaría | Acceso indebido a stock o ventas |

**Lo que sí está sólido** [E]: las tablas base y las funciones sensibles rechazan al público (401), el registro público de Auth está cerrado, el listado público del almacenamiento no devuelve nada, y ninguna prueba falla.

## D. Plan de ejecución

El orden evita perder trabajo, evita decidir con información vieja y deja lo irreversible (ventas permanentes) para un entorno de prueba. **No se ejecuta nada hasta tu autorización expresa.**

| Bloque | Objetivo | Procedimiento | Criterios de aceptación | Pruebas |
| --- | --- | --- | --- | --- |
| **0. Asegurar el trabajo** | Que nada se pierda | Con tu autorización: commit local en `etapa-0-estabilizacion` (sin push) del código; decidir cómo respaldar `docs/`, `supabase/` y `Logo/` (versionarlos o una copia externa) | Árbol limpio; historial de la Etapa 0; copia verificable de lo no versionado | `tsc`, lint, pruebas y build iguales a hoy |
| **1. Conciliar con la realidad** | Que el registro diga lo que hay | Con tu confirmación: qué cambios se hicieron en producción, quién y cuándo (migración, despublicaciones, fotos); actualizar `estado.md`, `decisiones.md` y la auditoría; abrir una bitácora de cambios en producción | Los documentos coinciden con las comprobaciones de solo lectura; cada cambio externo tiene autor y fecha | Repetir las comprobaciones de solo lectura |
| **2. Proyecto de prueba** | Un entorno donde las ventas no importan | Crear el proyecto de Supabase de prueba, aplicar las 19 migraciones en orden, correr la semilla, crear 3 cuentas | Las verificaciones de solo lectura de `proyecto-supabase-de-prueba.md` dan lo esperado; la semilla se niega en producción (ya probado) | Verificaciones SQL del documento |
| **3. Cuentas reales** | Roles, sesión y desactivación en la plataforma real | Seguir `protocolo-validacion-cuentas.md` en el proyecto de prueba (incluye Usuarios con `admin_list_users` y desactivar una cuenta) | Cada rol ve y puede solo lo previsto; la cuenta desactivada pierde acceso | Protocolo con registro |
| **4. POS físico y cortes reales** | Validar el circuito de punta a punta | Con vos presente y en el proyecto de prueba: `protocolo-prueba-fisica-pos.md` (cámara, lector, carrito, medios de pago, stock, impresión) y cortes de red reales para H1 | Pasan todos los pasos; una sola venta por intento; el stock cierra con sus movimientos; el comprobante imprime legible | Protocolo con evidencia |
| **5. Infraestructura** | Verificar lo que solo existe en la plataforma | Con acceso a Vercel: variables (`NEXT_PUBLIC_SITE_URL`), Node, vista previa con cabeceras y CSP, escáner bajo CSP en celular, caché de imágenes (C1); subir la rama a GitHub con autorización para ver la CI | CSP sin violaciones; cámara abre; sitemap y robots correctos; CI en verde; imagen C1 inaccesible desde el sitio publicado | `curl` de cabeceras, prueba en celular, ejecución de la CI |
| **6. Decisiones de negocio** | Cerrar lo que no es técnico | Anulaciones y devoluciones; si se endurece la base contra «misma clave con otro contenido»; material de prueba fuera de producción; catálogo y banners reales | Decisiones registradas en `decisiones.md` | — |
| **7. Cierre** | Informe final de la Etapa 0 | Clasificar cada requisito como TERMINADO, PARCIAL, PENDIENTE o BLOQUEADO con su evidencia | Ningún requisito «terminado» sin evidencia actual | Suite completa y comprobaciones de solo lectura |

Los bloques 2 a 4 dependen entre sí en ese orden; el 5 puede avanzar en paralelo desde que haya acceso a Vercel; el 6 es independiente.

## E. Dependencias externas

| Qué falta | Quién | Bloquea |
| --- | --- | --- |
| Autorización para commitear en la rama (sin push) y decisión sobre respaldar `docs/`, `supabase/` y `Logo/` | Vos | Bloque 0 |
| Confirmar qué cambios se hicieron en producción (migración aplicada, 4 productos despublicados, 4 fotos borradas) y cuándo | Vos | Bloque 1 y C2 |
| Autorización para crear el proyecto de Supabase de prueba y acceso a una cuenta de Supabase | Vos | Bloques 2 a 4 |
| Tres cuentas de prueba (empleado, gerente, CEO) con contraseñas que definís vos | Vos | Bloque 3 |
| Celular con Chrome o Safari, cámara, HTTPS (túnel o vista previa), lector físico (si hay) y una impresora | Vos | Bloque 4 |
| Presencia tuya durante la prueba física y los cortes de red | Vos | Bloque 4 |
| Acceso a Vercel o la dirección del sitio publicado; saber qué commit está desplegado | Vos | Bloque 5, C1 y R5 |
| Autorización para subir la rama a GitHub (para que corra la CI) | Vos | Bloque 5 |
| Decisión sobre anulaciones y devoluciones | Vos | Bloque 6 |
| Productos reales confirmados, nombres, marcas, variantes, fotos y precios autorizados | Vos | Catálogo definitivo |
| Saber si el sitio de producción ya lo ven clientes | Vos | Urgencia de R2 y R7 |

## F. Recomendación

**¿Está el proyecto preparado para continuar?** El código, sí: todo lo que se puede probar sin entornos externos pasa. **No está preparado para certificarse ni para publicarse.**

**Qué resolver primero:**
1. **Asegurar el trabajo (bloque 0).** Es lo más barato y lo más grave de perder.
2. **Conciliar el registro con producción (bloque 1)**, empezando por confirmar los tres cambios hechos fuera de esta sesión.
3. **Crear el proyecto de prueba (bloque 2)**, porque desbloquea todo lo operativo.

**Qué no puede certificarse todavía:**
- El POS real (ventas, cámara, lector, impresión, cortes de red).
- Los roles y la sesión con cuentas reales.
- El despliegue, las cabeceras y la CSP en producción, y el escáner bajo esa CSP.
- La CI en GitHub.
- La desaparición de la imagen C1 de la caché del sitio publicado y de las copias externas.
- El catálogo definitivo y los banners.
- Cualquier afirmación sobre qué hay desplegado.

**Estado de la Fase 0.6:** abierta. Diagnóstico terminado; ningún bloque de ejecución iniciado. La Fase 0.4 y la Etapa 0 **no están cerradas**.

## Actualización del 8 de noviembre de 2026 (Bloque 0)

- **`admin_list_users`:** el responsable **confirmó que la migración fue aplicada**; ya no es una sospecha. No se vuelve a aplicar. Que exista **no significa que esté validada**: la pantalla Usuarios no se probó con un CEO real y la validación de roles reales sigue pendiente.
- **Caché local de imágenes:** se borró `.next/cache/images` con autorización. **No se afirma** que las copias externas ni la caché del sitio publicado estén eliminadas.
- **Git:** las 47 modificaciones, junto con `docs/` y `supabase/`, se respaldaron fuera del repositorio y se consolidaron en un commit local en `etapa-0-estabilizacion` (sin push). Detalle en `estado.md` §1.
- Todo lo demás de este informe (C2 por confirmar, catálogo con 1 producto, pendientes) sigue vigente.

## Actualización del Bloque 1 (8 de noviembre de 2026)

Lo que este informe llamaba «cambios en producción que no figuran en ningún informe» tiene ahora origen confirmado por el usuario: **aplicó él `admin_list_users`, despublicó a mano Termos, Mermelada, Palitos y Bolsas y borró a mano las cuatro fotos**, por la lentitud del borrado mediante Claude Code. Fechas y horas exactas: sin registro. C2 queda como retirada del origen por el usuario. Se conserva el texto original arriba. Ver `informe-bloque-1-conciliacion.md`.
