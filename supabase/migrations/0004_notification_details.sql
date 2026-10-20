-- Structured details shown when a notification is opened ([["Project","…"],["Return by","…"]]).
alter table notifications add column if not exists details jsonb;

-- Everything the app shell needs in ONE round trip: the signed-in user's profile plus the
-- sidebar counters. auth.uid() comes from the JWT PostgREST has already verified.
create or replace function app_context() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p profiles%rowtype;
begin
  select * into p from profiles where id = auth.uid();
  if not found then return null; end if;
  return jsonb_build_object(
    'profile', to_jsonb(p),
    'unread', (select count(*) from notifications n where n.user_id = p.id and not n.read),
    'pending_requests', case when p.role = 'admin' and p.status = 'approved'
      then (select count(*) from requests where status = 'pending') else 0 end,
    'pending_users', case when p.role = 'admin' and p.status = 'approved'
      then (select count(*) from profiles where status = 'pending') else 0 end
  );
end $$;
revoke execute on function app_context from public, anon;
grant execute on function app_context to authenticated;

-- Speeds up the unread badge and the notifications page.
create index if not exists notifications_user_created_idx on notifications (user_id, created_at desc);

-- Give existing "account approved" notifications the new structured details.
update notifications n
set details = jsonb_build_array(
      jsonb_build_array('Name', p.full_name),
      jsonb_build_array('Student ID', p.student_id),
      jsonb_build_array('Sign in with', 'Your student ID + password'),
      jsonb_build_array('You can now', 'Browse the inventory and borrow items')
    ),
    body = 'Welcome to the studio! Sign in with your student ID and the password you chose.'
from profiles p
where p.id = n.user_id and n.kind = 'account_approved' and n.details is null;
