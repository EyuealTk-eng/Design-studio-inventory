-- Phone numbers for SMS alerts. Stored in international format, e.g. +251911234567.
alter table profiles
  add column phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');

-- Which channels actually delivered each notice (for the admin "sent" indicator).
alter table notifications
  add column emailed boolean not null default false,
  add column texted boolean not null default false;
