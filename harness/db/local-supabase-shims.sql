-- LOCAL TEST ONLY. Fills gaps between the bare supabase/postgres image and a hosted
-- Supabase project, so supabase/migrations/ can be applied unchanged to a local container.
-- The real auth schema comes from running GoTrue once (harness/db/local-db.sh); this file
-- only adds an object if it is still missing. Never apply it to a hosted project.
do $$
begin
  if to_regprocedure('auth.jwt()') is null then
    execute $f$
      create function auth.jwt() returns jsonb language sql stable as $b$
        select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                        nullif(current_setting('request.jwt.claims', true), ''))::jsonb
      $b$
    $f$;
  end if;
end $$;
