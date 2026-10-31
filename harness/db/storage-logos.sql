-- Logo storage for the NEW project, copied from production (docs/handoff/DATABASE.md, "Managed storage").
-- The schema snapshot (docs/handoff/schema.sql) covers public only, so the bucket and its rules are added here.
-- Bucket: private, no MIME allowlist, no size limit (as production). Policies: verbatim, all 8.
-- Production's other bucket, database_export_31_10_26, is a Lovable export artifact and is not recreated.
-- Run by harness/db/remote-storage.sh in one transaction; refuses if the bucket already exists.
set local search_path = public, extensions;
do $guard$
begin
  if exists (select 1 from storage.buckets where id = 'logos') then
    raise exception 'refusing: storage bucket logos already exists';
  end if;
end $guard$;
insert into storage.buckets (id, name, public) values ('logos', 'logos', false);
CREATE POLICY "Admins delete logos" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'logos'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins update logos" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'logos'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins upload logos" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'logos'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Anyone can view logos" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ((bucket_id = 'logos'::text));
CREATE POLICY "Logos are publicly readable" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = 'logos'::text));
CREATE POLICY "Managers delete their location logo" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'logos'::text) AND can_manage_location(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Managers update their location logo" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'logos'::text) AND can_manage_location(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY "Managers upload their location logo" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'logos'::text) AND can_manage_location(auth.uid(), ((storage.foldername(name))[1])::uuid)));
