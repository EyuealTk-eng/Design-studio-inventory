-- Who is using the site: every signed-in page view (and a heartbeat while a tab stays open)
-- stamps last_seen_at, so admins can see who's online on the Members page.
alter table profiles add column if not exists last_seen_at timestamptz;

-- Same as 0004, plus the presence stamp and the "online now" counter for admins.
-- Writes at most once a minute per person, so it stays cheap.
create or replace function app_context() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  p profiles%rowtype;
begin
  select * into p from profiles where id = auth.uid();
  if not found then return null; end if;
  if p.status = 'approved' and (p.last_seen_at is null or p.last_seen_at < now() - interval '1 minute') then
    update profiles set last_seen_at = now() where id = p.id;
  end if;
  return jsonb_build_object(
    'profile', to_jsonb(p),
    'unread', (select count(*) from notifications n where n.user_id = p.id and not n.read),
    'pending_requests', case when p.role = 'admin' and p.status = 'approved'
      then (select count(*) from requests where status = 'pending') else 0 end,
    'pending_users', case when p.role = 'admin' and p.status = 'approved'
      then (select count(*) from profiles where status = 'pending') else 0 end,
    'online', case when p.role = 'admin' and p.status = 'approved'
      then (select count(*) from profiles where status = 'approved' and last_seen_at > now() - interval '5 minutes') else 0 end
  );
end $$;
revoke execute on function app_context from public, anon;
grant execute on function app_context to authenticated;

-- Heartbeat from an open tab.
create or replace function touch_presence() returns void
language sql volatile security definer set search_path = public as $$
  update profiles set last_seen_at = now()
  where id = auth.uid() and status = 'approved'
    and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
$$;
revoke execute on function touch_presence from public, anon;
grant execute on function touch_presence to authenticated;

-- Everything the Members page shows, in one call. Admins only.
create or replace function members_overview() returns table (
  id uuid, full_name text, student_id text, email text, phone text, department text, year int,
  role user_role, created_at timestamptz, last_seen_at timestamptz, last_sign_in_at timestamptz,
  items_out bigint, overdue bigint, pending bigint, total_requests bigint
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
  select p.id, p.full_name, p.student_id, p.email, p.phone, p.department, p.year, p.role, p.created_at,
    p.last_seen_at, u.last_sign_in_at,
    coalesce((select sum(ri.qty) from requests r join request_items ri on ri.request_id = r.id
              where r.student_id = p.id and r.status = 'approved'), 0)::bigint,
    (select count(*) from requests r where r.student_id = p.id and r.status = 'approved' and r.due_date < current_date),
    (select count(*) from requests r where r.student_id = p.id and r.status = 'pending'),
    (select count(*) from requests r where r.student_id = p.id)
  from profiles p
  left join auth.users u on u.id = p.id
  where p.status = 'approved'
  order by p.last_seen_at desc nulls last, p.full_name;
end $$;
revoke execute on function members_overview from public, anon;
grant execute on function members_overview to authenticated;

-- Duplicate-ID warnings get their own kind so they can be filtered on the Notifications page.
update notifications set kind = 'duplicate_id'
where kind = 'signup' and title like 'Duplicate student ID attempt%';
