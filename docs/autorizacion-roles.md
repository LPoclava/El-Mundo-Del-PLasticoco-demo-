# Autorización por roles y auditoría

Estado: **aplicado en la base de producción**: las ocho migraciones de roles y auditoría **y el cierre `close_drop_staff`**. **Verificado el 8 de noviembre de 2026 (diagnóstico con el conector de Supabase, solo lectura): `public.staff`, `public.staff_legacy` y `public.is_staff()` no existen.** Quién aplicó el cierre y cuándo: **desconocidos** (sin registro; ver [estado.md](estado.md) §1 y §2). Versiones anteriores de este documento daban el cierre por pendiente; esas frases se conservan más abajo, marcadas, por trazabilidad. Reemplaza el modelo de `public.staff`
(todos con los mismos permisos) por tres roles jerárquicos: `empleado < gerente < ceo`.

## 1. Modelo de datos

| Objeto | Qué es |
|---|---|
| `public.app_role` | Enum `empleado`, `gerente`, `ceo` (el orden define la jerarquía). |
| `public.profiles` | Un perfil por persona: `user_id` (PK y FK a `auth.users`, `on delete restrict`), `display_name`, `role`, `active`, `created_at`, `updated_at`, `created_by`. El correo no se duplica: vive en `auth.users`. |
| `public.audit_log` | Auditoría de solo agregado (ver sección 5). |
| `products.archived_at` | Archivado, independiente de `publish_enabled`. |
| `current_app_role()`, `has_role_at_least(rol)` | Funciones `security definer` con `search_path` fijo. Leen el rol **solo** de `profiles`; devuelven vacío/falso si no hay perfil o está inactivo. Nunca usan el token ni `user_metadata`. |

## 2. Matriz de permisos

| Operación | Empleado | Gerente | CEO |
|---|---|---|---|
| Consultar producto y precio por código (incluye no publicados) | Sí, `scan_lookup` | Sí | Sí |
| Cambiar precio de una variante | Sí, `scan_set_price` | Sí | Sí |
| Vincular o corregir código de barras | Sí, `scan_link_barcode` | Sí | Sí |
| Crear producto desde el escáner (sin publicar, sin fotos) | Sí, `scan_create_product` | Sí | Sí |
| Leer productos/variantes/imágenes directamente | No | Sí | Sí |
| Leer categorías | Sí | Sí | Sí |
| Crear, editar, archivar, despublicar productos y variantes | No | Sí | Sí |
| Gestionar categorías (incluye `reassign_category_products`) | No | Sí | Sí |
| Subir, actualizar y borrar imágenes (Storage, solo `products/`) | No | Sí | Sí |
| CRM e informes | No | Sí | Sí — **aún no existen**; usarán `has_role_at_least('gerente')` |
| Auditoría | Solo la propia | Catálogo, de todo el equipo | Toda |
| Ver perfiles | Solo el propio | Todos (solo lectura) | Todos |
| Crear, activar, desactivar usuarios; cambiar roles | No | No | Sí, nunca sobre sí mismo |
| Configuración general | — | — | **No existe todavía** |

El empleado no tiene ningún permiso directo sobre las tablas del catálogo: RLS actúa por fila y no
por columna, así que "cambiar solo precio o código" se implementa con funciones que tocan únicamente
ese campo.

## 3. Migraciones de roles (en `supabase/migrations/`, aplicadas)

| N.º | Archivo | Propósito |
|---|---|---|
| 1 | `20261029000001_roles_and_profiles` | Tipo, tabla `profiles`, funciones de rol, RLS de perfiles. Solo agrega. |
| 2 | `20261029000002_profile_protection` | Trigger `profiles_guard` (sin autoascenso, último CEO intocable) y funciones `admin_*`. |
| 3 | `20261029000003_assign_initial_ceo` | Pasa lo que haya en `staff` a `ceo`. Aborta si `staff` está vacía o no queda un CEO activo. |
| 4 | `20261029000004_audit_log` | `audit_log`, triggers en 5 tablas, inmutabilidad, lectura por rol. |
| 5 | `20261029000005_catalog_role_policies` | Políticas del catálogo por rol y borrado de `staff_all` en la misma transacción. |
| 6 | `20261029000006_storage_and_reassign_roles` | Storage y `reassign_category_products` por rol; `staff` pasa a `staff_legacy`. |
| 7 | `20261029000007_archive_products` | `archived_at` y vista `public_catalog` sin archivados (mismas columnas). |
| 8 | `20261029000008_barcode_scan_functions` | `scan_lookup`, `scan_set_price`, `scan_link_barcode`, `scan_create_product`. |

Fuera de la carpeta, a propósito: `supabase/pending/20261029000099_close_drop_staff.sql` (borra
`is_staff()` y `staff_legacy`; ~~**no aplicar ahora**~~ **ya aplicado en producción, comprobado el 8 de noviembre de 2026; operador y fecha desconocidos; no volver a aplicarlo**) y `supabase/rollback/20261029_rollback_roles.sql` (**ya no puede ejecutarse**: se niega sin `staff_legacy`).

Las migraciones históricas (`20261028…`) no se tocaron.

### Acceso de desarrollo (Etapa 1)

Aparte de los roles del comercio, existe `developer_access`: el grupo de desarrollo de AImpulse Tech. **No se deriva del rol** (un CEO del comercio no es de desarrollo). Se da de alta y de baja solo a mano en el SQL Editor. Hoy solo gobierna el circuito fiscal (ver [comprobantes.md](comprobantes.md)).

## 4. Seguridad: cómo se aplica

- **En la base, no en la interfaz.** Todo lo anterior son políticas RLS, permisos de tabla y funciones.
- **Sin autoascenso:** ningún rol puede escribir `profiles` por la API (sin permiso de `UPDATE`/`INSERT`/`DELETE`).
  Los cambios pasan por `admin_*`, que exigen ser CEO, y el trigger lo vuelve a comprobar y prohíbe
  cambiar el propio rol o estado. Cubierto por pruebas, incluso concediendo permiso de tabla por error.
- **Último CEO:** el trigger usa un candado (`pg_advisory_xact_lock`) para que dos cambios simultáneos
  no dejen cero CEO. Vale también para cambios hechos desde el SQL Editor.
- **Funciones `security definer`:** `search_path` fijo, nombres calificados, ejecución revocada a
  `public` y `anon`, validación interna del rol. Las auxiliares internas no son invocables desde la API.
- **Políticas permisivas se combinan con OR**, no con intersección. Por eso `staff_all` se borra en la
  misma migración que crea las nuevas (5); si no, una cuenta en `staff` e inactiva en `profiles` seguiría
  con acceso total. Hay una prueba que lo demuestra.
- **Registro público de Auth:** la evidencia disponible (consulta anónima anterior) indicaba
  `disable_signup: false`. **No se pudo comprobar su estado actual.** Con este modelo, una cuenta sin
  perfil no accede a nada protegido, pero igualmente conviene desactivar el registro público en
  Supabase (Authentication → Sign In / Providers).

## 5. Auditoría y sus límites

Registra, para `categories`, `products`, `product_variants`, `product_images` y `profiles`:
fecha, `actor_id`, `actor_role` (rol en ese momento), tabla, fila, operación, valores anteriores y
nuevos, campos cambiados, `source` (`api`/`sql`) y `via` (función que originó el cambio).

Límites:
- **No registra lecturas** (por ejemplo, quién consultó un precio).
- **Storage:** no hay triggers sobre archivos. Queda registrada la fila de `product_images`, no el
  archivo subido, reemplazado o borrado en el bucket.
- **SQL Editor y migraciones:** el cambio se registra con `actor_id` vacío y `source = 'sql'`; no
  identifica a la persona. Un superusuario puede desactivar triggers a propósito.
- **La asignación inicial del CEO (migración 3) no queda auditada**: la auditoría se crea después.
- `via` es informativo (lo fija la función); no es una prueba de origen.
- Las actualizaciones sin cambios reales no generan registro.
- La tabla crece sin límite; falta definir retención.

## 6. Dependencias antiguas

| Referencia | Estado |
|---|---|
| `staff_all` en 4 tablas (migración 3 histórica) | Reemplazadas en la migración 5 |
| Políticas de Storage `personal ...` (migración 5 histórica) | Reemplazadas en la migración 6 |
| `reassign_category_products()` | Reescrita en la migración 6 (misma firma) |
| `public.staff` | Renombrada a `staff_legacy` en la migración 6 y **eliminada** después por el cierre: **no existe** (comprobado el 8 de noviembre de 2026) |
| `public.is_staff()` | Sin dependientes; ejecución revocada; **eliminada** por el cierre: **no existe** (comprobado el 8 de noviembre de 2026). 0 políticas dependen de ella |
| Código de la app (`src/`) | Sin referencias a `is_staff()` ni a `staff_legacy` (comprobado el 4 de noviembre de 2026). El panel lee el rol de `profiles` |

## 7. Orden de aplicación (histórico: las migraciones 1 a 8 ya están aplicadas)

~~Solo el paso 6 sigue pendiente (cierre de `pending/`)~~ **Corrección del 8 de noviembre de 2026: el paso 6 también está aplicado en producción** (operador y fecha desconocidos). Esta sección se conserva como guía para rearmar la base en otro proyecto; para replicar producción, un proyecto nuevo debe terminar **sin** `staff`, `staff_legacy` ni `is_staff()`.

1. Copia de seguridad o punto de restauración. Anotar quién está en `staff`.
2. Comprobar con solo lectura el estado real (ver sección 8) y que coincida con las migraciones 1 a 5.
3. Aplicar las migraciones 1 a 8 **una por una**, verificando tras cada una que la cuenta corporativa
   siga entrando al catálogo.
4. Desactivar el registro público de Auth.
5. Correr las verificaciones de la sección 8 contra producción.
6. Esperar un período de uso y recién entonces, con aprobación, aplicar el cierre de `pending/`. *(En producción ya se aplicó; ver la nota de arriba.)*

Si las políticas de `storage.objects` no se pueden modificar desde una migración (mismo riesgo que
tuvo la migración 5 histórica), la migración 6 fallará por completo y no cambiará nada; en ese caso
crear las cuatro políticas `gerente ...` desde el panel de Storage y borrar las cuatro `personal ...`.

## 8. Verificaciones que requieren acceso a producción

Solo lectura, en el SQL Editor:

```sql
-- La cuenta corporativa y su rol
select p.user_id, u.email, p.role, p.active from public.profiles p join auth.users u on u.id = p.user_id;
-- Nada debería depender ya de is_staff()
select schemaname, tablename, policyname from pg_policies where qual ilike '%is_staff%' or with_check ilike '%is_staff%';
-- Políticas de Storage vigentes
select policyname, cmd, roles from pg_policies where schemaname = 'storage' and tablename = 'objects';
-- Migraciones registradas
select version from supabase_migrations.schema_migrations order by version;
```

También: confirmar el estado del registro público en Auth y probar con un usuario de cada rol desde
la aplicación real, no solo desde las pruebas.

**Resultado de estas verificaciones el 8 de noviembre de 2026** (conector de Supabase, solo lectura; detalle en [informe-bloque-2-diagnostico-conector.md](informe-bloque-2-diagnostico-conector.md)):
- La consulta de migraciones registradas **no funciona**: `supabase_migrations.schema_migrations` no existe y `list_migrations` no devolvió registros. No hay historial de versiones; los objetos de las 19 migraciones sí están presentes.
- Ninguna política depende de `is_staff` (0 filas). `staff`, `staff_legacy` e `is_staff()` no existen.
- Perfiles: **una sola cuenta, CEO activo**. No hay gerente ni empleado: las pruebas con esos roles siguen **pendientes**.
- RLS activa en las 11 tablas; 22 políticas, todas para `authenticated`; sin políticas de escritura sobre `profiles`, `sales`, `sale_items`, `stock_movements` ni `audit_log`.
- Sin funciones `security definer` sin `search_path` fijo; las funciones críticas no las ejecuta `anon`. Siete funciones de disparador o utilidad sí son ejecutables por `anon` (riesgo bajo).
- Storage: bucket público y 8 políticas de gerente; sin las «personal …».
- El registro público de Auth figura **cerrado** (observado por consulta pública).

## 9. Reversión

`supabase/rollback/20261029_rollback_roles.sql` (probado contra PostgreSQL en las pruebas):

- Restaura primero `staff`, `is_staff()` y las políticas viejas, y recién después quita las nuevas:
  el acceso de la cuenta corporativa no se interrumpe.
- **No borra** productos, categorías, variantes, imágenes ni usuarios de Auth.
- Por defecto **conserva** `profiles`, `audit_log` y `archived_at`; el borrado total está comentado al
  final del script y destruye la auditoría acumulada.
- Se niega a ejecutarse si `staff_legacy` no existe o está vacía. **Hoy `staff_legacy` no existe en producción (8 de noviembre de 2026): el script no se puede usar** y la única reversión es una copia de seguridad.
- Límites: los gerentes y empleados pierden acceso al volver al modelo viejo (solo conoce `staff`);
  los productos creados desde el escáner quedan sin publicar y se conservan; si ya se aplicó el cierre
  de `pending/`, solo sirve restaurar la copia de seguridad.
- Cada migración es aditiva hasta la 5; hasta ese punto basta con borrar lo nuevo. A partir de la 5 usar el script.

## 10. Pruebas

`cd supabase/tests && npm install && npm test`. Corren las migraciones reales sobre PostgreSQL
(PGlite, en memoria) con roles `anon`/`authenticated`, claims JWT y RLS reales. Simulan lo propio de
Supabase (`auth.users`, `auth.uid()`, `storage.objects`); no se conectan a Supabase.

Límites: PGlite tiene una sola conexión, así que **la concurrencia real no se prueba**. Los
duplicados se rechazan por el índice único y el candado por código, pero no se ejecutó con dos
sesiones simultáneas. Para comprobarlo, en un Postgres real abrir dos sesiones, iniciar una
transacción en cada una y llamar a `scan_create_product` con el mismo código: la segunda debe
esperar y luego fallar con `23505`. Tampoco se probó el comportamiento propio de Supabase (PostgREST,
Storage API, Auth).
