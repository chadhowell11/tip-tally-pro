-- LOCAL TEST ONLY: runs immediately before the migration of the same name.
-- That migration points app_settings at a hard-coded production location id, which does
-- not exist in a fresh database, so it fails its foreign key. A placeholder owner and a
-- placeholder location with that id let the migration run unchanged. Never apply to a hosted project.
insert into auth.users (id, aud, role, email)
values ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'local-owner@example.test')
on conflict (id) do nothing;
insert into public.locations (id, name, owner_user_id)
values ('86f88398-c708-4bb4-bd73-75de34171e42', 'Local test location', '00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;
