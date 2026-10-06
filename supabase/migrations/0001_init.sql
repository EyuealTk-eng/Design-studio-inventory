-- Biomedical Design Studio inventory: schema, RLS and stock-safe RPCs.
-- Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

create type user_role as enum ('student', 'admin');
create type user_status as enum ('pending', 'approved', 'rejected');
create type request_status as enum ('pending', 'approved', 'rejected', 'returned');

-- ---------------------------------------------------------------- profiles
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  student_id text not null unique,
  email text not null unique,
  department text not null,
  year int not null check (year between 1 and 8),
  role user_role not null default 'student',
  status user_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles (id)
);

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

create function is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and status = 'approved'
  );
$$;

-- ------------------------------------------------------------------- items
create table items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
  sku text unique,
  location text,
  condition text not null default 'Good',
  total_qty int not null check (total_qty >= 0),
  available_qty int not null check (available_qty >= 0),
  low_stock_threshold int not null default 2 check (low_stock_threshold >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint available_within_total check (available_qty <= total_qty)
);

create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger items_touch before update on items
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- requests
create table requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id),
  project text not null,
  purpose text,
  due_date date not null,
  letter_path text,
  status request_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now()
);
create index requests_student_idx on requests (student_id);
create index requests_status_idx on requests (status);

create table request_items (
  request_id uuid not null references requests (id) on delete cascade,
  item_id uuid not null references items (id) on delete restrict,
  qty int not null check (qty > 0),
  lost_qty int not null default 0 check (lost_qty >= 0),
  primary key (request_id, item_id)
);

-- Every change to available stock is logged here (feeds the monthly check-in).
create table stock_movements (
  id bigint generated always as identity primary key,
  item_id uuid not null references items (id) on delete cascade,
  delta int not null,
  reason text not null,
  request_id uuid references requests (id) on delete set null,
  actor uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index stock_movements_item_idx on stock_movements (item_id, created_at desc);

-- ---------------------------------------------------------------- settings
create table settings (
  id int primary key default 1 check (id = 1),
  checkin_day int not null default 28 check (checkin_day between 1 and 28),
  checkin_notice_days int not null default 5 check (checkin_notice_days >= 0),
  due_soon_days int not null default 3 check (due_soon_days >= 0),
  last_checkin_at date
);
insert into settings default values;

-- ----------------------------------------------------------- notifications
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  dedupe_key text not null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_idx on notifications (user_id, read, created_at desc);

-- --------------------------------------------------------------------- RLS
alter table profiles enable row level security;
alter table items enable row level security;
alter table requests enable row level security;
alter table request_items enable row level security;
alter table stock_movements enable row level security;
alter table settings enable row level security;
alter table notifications enable row level security;

create policy profiles_read on profiles for select
  using (id = auth.uid() or is_admin());
create policy profiles_admin_update on profiles for update
  using (is_admin()) with check (is_admin());

create policy items_read on items for select using (is_approved());
create policy items_admin_write on items for all
  using (is_admin()) with check (is_admin());

create policy requests_read on requests for select
  using (student_id = auth.uid() or is_admin());

create policy request_items_read on request_items for select
  using (
    is_admin() or exists (
      select 1 from requests r
      where r.id = request_id and r.student_id = auth.uid()
    )
  );

create policy movements_admin_read on stock_movements for select
  using (is_admin());
create policy movements_admin_insert on stock_movements for insert
  with check (is_admin());

create policy settings_read on settings for select using (is_approved());
create policy settings_admin_update on settings for update
  using (is_admin()) with check (is_admin());

create policy notifications_own_read on notifications for select
  using (user_id = auth.uid());
create policy notifications_own_update on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Requests are created / reviewed only through the RPCs below.

-- -------------------------------------------------------------------- RPCs
-- p_lines: [{"item_id": "<uuid>", "qty": 2}, ...]
create function create_request(
  p_project text, p_purpose text, p_due date, p_letter text, p_lines jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
  line jsonb;
  it items%rowtype;
  q int;
begin
  if not is_approved() then raise exception 'Your account is not approved yet'; end if;
  if p_due is null or p_due < current_date then
    raise exception 'Return date must be today or later';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Choose at least one item';
  end if;

  insert into requests (student_id, project, purpose, due_date, letter_path)
  values (auth.uid(), trim(p_project), nullif(trim(p_purpose), ''), p_due, p_letter)
  returning id into rid;

  for line in select * from jsonb_array_elements(p_lines) loop
    q := (line ->> 'qty')::int;
    select * into it from items where id = (line ->> 'item_id')::uuid;
    if not found then raise exception 'Unknown item'; end if;
    if q is null or q < 1 then raise exception 'Quantity must be at least 1'; end if;
    if q > it.total_qty then
      raise exception 'We only own % of "%"', it.total_qty, it.name;
    end if;
    insert into request_items (request_id, item_id, qty) values (rid, it.id, q);
  end loop;

  return rid;
end $$;

create function approve_request(p_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r requests%rowtype;
  line record;
  it items%rowtype;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select * into r from requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request is already %', r.status; end if;

  for line in select * from request_items where request_id = p_id order by item_id loop
    select * into it from items where id = line.item_id for update;
    if it.available_qty < line.qty then
      raise exception 'Not enough "%" in stock (available %, requested %)',
        it.name, it.available_qty, line.qty;
    end if;
    update items set available_qty = available_qty - line.qty where id = it.id;
    insert into stock_movements (item_id, delta, reason, request_id, actor)
    values (it.id, -line.qty, 'borrowed', p_id, auth.uid());
  end loop;

  update requests set status = 'approved', admin_note = nullif(trim(p_note), ''),
    reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
end $$;

create function reject_request(p_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update requests set status = 'rejected', admin_note = nullif(trim(p_note), ''),
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id and status = 'pending';
  if not found then raise exception 'Only pending requests can be rejected'; end if;
end $$;

-- p_lost: {"<item_id>": <qty not coming back>}; lost units leave the inventory.
create function return_request(
  p_id uuid, p_note text default null, p_lost jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  r requests%rowtype;
  line record;
  lost int;
  back int;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select * into r from requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'approved' then raise exception 'Only approved requests can be returned'; end if;

  for line in select * from request_items where request_id = p_id order by item_id loop
    lost := least(greatest(coalesce((p_lost ->> line.item_id::text)::int, 0), 0), line.qty);
    back := line.qty - lost;
    update items
      set available_qty = available_qty + back, total_qty = total_qty - lost
    where id = line.item_id;
    update request_items set lost_qty = lost
    where request_id = p_id and item_id = line.item_id;
    if back > 0 then
      insert into stock_movements (item_id, delta, reason, request_id, actor)
      values (line.item_id, back, 'returned', p_id, auth.uid());
    end if;
    if lost > 0 then
      insert into stock_movements (item_id, delta, reason, request_id, actor)
      values (line.item_id, 0, 'lost/damaged: ' || lost, p_id, auth.uid());
    end if;
  end loop;

  update requests set status = 'returned', returned_at = now(),
    admin_note = coalesce(nullif(trim(p_note), ''), admin_note)
  where id = p_id;
end $$;

-- Sets an item's total quantity without disturbing units that are borrowed.
-- p_clamp: raise the total to the borrowed count instead of failing.
create function set_item_total(
  p_id uuid, p_total int, p_reason text, p_clamp boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  it items%rowtype;
  borrowed int;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select * into it from items where id = p_id for update;
  if not found then raise exception 'Item not found'; end if;
  borrowed := it.total_qty - it.available_qty;
  if p_clamp then p_total := greatest(p_total, borrowed); end if;
  if p_total < borrowed then
    raise exception '% currently borrowed: total can''t be less than that', borrowed;
  end if;
  if p_total = it.total_qty then return; end if;
  update items set total_qty = p_total, available_qty = p_total - borrowed where id = p_id;
  insert into stock_movements (item_id, delta, reason, actor)
  values (p_id, p_total - it.total_qty, p_reason, auth.uid());
end $$;

revoke execute on function create_request, approve_request, reject_request, return_request,
  set_item_total from public, anon;
grant execute on function create_request, approve_request, reject_request, return_request,
  set_item_total to authenticated;

-- ----------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('letters', 'letters', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create policy letters_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'letters' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy letters_read on storage.objects for select to authenticated
  using (
    bucket_id = 'letters'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );
