create or replace function public.grant_admin_to_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'owner' then
    insert into public.user_roles (user_id, role)
    values (new.user_id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_grant_admin_to_owner on public.location_members;
create trigger trg_grant_admin_to_owner
after insert on public.location_members
for each row execute function public.grant_admin_to_owner();

insert into public.user_roles (user_id, role)
select distinct lm.user_id, 'admin'::app_role
from public.location_members lm
where lm.role = 'owner'
on conflict (user_id, role) do nothing;