-- BLOQUE 2 (fase 0.6): consultas de SOLO LECTURA para el SQL Editor de Supabase (proyecto de producción).
-- Solo SELECT. No hay INSERT, UPDATE, DELETE, ALTER, DROP ni migraciones. Ninguna consulta devuelve correos, contraseñas
-- ni tokens (el correo vive en auth.users y aquí no se lee). Ejecutar de a una; pegar el resultado como TEXTO en el informe.
-- Las consultas Q10 usan "set local role" dentro de una transacción que termina en ROLLBACK: son lecturas con los permisos
-- de la cuenta suplantada y no dejan nada.

-- ESTADO DE LAS CONSULTAS (actualizado el 8 de noviembre de 2026, tras el diagnóstico con el conector de Supabase):
--   Q1  RESPONDIDA: staff, staff_legacy e is_staff() NO existen en producción (el cierre close_drop_staff está aplicado;
--       operador y fecha desconocidos). No hace falta repetirla; sirve para comprobar un proyecto de prueba que replique producción.
--   Q2  NO VERIFICABLE en el proyecto actual: supabase_migrations.schema_migrations no existe (error 42P01) y list_migrations
--       devolvió cero registros. Las migraciones se aplicaron con el SQL Editor y no hay historial de versiones; se comprueban
--       por objetos (ver docs/informe-bloque-2-diagnostico-conector.md §4).
--   Q10a/Q10b/Q10c RESPONDIDAS: una sola cuenta (CEO activo con perfil); no hay gerente ni empleado.
--   Q3, Q4, Q5, Q6, Q7, Q8, Q12 y Q13: se ejecutaron consultas equivalentes con el conector (RLS, políticas, funciones, triggers
--       y Storage); los resultados están en docs/informe-bloque-2-diagnostico-conector.md §3. Q9 (privilegios de tabla) no se ejecutó.
--   Q11 PENDIENTE: necesita cuentas de gerente y empleado, que no existen (solo se podría correr con la cuenta CEO).

-- Q1. staff_legacy e is_staff(): ¿se aplicó el cierre de supabase/pending?
-- RESULTADO ya obtenido (8 nov 2026): los tres devuelven vacío = el cierre SÍ está aplicado en producción.
-- Si se usa en un proyecto de prueba que replique producción, lo esperado también es: los tres vacíos (tras aplicar el cierre al final).
select to_regclass('public.staff')        as tabla_staff,
       to_regclass('public.staff_legacy') as tabla_staff_legacy,
       to_regprocedure('public.is_staff()') as funcion_is_staff;

-- Q2. Versiones de migraciones registradas.
-- NO ES VERIFICABLE EN PRODUCCIÓN (8 nov 2026): el esquema supabase_migrations no existe y esta consulta falla con 42P01.
-- Solo tiene sentido en un proyecto donde las migraciones se apliquen con la CLI de Supabase; allí sí dejaría registro.
-- En el proyecto actual se compara por objetos.
select version, name from supabase_migrations.schema_migrations order by version;

-- Q3. RLS por tabla de public (esperado: rowsecurity = true en todas).
select c.relname as tabla, c.relrowsecurity as rls_activa, c.relforcerowsecurity as rls_forzada
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- Q4. Políticas RLS vigentes (tabla, nombre, comando, roles y condiciones).
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;

-- Q5. Ninguna política debe depender ya de is_staff() (esperado: 0 filas).
select schemaname, tablename, policyname from pg_policies
where coalesce(qual, '') ilike '%is_staff%' or coalesce(with_check, '') ilike '%is_staff%';

-- Q6. Privilegios de ejecución de TODAS las funciones de public, con security definer y search_path.
select p.proname as funcion,
       pg_get_function_identity_arguments(p.oid) as argumentos,
       p.prosecdef as security_definer,
       coalesce((select c from unnest(p.proconfig) c where c like 'search_path=%'), '(sin search_path fijo)') as search_path,
       has_function_privilege('anon', p.oid, 'execute')          as anon_ejecuta,
       has_function_privilege('authenticated', p.oid, 'execute') as autenticado_ejecuta,
       has_function_privilege('public', p.oid, 'execute')        as public_ejecuta
from pg_proc p where p.pronamespace = 'public'::regnamespace
order by p.prosecdef desc, 1;

-- Q7. security definer SIN search_path fijo (esperado: 0 filas).
select p.proname from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');

-- Q8. Funciones que anon puede ejecutar (esperado: ninguna de admin_*, scan_*, pos_find, confirm_sale, receive_stock, adjust_stock, sales_summary...).
select p.proname, pg_get_function_identity_arguments(p.oid) as argumentos
from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute') order by 1;

-- Q9. Privilegios de tabla de anon y authenticated (esperado: anon sin nada; authenticated solo lo previsto).
select grantee, table_name, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by grantee, table_name order by grantee, table_name;

-- Q10a. CUENTAS Y ROLES (sin correos): ¿existen gerente y empleado? Solo cuenta filas.
select role, active, count(*) as cuentas from public.profiles group by role, active order by role, active;

-- Q10b. Cuentas de Auth sin perfil (no acceden a nada protegido) y total de cuentas. Solo recuentos.
select (select count(*) from auth.users) as cuentas_auth,
       (select count(*) from public.profiles) as perfiles,
       (select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.user_id = u.id)) as sin_perfil;

-- Q10c. Identificadores (uuid, sin correo) y rol de cada perfil, para usarlos en la Q11. El nombre visible NO se lista.
select user_id, role, active from public.profiles order by role desc, created_at;

-- Q11. Lecturas con los permisos de UNA cuenta (suplantación en el SQL Editor), dentro de una transacción con ROLLBACK.
-- Reemplazar <UUID> por un user_id de la Q10c. Repetir una vez por rol. Los resultados esperados están en el protocolo.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '<UUID>', 'role', 'authenticated')::text, true);
select public.current_app_role()                        as mi_rol,
       public.has_role_at_least('gerente')              as es_gerente_o_mas,
       public.has_role_at_least('ceo')                  as es_ceo,
       (select count(*) from public.profiles)           as perfiles_visibles,      -- empleado: 1; gerente y CEO: todos
       (select count(*) from public.sales)              as ventas_visibles,        -- empleado: solo las suyas
       (select count(*) from public.stock_movements)    as movimientos_visibles,   -- empleado: 0
       (select count(*) from public.products)           as productos_visibles,     -- empleado: 0
       (select count(*) from public.audit_log)          as auditoria_visible;      -- empleado: la propia
-- admin_list_users solo debe responder al CEO; para gerente y empleado debe fallar con 42501 «No autorizado»:
select count(*) as usuarios_listados from public.admin_list_users();
rollback;

-- Q12. Triggers de protección y auditoría (no internos).
select c.relname as tabla, t.tgname as trigger, t.tgenabled as habilitado
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public') and not t.tgisinternal order by 1, 2;

-- Q13. Storage: políticas y bucket (esperado: bucket público; políticas por rol).
select policyname, cmd, roles from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;
select id, public from storage.buckets where id = 'product-images';
