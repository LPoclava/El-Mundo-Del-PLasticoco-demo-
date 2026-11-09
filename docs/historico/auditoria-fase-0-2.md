> **Histórico, foto del 8 de noviembre de 2026 (Etapa 0, cierre de la fase 0.2). No manda:** el estado vigente está en [../estado.md](../estado.md).

# Auditoría de cierre de la fase 0.2: rutas, sesiones y migración de Usuarios

Rama local `etapa-0-estabilizacion`. Nada se subió a GitHub, se desplegó ni se aplicó en Supabase.

## 1. Protección de rutas y operaciones

### Arquitectura actual

- **No hay código de servidor propio.** Cero Server Actions, cero Route Handlers, ni `proxy.ts` ni `middleware.ts`.
- Todas las pantallas de `/panel/*` son **HTML estático** (`○` en el build). Es público y no contiene datos: solo el marco y un cargador.
- La sesión es de Supabase Auth, guardada en el navegador (`localStorage`, clave `mp-panel-auth`). `AuthProvider` lee la sesión con `getSession()` (lectura local, sin validar en servidor) y el perfil de `public.profiles`.
- Todos los datos viajan del navegador a Supabase con el token del usuario (clave pública). Quien decide es PostgreSQL.

### Qué depende solo del frontend (comodidad, no seguridad)

| Mecanismo | Qué hace | Qué pasa si alguien lo salta |
| --- | --- | --- |
| Redirección a `/panel/login` sin sesión | Evita ver el marco vacío | Se ve el marco y un cargador, sin datos |
| Menú por rol (`menuGroups`) | Oculta secciones | Nada: la base rechaza igualmente |
| `RoleGuard`, `SupabaseGate` | Muestran «Sección fuera de tu perfil» | Nada: la base rechaza igualmente |
| Botones deshabilitados en Usuarios (`canManage`) | Evitan ofrecer lo que la base va a rechazar | Nada: `profiles_guard` y `admin_*` lo rechazan |
| Estado «forbidden» del `AuthProvider` | Bloquea la pantalla de quien no tiene perfil activo | Nada: sin perfil activo la base no concede nada |

Alterar el estado de React en el navegador **no concede ningún permiso**: el rol efectivo lo calcula la base en cada consulta con `current_app_role()` (lee `profiles`, exige `active`). Una prueba automática confirma que un rol falso en el token (`user_metadata`, `app_metadata` o claims propios) no sirve.

### Qué protege Supabase (en cada operación)

| Operación del panel | Protección | Rol mínimo |
| --- | --- | --- |
| Leer/escribir productos, variantes, fotos | RLS `gerente_all` | gerente |
| Leer categorías | RLS `categories_read` | empleado |
| Escribir categorías, reordenar, eliminar con reasignación | RLS + `reorder_main_categories`, `delete_category_safe`, `reassign_category_products` (`has_role_at_least`) | gerente |
| Banners | RLS `promo_banners_manage` + `reorder_promo_banners` | gerente |
| Fotos en Storage (`products/`, `banners/`, `categories/`) | Políticas de `storage.objects` | gerente |
| Buscar productos para vender | `pos_find` (`scan_require_employee`) | empleado |
| Confirmar una venta | `confirm_sale` (`scan_require_employee`, transacción, idempotencia) | empleado |
| Ver ventas | RLS `sales_read_own` / `sales_read_all` | empleado (las propias) / gerente (todas) |
| Resúmenes del inicio | `sales_summary` (`security invoker`: aplica la RLS de `sales`) | empleado (propias) / gerente (todas) |
| Stock bajo, entradas y ajustes | `low_stock_variants`, `receive_stock`, `adjust_stock` (`has_role_at_least`) | gerente |
| Alta rápida de producto | `scan_create_draft` (`scan_require_employee`) | empleado |
| Leer perfiles | RLS `profiles_read_own` / `profiles_read_managers` | empleado (el propio) / gerente |
| Cambiar roles, estado, nombre, dar acceso | `admin_*` + trigger `profiles_guard` | CEO |
| Listar usuarios con correo | `admin_list_users` (migración preparada) | CEO |
| Auditoría | RLS `audit_read_*` | empleado (propia) / gerente / CEO |

Todas las tablas del panel tienen RLS activado y `anon` sin acceso (comprobado en producción con la clave pública el 8 de noviembre de 2026: 401 en las 10 tablas probadas). Todas las funciones `security definer` fijan `search_path` y tienen la ejecución revocada a `public` y `anon`.

### Riesgos concretos

| # | Riesgo | Gravedad | Detalle |
| --- | --- | --- | --- |
| 1 | El marco y el JavaScript del panel son públicos | Baja | Revelan la estructura del panel, no datos ni secretos. La clave `anon` ya es pública por diseño. |
| 2 | Token en `localStorage`: un XSS lo podría leer | Media | Se mitiga con una CSP estricta (fase 0.3). SSR con `@supabase/ssr` **no lo mejora**: el cliente del navegador necesita cookies legibles por JavaScript (sin `HttpOnly`). |
| 3 | La pantalla tarda en enterarse de que una cuenta se desactivó | Baja | La base rechaza las operaciones al instante (`has_role_at_least` exige `active`). La interfaz se actualiza al recargar o en el próximo refresco del token (hasta ~1 hora) y muestra errores de permiso mientras tanto. Mejora barata: reevaluar la sesión al volver a la pestaña. |
| 4 | `getSession()` no valida el token en el servidor | Informativo | Un token falsificado en el navegador no sirve: PostgREST verifica la firma en cada consulta. |
| 5 | Sin límite propio de intentos de ingreso | Baja | Supabase Auth aplica el suyo; el panel traduce el error 429. |
| 6 | Un empleado ve el marco de `/panel/usuarios` | Informativo | Ve «Sección fuera de tu perfil»; nada más. |

No se encontró ningún riesgo explotable en la capa de rutas: las rutas no custodian datos.

## 2. Recomendación sobre `@supabase/ssr`

**No incorporarlo ahora.** Fundamento:

1. **No agrega autorización.** La barrera real son RLS y las funciones, que ya cubren todas las operaciones. SSR solo movería a un proxy la redirección que hoy hace el navegador.
2. **No hay datos privados renderizados en el servidor.** Todas las pantallas del panel son estáticas y buscan sus datos desde el navegador. SSR sirve cuando el servidor lee datos del usuario (Server Components, Server Actions), y hoy no existen.
3. **No mejora la protección del token** (riesgo 2): el cliente del navegador seguiría guardándolo en cookies accesibles a JavaScript.
4. **Riesgo operativo sobre el POS.** Cambiar dónde vive la sesión puede cerrarla a los empleados en plena venta, y la venta armada vive en `sessionStorage`.
5. **Next 16 lo desaconseja como única barrera:** la propia documentación de `proxy` pide verificar la autorización cerca de los datos, no solo en el proxy.

### Cuándo sí convendría

- Si el panel pasa a mostrar **datos privados renderizados en el servidor** (informes, CRM nuevo, exportaciones) o a usar **Server Actions** con permisos del usuario.
- Si se quiere **no servir el marco del panel** a quien no tiene sesión (hoy es público).

### Qué cambiaría

| Pieza | Hoy | Con SSR |
| --- | --- | --- |
| Almacén de la sesión | `localStorage` (`mp-panel-auth`) | Cookies (`createBrowserClient`) |
| Cliente del navegador | `createClient` de `supabase-js` | `createBrowserClient` de `@supabase/ssr` |
| Redirección sin sesión | En el navegador, tras cargar | `proxy.ts` (Node.js) antes de servir la página |
| Refresco del token | Solo en el navegador | Navegador y proxy; hay que cuidar que no compitan |
| Dependencia nueva | — | `@supabase/ssr` 0.12.x (compatible con el `supabase-js` 2.118 instalado) |
| `auth-provider.tsx`, gates | Leen la sesión del cliente | Sin cambios funcionales si el cliente conserva la misma interfaz |
| Páginas estáticas del panel | Estáticas | Siguen estáticas si el proxy solo redirige |
| CSP (fase 0.3) | — | Sin impacto en el proxy; el nonce sigue siendo incompatible con `cacheComponents` |

### Efecto sobre el POS, el escáner y las sesiones

- **POS y escáner:** la cámara, el carrito y el borrador (`sessionStorage`) no dependen de dónde se guarda el token. El riesgo es solo perder la sesión durante el cambio.
- **Sesiones de empleados:** sin migración, todos tendrían que volver a ingresar una vez.

### Plan de migración sin perder sesiones ni permisos (si se decide hacerlo)

1. **Rama aparte** y fuera del horario de venta. No mezclar con otro cambio.
2. **Doble lectura temporal.** Al cargar, si hay cookie de sesión se usa; si no, y existe `mp-panel-auth` en `localStorage`, se llama a `setSession` con esos tokens (se convierten en cookie) y recién después se borra la clave vieja. Así nadie reingresa.
3. **Proxy con matcher estricto** (`/panel/:path*`, excluyendo `/panel/login`): solo redirige si no hay cookie de sesión. **No concede nada:** cada operación sigue validándose en la base.
4. **Prueba previa** con el protocolo de `protocolo-validacion-cuentas.md`, en un proyecto de prueba, con una cuenta de cada rol y una venta armada abierta durante el cambio.
5. **Despliegue con vuelta atrás:** conservar la lectura de `localStorage` una versión más, para poder revertir sin cerrar sesiones.
6. **Retirar la doble lectura** cuando la última sesión vieja haya expirado.

Mientras tanto, la mejora barata y sin dependencias es **reevaluar la sesión al volver a la pestaña** (riesgo 3). No se implementó en esta fase.

## 3. Auditoría de `20261108000001_admin_list_users.sql`

| Control | Resultado | Cómo se comprobó |
| --- | --- | --- |
| Solo un CEO activo puede ejecutarla | **Cumple.** Gerente, empleado, CEO inactivo, cuenta sin perfil y anónimo son rechazados | 8 pruebas de uso en PGlite |
| El permiso se controla dentro de la función | **Cumple.** `has_role_at_least('ceo')` es lo primero, antes de leer `auth.users`, y lanza `42501` | Prueba sobre la definición |
| `search_path` seguro | **Cumple.** `security definer` con `search_path` vacío; todos los nombres están calificados | Prueba sobre `pg_proc` |
| Ejecución restringida | **Cumple.** Revocada a `public` y `anon`; concedida solo a `authenticated` | Pruebas con `has_function_privilege` y `aclexplode` |
| No expone información innecesaria | **Cumple.** Devuelve 8 columnas: id, correo, nombre, rol, estado, si tiene perfil, alta y último ingreso. No toca contraseñas, tokens, teléfono ni metadatos | Prueba de columnas devueltas y de columnas mencionadas |
| No permite escalar privilegios | **Cumple.** Es `stable`, no escribe nada, y un rol falso en el token no sirve. Listar no cambia perfiles | Pruebas de volatilidad, tokens falsificados y perfiles intactos |

Total: 19 pruebas en `supabase/tests/admin-users.test.mjs`, todas pasan sobre PostgreSQL real (PGlite).

**Límites:**
- Las pruebas simulan `auth.users` con las columnas necesarias (`id`, `email`, `created_at`, `last_sign_in_at`). En Supabase real la tabla tiene más; la función no las menciona.
- Un CEO ve el correo de **todas** las cuentas de Auth, incluidas las que no tienen perfil. Es el propósito de la función.
- No se ejecutó nunca en Supabase.

### Pasos manuales para aplicarla (los hace el responsable)

1. Hacer o confirmar una copia de seguridad o punto de restauración.
2. Leer el archivo `supabase/migrations/20261108000001_admin_list_users.sql` (es una sola función, no cambia tablas ni políticas).
3. En el SQL Editor de Supabase, pegar y ejecutar el contenido completo.
4. Verificar que quedó registrada y restringida (solo lectura):

```sql
select proname, prosecdef, provolatile, proconfig
from pg_proc where proname = 'admin_list_users' and pronamespace = 'public'::regnamespace;

select has_function_privilege('anon', 'public.admin_list_users()', 'execute') as anon,
       has_function_privilege('authenticated', 'public.admin_list_users()', 'execute') as authenticated;
```

Esperado: una fila con `prosecdef = true`, `provolatile = s` y `proconfig` con `search_path=""`; y `anon = false`, `authenticated = true`.

5. Probar con las cuentas reales siguiendo `protocolo-validacion-cuentas.md`: el CEO ve la lista; gerente y empleado reciben «Tu cuenta no tiene permiso».
6. Anotar en `estado.md` que se aplicó, con la fecha y quién lo hizo.

**Reversión:** `drop function public.admin_list_users();` no afecta datos ni otras funciones. La pantalla de Usuarios mostraría de nuevo el aviso de que falta aplicarla.
