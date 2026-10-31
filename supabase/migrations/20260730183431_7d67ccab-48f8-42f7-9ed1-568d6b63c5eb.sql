DELETE FROM public.app_settings WHERE location_id = '96ca9b08-43ed-4341-a2c6-e192936cffe1';
DELETE FROM public.location_members WHERE location_id = '96ca9b08-43ed-4341-a2c6-e192936cffe1';
DELETE FROM public.locations WHERE id = '96ca9b08-43ed-4341-a2c6-e192936cffe1';
DELETE FROM public.location_members WHERE user_id = '289945fd-f8a3-49c4-b295-998d62b11bbd';
DELETE FROM public.profiles WHERE user_id = '289945fd-f8a3-49c4-b295-998d62b11bbd';
DELETE FROM auth.users WHERE id = '289945fd-f8a3-49c4-b295-998d62b11bbd';