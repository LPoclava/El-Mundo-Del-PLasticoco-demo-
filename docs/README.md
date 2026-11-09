# Documentación: El Mundo del Plástico

Esta carpeta **no está en Git** (decisión del commit `c6fd133`, ver `decisiones.md`). Vive solo en la carpeta del proyecto. Si se mueve el proyecto o se cambia de computadora, copiar también `docs/`, `supabase/` y `Logo/`.

## Por dónde empezar

| Necesito saber | Documento |
| --- | --- |
| Qué está aplicado en Supabase, qué parte del panel es real, qué falta | [estado.md](estado.md) |
| Por qué se decidió algo (diseño, datos, permisos, proceso) | [decisiones.md](decisiones.md) |

## Documentos por tema (vigentes)

| Tema | Documento |
| --- | --- |
| Esquema del catálogo, seguridad y regla de publicación | [modelo-de-datos.md](modelo-de-datos.md) |
| Roles, permisos, auditoría y reversión | [autorizacion-roles.md](autorizacion-roles.md) |
| Punto de venta, stock y ventas atómicas | [pos-ventas.md](pos-ventas.md) |
| Categorías principales, carrusel y banners | [promociones-y-banners.md](promociones-y-banners.md) |
| Panel de productos conectado a Supabase | [gestion-de-productos.md](gestion-de-productos.md) |
| Auditoría del circuito de venta: componentes, tablas, atomicidad, permisos y comprobantes | [auditoria-pos-fase-0-4.md](auditoria-pos-fase-0-4.md) |
| Ventas con resultado incierto: cómo se recuperan sin duplicar (corrección de H1) | [recuperacion-de-ventas-pendientes.md](recuperacion-de-ventas-pendientes.md) |
| Auditoría del material comercial: fotos, banners, datos de productos y marca (fase 0.5) | [auditoria-material-comercial-fase-0-5.md](auditoria-material-comercial-fase-0-5.md) |
| Despliegue, variables de entorno, cabeceras de seguridad (CSP), SEO técnico y CI; pasos manuales en Vercel y GitHub | [despliegue.md](despliegue.md) |

## Validación

| Para qué | Documento |
| --- | --- |
| Comprobar con cuentas reales (empleado, gerente, CEO), sesiones y desactivación; lo ejecuta el responsable | [protocolo-validacion-cuentas.md](protocolo-validacion-cuentas.md) |
| Probar el punto de venta con celular, cámara, lector, impresión y las tres cuentas; lo ejecuta el responsable | [protocolo-prueba-fisica-pos.md](protocolo-prueba-fisica-pos.md) |
| Requisitos y pasos para armar el proyecto de Supabase de **prueba** (migraciones, usuarios, semilla) | [proyecto-supabase-de-prueba.md](proyecto-supabase-de-prueba.md) |

## Histórico (fotos de un día; no mandan)

Cada archivo dice su fecha. Si contradicen a los documentos de arriba, valen los de arriba y `estado.md`.

| Documento | Qué es |
| --- | --- |
| [historico/informe-rediseno-integral.md](historico/informe-rediseno-integral.md) | Informe del rediseño del catálogo, 2 de noviembre de 2026 |
| [historico/informe-intervencion-final.md](historico/informe-intervencion-final.md) | Informe de la intervención de calidad, 4 de noviembre de 2026 |
| [historico/auditoria-fase-0-2.md](historico/auditoria-fase-0-2.md) | Auditoría de rutas, sesiones, `@supabase/ssr` y de la migración `admin_list_users`, 8 de noviembre de 2026 |
| [historico/demo-escaner-celular.md](historico/demo-escaner-celular.md) | Cómo probar la cámara del escáner en un celular (etapa de demostración; sigue sirviendo para HTTPS y permisos) |
| [informe-apertura-fase-0-6.md](informe-apertura-fase-0-6.md) | Diagnóstico de apertura de la fase 0.6, 8 de noviembre de 2026 (con notas de actualización) |
| [informe-bloque-1-conciliacion.md](informe-bloque-1-conciliacion.md) | Bloque 1 de la fase 0.6: conciliación con producción, bitácora de operaciones manuales y estado de C1 y C2, 8 de noviembre de 2026 |
| [informe-bloque-2-entorno-prueba.md](informe-bloque-2-entorno-prueba.md) | Bloque 2 de la fase 0.6: diagnóstico y plan del entorno de Supabase de prueba, matriz de permisos y casos de validación de roles, 8 de noviembre de 2026 |
| [protocolo-bloque-2-lectura-produccion.md](protocolo-bloque-2-lectura-produccion.md) | Bloque 2: validación de roles de solo lectura en producción (sesión CEO, gerente y empleado, consultas SQL) |
| [informe-bloque-2-diagnostico-supabase-existente.md](informe-bloque-2-diagnostico-supabase-existente.md) | Bloque 2: diagnóstico sobre el Supabase existente, pruebas anónimas y estado de la validación |
| [informe-bloque-2-diagnostico-conector.md](informe-bloque-2-diagnostico-conector.md) | Bloque 2: diagnóstico de producción con el conector de Supabase (solo lectura): `staff` ausente, sin registro de versiones, una sola cuenta |
| [informe-bloque-b-validacion-funcional.md](informe-bloque-b-validacion-funcional.md) | Etapa 0, Bloque B: privilegios de tabla (Q9), políticas de Storage, permisos del CEO contra la documentación, S1 y S11 sin sesión y criterios pendientes para cerrar la etapa |
| [registro-respaldo-limpieza.md](registro-respaldo-limpieza.md) | Registro del respaldo previo a la limpieza de producción: ruta, SHA-256, contenido y verificación, 9 de noviembre de 2026 |
| [informe-final-etapa-0.md](informe-final-etapa-0.md) | **Informe final de la Etapa 0**: resumen, estado inicial y final, limpieza S2 (preparada, a la espera de la confirmación final), respaldo, arquitectura, seguridad, pruebas, riesgos, pendientes externos y checklist, 9 de noviembre de 2026 |
| [plan-limpieza-produccion.md](plan-limpieza-produccion.md) | Preparación (sin ejecutar) de la limpieza de datos de prueba en producción: inventario, respaldo, SQL, recuperación y criterios, 9 de noviembre de 2026 |

`capturas/` guarda las imágenes que citan los informes (esa carpeta no está en Git).

## Reglas para mantener esto vivo

- Un hecho de producción (qué se aplicó, quién lo confirmó, cuándo) va en `estado.md`, no en el documento del tema.
- Una decisión con motivo va en `decisiones.md`, con fecha.
- Un documento por tema dice solo lo **vigente**. Lo que quedó reemplazado se anota una vez, como historial, y no se deja en el cuerpo.
- Un informe de cierre de trabajo va a `historico/` con su fecha en la primera línea.
