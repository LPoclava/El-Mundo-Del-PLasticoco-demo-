-- HUELLA DE LA ESTRUCTURA (solo lectura). Un hash MD5 por categoría de objetos del esquema public. No devuelve datos.
-- Se corre en producción y sobre la copia restaurada: las dos salidas deben ser IDÉNTICAS (categoría por categoría).
-- Si una categoría difiere, se detalla con la consulta de esa categoría (quitando el md5 agregado).
with
f as (select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as k, md5(pg_get_functiondef(p.oid)) as h
        from pg_proc p where p.pronamespace = 'public'::regnamespace),
pol as (select schemaname || '.' || tablename || '.' || policyname as k, md5(concat_ws('|', cmd, roles::text, qual, with_check)) as h
          from pg_policies where schemaname = 'public'),
trg as (select c.relname || '.' || t.tgname as k, md5(pg_get_triggerdef(t.oid) || t.tgenabled::text) as h
          from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not t.tgisinternal),
col as (select table_name || '.' || column_name as k,
               md5(concat_ws('|', data_type, udt_name, is_nullable, column_default, is_generated, generation_expression, is_identity, identity_generation)) as h
          from information_schema.columns where table_schema = 'public'),
con as (select conrelid::regclass::text || '.' || conname as k, md5(pg_get_constraintdef(oid)) as h
          from pg_constraint where connamespace = 'public'::regnamespace),
idx as (select tablename || '.' || indexname as k, md5(replace(indexdef, 'extensions.', '')) as h from pg_indexes where schemaname = 'public'), -- se ignora el prefijo del esquema de pg_trgm: depende del search_path de quien consulta
vw as (select viewname::text as k, md5(pg_get_viewdef((schemaname || '.' || viewname)::regclass)) as h from pg_views where schemaname = 'public'),
rls as (select c.relname::text as k, c.relrowsecurity::text as h from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'),
gr as (select grantee || '.' || table_name || '.' || privilege_type as k, 'x' as h
         from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated')),
fx as (select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ').' || r.rolname as k,
              has_function_privilege(r.rolname, p.oid, 'execute')::text as h
         from pg_proc p cross join (select rolname from pg_roles where rolname in ('anon', 'authenticated')) r
        where p.pronamespace = 'public'::regnamespace),
enums as (select t.typname || ':' || string_agg(e.enumlabel, ',' order by e.enumsortorder) as k, 'x' as h
            from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typnamespace = 'public'::regnamespace group by t.typname),
st as (select policyname as k, md5(concat_ws('|', cmd, roles::text, qual, with_check)) as h from pg_policies where schemaname = 'storage' and tablename = 'objects'),
bk as (select id as k, md5(concat_ws('|', public::text, file_size_limit::text, allowed_mime_types::text)) as h from storage.buckets)
select 'funciones' as categoria, count(*) as elementos, md5(string_agg(k || h, ',' order by k)) as huella from f
union all select 'politicas',        count(*), md5(string_agg(k || h, ',' order by k)) from pol
union all select 'triggers',         count(*), md5(string_agg(k || h, ',' order by k)) from trg
union all select 'columnas',         count(*), md5(string_agg(k || h, ',' order by k)) from col
union all select 'restricciones',    count(*), md5(string_agg(k || h, ',' order by k)) from con
union all select 'indices',          count(*), md5(string_agg(k || h, ',' order by k)) from idx
union all select 'vistas',           count(*), md5(string_agg(k || h, ',' order by k)) from vw
union all select 'rls_por_tabla',    count(*), md5(string_agg(k || h, ',' order by k)) from rls
union all select 'permisos_tabla',   count(*), md5(string_agg(k || h, ',' order by k)) from gr
union all select 'permisos_funcion', count(*), md5(string_agg(k || h, ',' order by k)) from fx
union all select 'enums',            count(*), md5(string_agg(k || h, ',' order by k)) from enums
union all select 'storage_politicas', count(*), md5(string_agg(k || h, ',' order by k)) from st
union all select 'storage_buckets',  count(*), md5(string_agg(k || h, ',' order by k)) from bk
order by 1;
