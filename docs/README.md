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

`capturas/` guarda las imágenes que citan los informes.

## Reglas para mantener esto vivo

- Un hecho de producción (qué se aplicó, quién lo confirmó, cuándo) va en `estado.md`, no en el documento del tema.
- Una decisión con motivo va en `decisiones.md`, con fecha.
- Un documento por tema dice solo lo **vigente**. Lo que quedó reemplazado se anota una vez, como historial, y no se deja en el cuerpo.
- Un informe de cierre de trabajo va a `historico/` con su fecha en la primera línea.
