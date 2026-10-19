-- One account per phone number (student IDs and emails are already unique).
create unique index if not exists profiles_phone_key on profiles (phone) where phone is not null;

-- Borrowing rules enforced in the database, not only in the UI:
--  * students must have a phone number on their account
--  * a request can't ask for more than is currently in stock (students never see the counts)
create or replace function create_request(
  p_project text, p_purpose text, p_due date, p_letter text, p_lines jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
  line jsonb;
  it items%rowtype;
  q int;
  me profiles%rowtype;
begin
  select * into me from profiles where id = auth.uid();
  if not found or me.status <> 'approved' then raise exception 'Your account is not approved yet'; end if;
  if me.role = 'student' and coalesce(trim(me.phone), '') = '' then
    raise exception 'Add your phone number in My account before borrowing';
  end if;
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
    if it.available_qty = 0 then
      raise exception '"%" is out of stock right now', it.name;
    end if;
    if q > it.available_qty then
      raise exception 'Not enough "%" in stock for that quantity — try fewer', it.name;
    end if;
    insert into request_items (request_id, item_id, qty) values (rid, it.id, q);
  end loop;

  return rid;
end $$;

revoke execute on function create_request from public, anon;
grant execute on function create_request to authenticated;
