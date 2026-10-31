-- Fingerprint of logo storage: the logos bucket settings and every storage.objects policy, sorted.
select json_build_object(
  'buckets', (select json_agg(b order by b) from (select concat_ws('|', id, name, public::text) as b from storage.buckets where id = 'logos') x),
  'policies', (select json_agg(p order by p) from (select concat_ws('|', policyname, permissive, cmd, array_to_string(roles, ','), coalesce(qual,''), coalesce(with_check,'')) as p from pg_policies where schemaname='storage' and tablename='objects') x)
)::text as fingerprint;
