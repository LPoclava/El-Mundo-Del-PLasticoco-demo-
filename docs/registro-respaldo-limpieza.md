# Registro del respaldo previo a la limpieza de producción

Fecha: 9 de noviembre de 2026. Proyecto de Supabase: `nogufedcmkjphiqyyriz` (producción). Generado por Claude Code con el conector de Supabase en **solo lectura**. Ninguna contraseña ni clave se imprimió ni se guardó.

## 1. Dónde está

| Dato | Valor |
| --- | --- |
| Carpeta | `C:\Users\lauty\Respaldos-AImpulse\limpieza_2026-11-09\` (fuera del repositorio y fuera de OneDrive) |
| Archivo comprimido | `C:\Users\lauty\Respaldos-AImpulse\mundo-del-plastico_limpieza_respaldo_2026-11-09.tar.gz` |
| Tamaño | 101.365 bytes |
| **SHA-256 del archivo** | `f8fedd8b2cff164d6912db9237612df0118f6e65492a36f4ea2bfc1fcf173880` |
| Hash del archivo comprimido, en | `mundo-del-plastico_limpieza_respaldo_2026-11-09.tar.gz.sha256` |
| Hash de cada archivo interno | `limpieza_2026-11-09\manifiesto.sha256` (10 archivos) |
| Subida externa | Ninguna |

## 2. Qué contiene

| Archivo | Contenido |
| --- | --- |
| `datos_tablas.json` | `categories`, `payment_methods`, `profiles`, `products`, `product_variants`, `product_images`, `promo_banners`, `sales`, `sale_items`, `stock_movements` (sin las columnas generadas, que se recalculan) |
| `audit_log_001_028.json` a `audit_log_085_111.json` | El `audit_log` completo: 111 filas |
| `auth_storage_config.json` | La cuenta de Auth **sin secretos** (id, correo, fechas, metadatos), la configuración del bucket, los metadatos de los 2 objetos de Storage, las extensiones y la versión de PostgreSQL |
| `storage/cuchillos_e146a9eb.webp` | Foto de «Juego de Cuchillos» (9.152 bytes). SHA-256 `410ebbfd1fc70f98fc138fdc77262c2c917f80ede7b5ba7517c2aa77baf1d583` |
| `storage/huerfano_categories_b9cde881.webp` | Archivo huérfano (79.308 bytes). SHA-256 `d0ce10e0d2e85d134b75511e5c926dc4285e623539decfc045c7546f37136e4d` |
| `huellas_produccion.txt` | Huella (conteos y MD5) de las 11 tablas y de las 13 categorías de estructura |
| `LEEME.txt` | Descripción y cómo restaurar |
| `manifiesto.sha256` | SHA-256 de cada archivo |

Los archivos de Storage se descargaron del bucket público (ya eran accesibles públicamente). **No se abrieron ni se vieron.** Se comprobó solo su tamaño (coincide con los metadatos) y que empiezan con la cabecera `RIFF…WEBP`.

## 3. Qué NO contiene y por qué

| Falta | Motivo | Cómo se cubre |
| --- | --- | --- |
| **La estructura como DDL (un `pg_dump`)** | **Bloqueo identificado:** el entorno no tiene `pg_dump`, ni `psql`, ni la CLI de Supabase, ni la contraseña de la base (no hay variables de entorno con credenciales y no se piden por chat) | La estructura se reconstruye con las **19 migraciones + el cierre** (versionadas en Git). **Se demostró que reproduce producción:** las 13 categorías de la huella de estructura (funciones, políticas, triggers, columnas, índices, restricciones, RLS, permisos, vistas, enums, Storage) salen **idénticas** |
| El hash de la contraseña de Auth y los tokens | Seguridad: no se exportan secretos | Si hiciera falta restaurar Auth, se restablece la contraseña. La limpieza no toca `auth.users` |
| La configuración del panel de Authentication de Supabase | No está en la base | Consulta pública `GET /auth/v1/settings` (9 nov: registro cerrado, solo correo) |
| Un respaldo gestionado por la plataforma | No tengo acceso al panel de Supabase | **Pendiente (opcional):** confirmar si el plan incluye copias diarias o PITR |

Esta es una **copia lógica**, no un volcado físico: reproduce los datos y la estructura, y se verificó, pero un `pg_dump` completo sigue siendo recomendable cuando el usuario pueda correrlo con su contraseña (comando en `plan-limpieza-produccion.md` §4.2).

## 4. Verificación (todo ejecutado el 9 de noviembre de 2026)

| Verificación | Resultado |
| --- | --- |
| Integridad del archivo (`gzip -t`) | OK |
| SHA-256 recomputable (`sha256sum -c`) | OK |
| Contenido legible (`tar -tzf`) | 11 entradas, sin errores |
| Extraer en una carpeta temporal y comparar con el manifiesto | **0 archivos distintos** |
| Restaurar **desde la copia extraída** en una base temporal (PGlite en memoria) | Ver abajo |
| Huellas de datos: producción contra restaurado | **11 de 11 tablas idénticas** (conteo y MD5 del contenido ordenado), incluido el `audit_log` completo |
| Huellas de estructura: producción contra restaurado | **13 de 13 categorías idénticas** |

Nota técnica de la comparación de índices: `pg_indexes` muestra el prefijo `extensions.` de `gin_trgm_ops` según el `search_path` de quien consulta; la huella lo ignora. Es una diferencia de presentación, no de contenido (la extensión `pg_trgm` está en el esquema `extensions` en producción).

## 4 bis. Cómo recuperar desde este respaldo

`node supabase/limpieza/generar_restauracion.mjs` genera, a partir de `datos_tablas.json`, el SQL que devuelve a `public` los productos, variantes, fotos, ventas, detalles y movimientos (termina en `rollback`; para aplicarlo hace falta aprobación explícita). Se probó sobre la copia restaurada: las 9 tablas vuelven con la **misma huella** que producción. El archivo generado contiene los datos de prueba y se escribe en la carpeta del respaldo, fuera del repositorio.

## 5. Cómo repetir la verificación

```bash
cd supabase/tests && node limpieza-restauracion.mjs "C:/Users/lauty/Respaldos-AImpulse/limpieza_2026-11-09"
```

Debe terminar con: `Datos: 11/11 tablas idénticas. Estructura: 13/13 categorías idénticas.`

```bash
cd C:/Users/lauty/Respaldos-AImpulse && sha256sum -c mundo-del-plastico_limpieza_respaldo_2026-11-09.tar.gz.sha256
```
