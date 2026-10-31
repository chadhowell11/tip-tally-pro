-- Fingerprint of the public schema: one JSON document, every list sorted, so two databases
-- can be compared as text. Used to check the hosted project against the production snapshot.
select json_build_object(
  'tables', (select json_agg(t order by t) from (select table_name::text as t from information_schema.tables where table_schema='public') x),
  'columns', (select json_agg(c order by c) from (select concat_ws('|', table_name, column_name, data_type, udt_name, is_nullable, coalesce(column_default,'')) as c from information_schema.columns where table_schema='public') x),
  'enums', (select json_agg(e order by e) from (select concat(t.typname, ':', string_agg(e.enumlabel, ',' order by e.enumsortorder)) as e from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname) x),
  'functions', (select json_agg(f order by f) from (select concat(p.proname, '(', pg_get_function_identity_arguments(p.oid), ') ', md5(pg_get_functiondef(p.oid))) as f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') x),
  'policies', (select json_agg(p order by p) from (select concat_ws('|', tablename, policyname, cmd, array_to_string(roles, ','), coalesce(qual,''), coalesce(with_check,'')) as p from pg_policies where schemaname='public') x),
  'indexes', (select json_agg(i order by i) from (select indexdef as i from pg_indexes where schemaname='public') x),
  'triggers', (select json_agg(t order by t) from (select concat(c.relname, ': ', pg_get_triggerdef(tg.oid)) as t from pg_trigger tg join pg_class c on c.oid=tg.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not tg.tgisinternal) x),
  'rls', (select json_agg(r order by r) from (select concat(relname, ':', relrowsecurity) as r from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r') x),
  'grants', (select json_agg(g order by g) from (select concat_ws('|', table_name, grantee, privilege_type) as g from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role')) x)
)::text as fingerprint;
