-- ============================================================
-- APPLY-NOW — one paste, one Run.
--
-- Section 0 is a one-off data fix for THIS demo project: four
-- Approved requests of Sai form three overlap pairs
-- (LV-10320 × LV-10323, LV-10320 × LV-10319, LV-10319 × LV-10322),
-- which block the exclusion constraint below. Cancelling all four
-- clears every pair. The update is guarded: on a fresh database
-- nothing matches and it does nothing.
--
-- Sections 1-3 are the cumulative patch bundle (identical to
-- patch-004-006.sql): notifications, days recompute, overlap
-- constraint. Idempotent — safe to re-run at any time.
--
-- SQL editor: supabase.com/dashboard/project/caqxzdthrtrbkshzgkfa/sql/new
-- ============================================================

-- ---------- section 0 · free the overlapping demo rows ----------

update public.leave_requests
   set status = 'Cancelled'
 where request_no in ('LV-10319', 'LV-10320', 'LV-10322', 'LV-10323')
   and status <> 'Cancelled';

-- ---------- section 1 · notifications ----------

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.employees (id),
  actor_id     uuid references public.employees (id),
  type         text not null check (type in
                 ('leave_submitted', 'leave_approved', 'leave_rejected', 'leave_cancelled')),
  request_no   text references public.leave_requests (request_no),
  message      text,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

do $$
begin
  create policy notifications_select on public.notifications for select to authenticated
    using (recipient_id = public.auth_employee_id());
exception
  when duplicate_object then null; -- policy already exists; safe to re-run
end $$;

do $$
begin
  create policy notifications_update_self on public.notifications for update to authenticated
    using (recipient_id = public.auth_employee_id())
    with check (recipient_id = public.auth_employee_id());
exception
  when duplicate_object then null;
end $$;

-- recipients may flip is_read and nothing else (SQL editor bypasses)
create or replace function public.notifications_update_guard() returns trigger
language plpgsql stable set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.recipient_id is distinct from old.recipient_id
     or new.actor_id     is distinct from old.actor_id
     or new.type         is distinct from old.type
     or new.request_no   is distinct from old.request_no
     or new.message      is distinct from old.message
     or new.created_at   is distinct from old.created_at then
    raise exception 'Only is_read can be updated on notifications';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_guard on public.notifications;
create trigger notifications_guard
  before update on public.notifications
  for each row execute function public.notifications_update_guard();

-- trigger 1: employee applies -> manager gets 'leave_submitted'
create or replace function public.leave_requests_notify_submit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_manager_id uuid;
  v_emp_name   text;
  v_type_name  text;
  v_days_text  text;
begin
  if new.employee_id is null then
    return new;
  end if;

  select e.manager_id, e.full_name into v_manager_id, v_emp_name
  from public.employees e
  where e.id = new.employee_id;

  if v_manager_id is null then
    return new; -- no manager to notify
  end if;

  select t.name into v_type_name
  from public.leave_types t
  where t.id = new.leave_type_id;

  v_days_text := case
    when new.days = floor(new.days) then floor(new.days)::int::text
    else new.days::text
  end;

  insert into public.notifications (recipient_id, actor_id, type, request_no, message)
  values (
    v_manager_id,
    new.employee_id,
    'leave_submitted',
    new.request_no,
    format('%s applied for %s %s (%s) from %s to %s',
      v_emp_name, v_days_text, v_type_name, new.mode, new.start_date, new.end_date)
  );
  return new;
end;
$$;

drop trigger if exists leave_requests_notify_submit on public.leave_requests;
create trigger leave_requests_notify_submit
  after insert on public.leave_requests
  for each row execute function public.leave_requests_notify_submit();

-- trigger 2: status changed -> the request's employee gets notified
create or replace function public.leave_requests_notify_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_type_name  text;
  v_type       text;
  v_actor_id   uuid;
  v_actor_name text;
begin
  if old.status is not distinct from new.status then
    return new; -- only fire when the status actually changes
  end if;

  v_type := case new.status
    when 'Approved'  then 'leave_approved'
    when 'Rejected'  then 'leave_rejected'
    when 'Cancelled' then 'leave_cancelled'
    else null
  end;
  if v_type is null then
    return new;
  end if;

  v_actor_id := coalesce(new.approver_id,
                 case when new.status = 'Cancelled' then new.employee_id end);
  if v_actor_id is null then
    return new; -- nobody to attribute; skip
  end if;

  select e.full_name into v_actor_name
  from public.employees e
  where e.id = v_actor_id;

  select t.name into v_type_name
  from public.leave_types t
  where t.id = new.leave_type_id;

  insert into public.notifications (recipient_id, actor_id, type, request_no, message)
  values (
    new.employee_id,
    v_actor_id,
    v_type,
    new.request_no,
    format('Your request %s (%s, %s to %s) was %s by %s',
      new.request_no, v_type_name, new.start_date, new.end_date, new.status, v_actor_name)
  );
  return new;
end;
$$;

drop trigger if exists leave_requests_notify_status on public.leave_requests;
create trigger leave_requests_notify_status
  after update on public.leave_requests
  for each row execute function public.leave_requests_notify_status();

-- realtime: the client listens with postgres_changes on this table
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null; -- already a member; safe to re-run
end $$;

-- ---------- section 2 · days recompute ----------

-- The client-sent `days` is no longer trusted. BEFORE INSERT trigger
-- recomputes working days from start_date / end_date. Weekend-only
-- ranges are rejected. SQL-editor context (auth.uid() is null, e.g.
-- seed.sql) keeps its own days — verbatim historical rows stand.
create or replace function public.leave_requests_recompute_days() returns trigger
language plpgsql stable set search_path = public as $$
declare
  v_weekdays int;
begin
  if auth.uid() is null then
    return new; -- SQL-editor context (seeds / scripts): own days stand
  end if;

  select count(*) into v_weekdays
  from generate_series(new.start_date, new.end_date, interval '1 day') g(d)
  where extract(isodow from g.d) < 6; -- Mon..Fri

  if v_weekdays = 0 then
    raise exception 'A leave request needs at least one working day (weekend-only ranges are not bookable)'
      using errcode = 'check_violation';
  end if;

  new.days :=
    case
      when new.mode = 'Full Day' then v_weekdays::numeric
      else v_weekdays::numeric * 0.5
    end;

  return new;
end;
$$;

drop trigger if exists leave_requests_recompute_days on public.leave_requests;
create trigger leave_requests_recompute_days
  before insert on public.leave_requests
  for each row execute function public.leave_requests_recompute_days();

-- ---------- section 3 · overlap prevention ----------

-- One live (Pending/Approved) request per employee per date range.
-- Cancelling or rejecting frees the range immediately. Inclusive
-- '[]' bounds: the day AFTER a leave never conflicts, sharing the
-- end date does.
create extension if not exists btree_gist;

do $$
begin
  alter table public.leave_requests
    add constraint leave_requests_no_overlap
    exclude using gist (
      employee_id with =,
      daterange(start_date, end_date, '[]') with &&
    )
    where (status in ('Pending', 'Approved'));
exception
  when duplicate_object then null; -- already there; safe to re-run
  when others then
    raise; -- keep naming conflicts visible (overlapping live rows exist)
end $$;
