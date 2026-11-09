# Proyecto de Supabase de prueba: requisitos y pasos

Para validar el punto de venta contra Supabase real **sin tocar producción**. Todo lo de este documento es una lista de requisitos y pasos para quien administra las cuentas: **Claude no creó ningún proyecto, usuario ni conexión**, y no aplica nada en ningún proyecto real sin autorización.

> **Regla de oro:** una venta de prueba es permanente (el historial es de solo agregado y no hay anulación). Por eso las ventas de prueba se hacen **solo** en este proyecto, nunca en producción.

## 1. Crear el proyecto

1. En Supabase, crear un proyecto **nuevo y aparte** (nombre claro, por ejemplo `mundo-del-plastico-PRUEBA`). No reutilizar el de producción ni una copia con datos reales.
2. Anotar en un lugar seguro (no en chats ni en Git) su URL y su clave **pública** (`anon`/publishable). La clave `service_role` no se usa nunca en la aplicación.
3. Authentication → Sign In / Providers: **desactivar el registro público** (igual que en producción). Los usuarios se crean a mano.

## 2. Migraciones (en este orden, una por una)

Archivos de `supabase/migrations/`, pegados y ejecutados en el SQL Editor del proyecto de **prueba**, verificando que cada una termine sin error antes de pasar a la siguiente:

| Orden | Archivo | Qué agrega |
| --- | --- | --- |
| 1 a 5 | `20261028000001` a `…005` | Extensiones, tabla `staff`, categorías, productos, variantes, fotos, vistas públicas, bucket `product-images` |
| 6 a 13 | `20261029000001` a `…008` | Roles, perfiles, auditoría, archivado, funciones `scan_*` |
| 14 | `20261030000001` | Categorías principales y banners |
| 15 | `20261031000001` | **Punto de venta:** stock, medios de pago, ventas, movimientos, `pos_find`, `confirm_sale`, `adjust_stock` |
| 16 | `20261101000001` | Entradas de stock, alta rápida, resúmenes |
| 17 | `20261102000001` | Vistas de la ficha de producto |
| 18 | `20261103000001` | Arte móvil de banners |
| 19 | `20261108000001` | `admin_list_users` (listado de usuarios para el CEO) |
| **20 (último)** | `supabase/pending/20261029000099_close_drop_staff.sql` | **Cierre `close_drop_staff`:** borra `is_staff()` y `staff_legacy`. **Replica el estado de producción** (verificado el 8 de noviembre de 2026). Se aplica **solo al final**, ver abajo |

**Dependencias reales del cierre (paso 20).** Debe ir **después de las 19 migraciones**, no antes:

1. La migración de orden 8 (`20261029000003_assign_initial_ceo`) **necesita** la tabla `staff` con al menos una fila; la de orden 11 (`20261029000006_storage_and_reassign_roles`) renombra `staff` a `staff_legacy` y revoca `is_staff()`. El cierre borra justamente `staff_legacy` e `is_staff()`, así que si se aplicara antes de la 8 o de la 11 **fallaría** (no encontraría `staff_legacy`) o **rompería** la secuencia.
2. La de orden 10 (`20261029000005_catalog_role_policies`) elimina las políticas `staff_all` y la de orden 11 reemplaza las políticas de Storage y `reassign_category_products`: esas son las que dejan **a `is_staff()` sin dependientes**. El cierre ejecuta `drop function public.is_staff()` **sin** `cascade`: si alguna política o función todavía dependiera de ella, **falla** y no cambia nada (es la protección buscada).
3. El script exige además **al menos un CEO activo** en `profiles` (lo da la migración de orden 8, `…29000003`). Antes del cierre, comprobar que el CEO de prueba puede ingresar.
4. Al borrar `staff_legacy` desaparece la fila de `staff` insertada para la migración 8. Es lo esperado: el CEO sigue existiendo como perfil.
5. Es **irreversible** salvo con copia de seguridad (igual que en producción). Por eso se hace **al final** y **después de verificar** la secuencia (sección 3): ya no sirve el script de reversión de roles.
6. Verificación posterior: `select to_regclass('public.staff'), to_regclass('public.staff_legacy'), to_regprocedure('public.is_staff()');` debe devolver **tres vacíos**, igual que producción.

**Atención a un paso intermedio.** La migración `20261029000003_assign_initial_ceo` **aborta si la tabla `staff` está vacía** (convierte lo que haya en `staff` en CEO). En un proyecto nuevo hay que, **antes de ella**: crear el usuario CEO en Authentication → Users y ejecutar `insert into public.staff (user_id) values ('<uuid del usuario CEO>');`. Después se aplican las demás.

> **Actualización del 8 de noviembre de 2026:** en producción el cierre `close_drop_staff` **ya está aplicado** (no existen `staff`, `staff_legacy` ni `is_staff()`; operador y fecha desconocidos). Por eso el paso 20 de la tabla lo incluye al final. Además, producción tiene **una sola cuenta (CEO)** y **no tiene historial de versiones de migraciones**; las cuentas de gerente y empleado de prueba se crean en el proyecto aparte.

**No aplicar** en el proyecto de prueba: `supabase/correcciones/20261103_catalogo_datos.sql` (lleva identificadores de producción). *(Histórico: la versión anterior de este documento, del 4 de noviembre, también prohibía aplicar `supabase/pending/20261029000099_close_drop_staff.sql`; esa prohibición quedó **superada** por el paso 20 de la tabla.)*

Si una migración falla al crear políticas sobre `storage.objects`, el aviso de cada archivo explica cómo crearlas desde el panel de Storage.

## 3. Lo que debe quedar instalado (verificación de solo lectura)

```sql
-- Migraciones registradas (si se aplicaron con el SQL Editor puede no listarlas; se verifica por objetos)
select proname from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('pos_find','confirm_sale','sale_receipt','adjust_stock','receive_stock','scan_create_draft',
                   'low_stock_variants','sales_summary','has_role_at_least','admin_create_profile','admin_list_users')
 order by 1;                                   -- esperado: las 11 funciones

select tablename, rowsecurity from pg_tables
 where schemaname = 'public'
   and tablename in ('products','product_variants','sales','sale_items','stock_movements','payment_methods','profiles','audit_log')
 order by 1;                                   -- esperado: rowsecurity = true en todas

select code, enabled from public.payment_methods order by position;  -- efectivo, transferencia, debito, credito = true; otro = false

select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects';  -- políticas de product-images, banners/ y categories/
select id, public from storage.buckets where id = 'product-images';                         -- bucket público
select has_function_privilege('anon', 'public.confirm_sale(uuid,text,jsonb)', 'execute');   -- esperado: false

-- Tras el cierre (paso 20): igual que producción
select to_regclass('public.staff'), to_regclass('public.staff_legacy'), to_regprocedure('public.is_staff()');  -- esperado: tres vacíos
```

## 4. Usuarios de prueba

| Rol | Cómo se crea | Uso en la prueba |
| --- | --- | --- |
| CEO | Authentication → Users (marcar confirmado) y la fila en `staff` del paso anterior; la migración 3 le asigna el perfil `ceo` | Administra usuarios; ve todas las ventas |
| Gerente | Authentication → Users y, después, desde la pantalla Usuarios del panel (con el CEO) o con `select public.admin_create_profile('<uuid>', 'Gerente de prueba', 'gerente');` | Carga stock y ajustes; ve todas las ventas y movimientos |
| Empleado | Igual, con rol `empleado` | Vende; ve solo sus ventas |

Contraseñas: las define y guarda quien administra; **no se comparten por chat**. Usar correos que se reconozcan como de prueba.

## 5. Productos y stock de prueba

Archivo: `supabase/seed-prueba/seed_proyecto_prueba.sql` (probado con PGlite en `supabase/tests/seed-prueba.test.mjs`). Cinco productos «[PRUEBA] …» con código EAN-13 válido, para cubrir los casos del protocolo físico:

| Producto | Código | Variantes y stock |
| --- | --- | --- |
| [PRUEBA] Balde 10 litros | 7799000000013 | 1 variante, $1.000, stock 20 |
| [PRUEBA] Remera lisa | 7799000000020 | M azul $2.500 stock 10; L azul $2.600 stock 3 |
| [PRUEBA] Producto agotado | 7799000000037 | $800, stock 0 |
| [PRUEBA] Producto sin precio | 7799000000044 | sin precio, stock 9 |
| [PRUEBA] Producto archivado | 7799000000051 | $700, stock 9, archivado |

Cómo correrla: en el SQL Editor **del proyecto de prueba**, pegar primero `set app.confirmo_proyecto_de_prueba = 'si';` y después el contenido del archivo, en la misma ejecución. La semilla **se niega** si no se confirma, si la base tiene productos que no sean de prueba (parece producción) o si ya hay ventas. No crea usuarios.

Para imprimir códigos de barras y probar con cámara o lector, se pueden mostrar esos números como código EAN-13 en pantalla o impresos (el protocolo lo detalla). Las fotos no son necesarias para vender (el catálogo público solo muestra productos con foto).

## 6. Conectar la aplicación local al proyecto de prueba

1. En la carpeta del proyecto crear `.env.local` (no versionado, tiene prioridad sobre `.env`) con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` **del proyecto de prueba**. Conservar `ALLOWED_DEV_ORIGINS` si se usa el celular.
2. Reiniciar `npm run dev`. **Comprobar** que se está en la prueba: el catálogo y el panel deben mostrar datos de prueba, no los reales.
3. **Cuidado:** `.env` (versionado) tiene las claves de **producción**. Si falta `.env.local`, o se borra, la aplicación vuelve a apuntar a producción. Antes de cualquier venta de prueba, confirmar la URL del proyecto activo.
4. Para probar desde el celular con HTTPS (necesario para la cámara) ver `historico/demo-escaner-celular.md` (túnel o dirección de confianza). Si se usa un túnel, cerrarlo al terminar.
5. No apuntar un despliegue de Vercel (ni vista previa) al proyecto de prueba salvo decisión expresa; si se hace, que sea un proyecto de Vercel aparte.

## 7. Después de la prueba

- Anotar el resultado en el registro del protocolo.
- Si hay que repetir, lo más simple es **crear otro proyecto de prueba** (la semilla se niega cuando ya hay ventas, a propósito).
- Pausar o borrar el proyecto de prueba cuando ya no se use.

## 8. Qué no cubre

El proyecto de prueba valida Auth, PostgREST, Storage y el comportamiento de las funciones sobre la plataforma real. No valida Vercel, el dominio, ni la CI de GitHub.
