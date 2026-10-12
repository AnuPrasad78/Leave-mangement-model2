-- ============================================================
-- Emids Leave Portal — Supabase schema
-- Run once in the Supabase SQL editor (postgres role).
-- ============================================================

-- ---------- Enums ----------
create type leave_status as enum ('Pending', 'Approved', 'Rejected', 'Cancelled');
create type leave_mode   as enum ('Full Day', 'First Half', 'Second Half');
create type system_role  as enum ('employee', 'manager', 'admin');
create type separation_status as enum ('Pending', 'Approved', 'Rejected');

-- ---------- Sequences ----------
create sequence emp_no_seq            start 30000;  -- skeleton accounts; seeded staff use EM-20xxx explicitly
create sequence leave_request_no_seq  start 10316;  -- one above the highest seeded request (LV-10315)

-- ---------- Tables ----------
create table public.employees (
  id                    uuid primary key default gen_random_uuid(),
  auth_user_id          uuid unique references auth.users (id) on delete set null,
  emp_no                text unique not null default 'EM-' || lpad(nextval('emp_no_seq')::text, 5, '0'),
  full_name             text not null,
  initials              text,
  email                 text unique not null,
  job_title             text,
  doj                   date,
  account               text,
  project_name          text,
  function_name         text,
  manager_id            uuid references public.employees (id) on delete set null,
  delivery_partner_name text,
  location              text,
  system_role           system_role not null default 'employee',
  created_at            timestamptz not null default now()
);
create index employees_manager_id_idx on public.employees (manager_id);

create table public.leave_types (
  id        smallserial primary key,
  name      text unique not null,
  is_active boolean not null default true
);

create table public.leave_requests (
  id            bigint generated always as identity primary key,
  request_no    text unique not null default 'LV-' || lpad(nextval('leave_request_no_seq')::text, 5, '0'),
  employee_id   uuid not null references public.employees (id) on delete cascade,
  leave_type_id smallint not null references public.leave_types (id),
  start_date    date not null,
  end_date      date not null,
  days          numeric(4,1) not null,
  mode          leave_mode not null default 'Full Day',
  reason        text not null,
  status        leave_status not null default 'Pending',
  approver_id   uuid references public.employees (id) on delete set null,
  decided_at    timestamptz,
  requested_on  date not null default current_date,
  created_at    timestamptz not null default now(),
  constraint leave_requests_days_positive     check (days > 0),
  constraint leave_requests_span_sanity       check (end_date >= start_date),
  constraint leave_requests_days_within_span  check (days <= (end_date - start_date + 1))
);
create index leave_requests_employee_idx on public.leave_requests (employee_id);
create index leave_requests_status_idx   on public.leave_requests (status);

create table public.leave_balances (
  id                   bigint generated always as identity primary key,
  employee_id          uuid not null references public.employees (id) on delete cascade,
  year                 smallint not null check (year between 2000 and 2999),
  opening_annual       numeric(5,2) not null default 0,
  annual_credited      numeric(5,2) not null default 0,
  annual_utilized      numeric(5,2) not null default 0,
  contingency_credited numeric(5,2) not null default 0,
  contingency_utilized numeric(5,2) not null default 0,
  annual_cap           numeric(5,2) not null default 18,
  contingency_cap      numeric(5,2) not null default 10,
  unique (employee_id, year)
);

create table public.holidays (
  id           bigint generated always as identity primary key,
  country      text not null,
  location     text,                -- null = country-wide optional list
  year         smallint not null check (year between 2000 and 2999),
  kind         text not null check (kind in ('fixed', 'optional')),
  holiday_date date not null,
  name         text not null,
  unique nulls not distinct (country, location, year, kind, holiday_date, name)
);
create index holidays_country_year_idx on public.holidays (country, year);

create table public.optional_holiday_picks (
  employee_id uuid not null references public.employees (id) on delete cascade,
  holiday_id  bigint not null references public.holidays (id) on delete cascade,
  picked_at   timestamptz not null default now(),
  primary key (employee_id, holiday_id)
);

create table public.separation_requests (
  id                bigint generated always as identity primary key,
  employee_id       uuid not null references public.employees (id) on delete cascade,
  last_working_day  date not null,
  reason            text not null check (reason in (
    'Better Opportunity', 'Higher Studies', 'Personal Reasons', 'Health Reasons',
    'Relocation', 'Entrepreneurship', 'Career Break', 'Other'
  )),
  remarks           text check (char_length(remarks) <= 800),
  status            separation_status not null default 'Pending',
  reviewed_by       uuid references public.employees (id) on delete set null,
  decided_at        timestamptz,
  created_at        timestamptz not null default now()
);

-- ---------- Helper functions ----------
-- Current user's employee row. SECURITY DEFINER: reads employees without RLS.
create function public.auth_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select e.id from public.employees e where e.auth_user_id = auth.uid()
$$;

create function public.auth_system_role() returns system_role
language sql stable security definer set search_path = public as $$
  select e.system_role from public.employees e where e.auth_user_id = auth.uid()
$$;

create function public.auth_manager_id() returns uuid
language sql stable security definer set search_path = public as $$
  select manager_id from public.employees where auth_user_id = auth.uid()
$$;

-- Which balance pool a leave type draws from: 'annual', 'contingency', or null (no deduction).
create function public.leave_deduction_pool(p_type_name text) returns text
language sql immutable as $$
  select case
    when p_type_name = 'Contingency Bucket' then 'contingency'
    when p_type_name in ('Work From Home', 'Business Travel', 'Leave Without Pay', 'Loss Of Pay') then null
    else 'annual'
  end
$$;

-- ---------- Triggers ----------
-- 1. Auto-create an employees skeleton for every new auth user so RLS lookups always resolve.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  v_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1));
  -- If an employee row already exists for this email (e.g. seed.sql ran before the
  -- auth user was provisioned), bind the auth user to it instead of creating a duplicate.
  insert into public.employees (auth_user_id, email, full_name, initials)
  values (
    new.id,
    new.email,
    v_name,
    (select string_agg(upper(left(w, 1)), '')
       from unnest(regexp_split_to_array(regexp_replace(v_name, '[^a-zA-Z ]', '', 'g'), '\s+')) as w
      limit 2)
  )
  on conflict (email) do update
    set auth_user_id = coalesce(public.employees.auth_user_id, excluded.auth_user_id);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Write-guard on leave_requests: RLS can't diff fields, so this trigger decides who may change what.
create function public.leave_requests_update_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_me         uuid := public.auth_employee_id();
  v_role       system_role := public.auth_system_role();
  v_is_self    boolean;
  v_is_manager boolean;
begin
  -- Service-role / SQL-editor context bypasses the guard.
  if auth.uid() is null or v_me is null then
    return new;
  end if;

  v_is_self := old.employee_id = v_me;
  v_is_manager :=
    (v_role = 'admin')
    or exists (
      select 1 from public.employees e
      where e.id = old.employee_id and e.manager_id = v_me
    );

  if v_is_self then
    -- Employee: only action is cancelling a pending request; no other field may move.
    if new.status = 'Cancelled' and old.status = 'Pending'
       and new.employee_id = old.employee_id
       and new.leave_type_id = old.leave_type_id
       and new.start_date = old.start_date
       and new.end_date = old.end_date
       and new.days = old.days
       and new.mode = old.mode
       and new.reason = old.reason
       and new.requested_on = old.requested_on
       and new.approver_id is not distinct from old.approver_id
       and new.decided_at is not distinct from old.decided_at
    then
      return new;
    end if;
    raise exception 'You can only cancel your own pending request';
  end if;

  if v_is_manager then
    -- Manager/admin: only status + decision metadata, only from Pending, only to Approved/Rejected.
    if old.status = 'Pending'
       and new.status in ('Approved', 'Rejected')
       and new.employee_id = old.employee_id
       and new.leave_type_id = old.leave_type_id
       and new.start_date = old.start_date
       and new.end_date = old.end_date
       and new.days = old.days
       and new.mode = old.mode
       and new.reason = old.reason
       and new.requested_on = old.requested_on
    then
      -- Stamp decision metadata if the client omitted it.
      new.approver_id := coalesce(new.approver_id, v_me);
      new.decided_at  := coalesce(new.decided_at, now());
      return new;
    end if;
    raise exception 'Only pending requests can be approved or rejected';
  end if;

  raise exception 'You are not allowed to edit this request';
end;
$$;
create trigger leave_requests_guard
  before update on public.leave_requests
  for each row execute function public.leave_requests_update_guard();

-- 3. Keep balances in sync with approvals (approve adds days up to the
--    remaining pool, moving off Approved removes them).
create function public.leave_requests_balance_bump() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_pool  text;
  v_delta numeric;
  v_year  smallint;
  v_opening        numeric;
  v_credited       numeric;
  v_utilized       numeric;
  v_cont_credited  numeric;
  v_cont_utilized  numeric;
  v_free           numeric;
begin
  if new.start_date is null then return new; end if;
  v_year := extract(year from new.start_date)::smallint;

  select public.leave_deduction_pool(t.name) into v_pool
  from public.leave_types t
  where t.id = new.leave_type_id;

  if v_pool is null then
    return new;
  end if;

  v_delta := (case when new.status = 'Approved' then new.days else 0 end)
           - (case when old.status = 'Approved' then old.days else 0 end);

  if v_delta = 0 then
    return new;
  end if;

  if v_delta > 0 then
    -- Cap check: an approval may not take the drawn pool negative. Teammates
    -- without a balance row start from the same standard credits the upsert
    -- below would give (opening 0 · annual 18 · contingency 10).
    select lb.opening_annual, lb.annual_credited, lb.annual_utilized,
           lb.contingency_credited, lb.contingency_utilized
      into v_opening, v_credited, v_utilized, v_cont_credited, v_cont_utilized
      from public.leave_balances lb
     where lb.employee_id = new.employee_id and lb.year = v_year;
    if not found then
      v_opening := 0;        v_credited := 18;       v_utilized := 0;
      v_cont_credited := 10; v_cont_utilized := 0;
    end if;

    v_free := case
      when v_pool = 'annual' then v_opening + v_credited - v_utilized
      else                        v_cont_credited - v_cont_utilized
    end;

    if v_delta > v_free then
      raise exception
        'This approval needs %s day(s) from the %s pool, but only %s day(s) remain for %s. Ask the People Success desk to credit more balance first.',
        to_char(v_delta, 'FM990.99'),
        case when v_pool = 'annual' then 'annual' else 'contingency' end,
        to_char(greatest(v_free, 0), 'FM990.99'),
        v_year;
    end if;

    -- Upsert: teammates without a balance row start with standard credits.
    insert into public.leave_balances
      (employee_id, year, opening_annual, annual_credited, annual_utilized,
       contingency_credited, contingency_utilized, annual_cap, contingency_cap)
    values
      (new.employee_id, v_year, 0, 18, case when v_pool = 'annual' then v_delta else 0 end,
       10, case when v_pool = 'contingency' then v_delta else 0 end, 18, 10)
    on conflict (employee_id, year) do update
      set annual_utilized      = case when v_pool = 'annual'
                                 then public.leave_balances.annual_utilized + v_delta
                                 else public.leave_balances.annual_utilized end,
          contingency_utilized = case when v_pool = 'contingency'
                                 then public.leave_balances.contingency_utilized + v_delta
                                 else public.leave_balances.contingency_utilized end;
  else
    -- Subtract only from an existing row; never conjure one with negative utilization.
    update public.leave_balances
       set annual_utilized      = case when v_pool = 'annual'
                                  then greatest(0, annual_utilized + v_delta) else annual_utilized end,
           contingency_utilized = case when v_pool = 'contingency'
                                  then greatest(0, contingency_utilized + v_delta) else contingency_utilized end
     where employee_id = new.employee_id and year = v_year;
  end if;

  return new;
end;
$$;
create trigger leave_requests_balances
  after update of status on public.leave_requests
  for each row execute function public.leave_requests_balance_bump();

-- 4. Optional-holiday cap: max 3 picks per employee per country+year.
create function public.optional_picks_max_three() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.optional_holiday_picks p
  join public.holidays h on h.id = p.holiday_id
  where p.employee_id = new.employee_id
    and h.country = (select country from public.holidays where id = new.holiday_id)
    and h.year    = (select year    from public.holidays where id = new.holiday_id);

  if v_count >= 3 then
    raise exception 'You can choose only 3 optional holidays per year';
  end if;
  return new;
end;
$$;
create trigger optional_picks_cap
  before insert on public.optional_holiday_picks
  for each row execute function public.optional_picks_max_three();

-- ---------- RLS ----------
alter table public.employees             enable row level security;
alter table public.leave_types           enable row level security;
alter table public.leave_requests        enable row level security;
alter table public.leave_balances        enable row level security;
alter table public.holidays              enable row level security;
alter table public.optional_holiday_picks enable row level security;
alter table public.separation_requests   enable row level security;

-- employees
-- Never select from a table inside its own RLS policy (postgres aborts
-- with 42P17 infinite recursion). All clauses below read only the candidate
-- row's columns plus SECURITY DEFINER helpers.
create policy employees_select on public.employees for select to authenticated
  using (
    auth_user_id = auth.uid()
    or manager_id = public.auth_employee_id()
    or id = public.auth_manager_id()
    or public.auth_system_role() = 'admin'
  );
create policy employees_update_self on public.employees for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- leave_types
create policy leave_types_select on public.leave_types for select to authenticated using (true);

-- leave_requests
create policy leave_requests_insert_self on public.leave_requests for insert to authenticated
  with check (employee_id = public.auth_employee_id());
create policy leave_requests_select on public.leave_requests for select to authenticated
  using (
    employee_id = public.auth_employee_id()
    or employee_id in (select id from public.employees where manager_id = public.auth_employee_id())
    or public.auth_system_role() = 'admin'
  );
create policy leave_requests_cancel_self on public.leave_requests for update to authenticated
  using (employee_id = public.auth_employee_id() and status = 'Pending')
  with check (employee_id = public.auth_employee_id() and status = 'Cancelled');
create policy leave_requests_decide on public.leave_requests for update to authenticated
  using (
    public.auth_system_role() = 'admin'
    or exists (
      select 1 from public.employees e
      where e.id = employee_id and e.manager_id = public.auth_employee_id()
    )
  )
  with check (
    public.auth_system_role() = 'admin'
    or exists (
      select 1 from public.employees e
      where e.id = employee_id and e.manager_id = public.auth_employee_id()
    )
  );

-- leave_balances (no user-facing writes; triggers run as definer)
create policy leave_balances_select on public.leave_balances for select to authenticated
  using (
    employee_id = public.auth_employee_id()
    or employee_id in (select id from public.employees where manager_id = public.auth_employee_id())
    or public.auth_system_role() = 'admin'
  );

-- holidays
create policy holidays_select on public.holidays for select to authenticated using (true);

-- optional_holiday_picks
create policy picks_select on public.optional_holiday_picks for select to authenticated
  using (employee_id = public.auth_employee_id());
create policy picks_insert on public.optional_holiday_picks for insert to authenticated
  with check (employee_id = public.auth_employee_id());
create policy picks_delete on public.optional_holiday_picks for delete to authenticated
  using (employee_id = public.auth_employee_id());

-- separation_requests
create policy separation_insert_self on public.separation_requests for insert to authenticated
  with check (employee_id = public.auth_employee_id());
create policy separation_select on public.separation_requests for select to authenticated
  using (
    employee_id = public.auth_employee_id()
    or public.auth_system_role() = 'admin'
  );
create policy separation_update_admin on public.separation_requests for update to authenticated
  using (public.auth_system_role() = 'admin')
  with check (public.auth_system_role() = 'admin');

-- ============================================================
-- Static reference data
-- ============================================================

insert into public.leave_types (name) values
  ('Paid Time Off'),
  ('Adoption'),
  ('Business Travel'),
  ('Compensatory Off'),
  ('Contingency Bucket'),
  ('Leave Without Pay'),
  ('Loss Of Pay'),
  ('My Special Day'),
  ('Optional Holiday'),
  ('Paternity Leave'),
  ('Voting Leave'),
  ('Work From Home');

insert into public.holidays (country, location, year, kind, holiday_date, name) values
  ('India', 'Bangalore', 2026, 'fixed', '2026-01-01', 'New Year''s Day'),
  ('India', 'Bangalore', 2026, 'fixed', '2026-01-14', 'Makara Sankranti'),
  ('India', 'Bangalore', 2026, 'fixed', '2026-01-26', 'Republic Day'),
  ('India', 'Bangalore', 2026, 'fixed', '2026-03-04', 'Holi'),
  ('India', 'Bangalore', 2026, 'fixed', '2026-03-20', 'Id-ul-Fitr (Ramzan)'),
  ('India', 'Bangalore', 2026, 'fixed', '2026-04-03', 'Good Friday'),
  ('India', 'Bangalore', 2026, 'fixed', '2026-04-14', 'Dr. B. R. Ambedkar Jayanti'),
  ('India', 'Bangalore', 2026, 'fixed', '2026-05-01', 'May Day (Labour Day)'),
  ('India', 'Bangalore', 2026, 'fixed', '2026-05-27', 'Bakrid / Eid-ul-Adha'),
  ('India', 'Bangalore', 2026, 'fixed', '2026-08-15', 'Independence Day'),
  ('India', 'Bangalore', 2026, 'fixed', '2026-09-14', 'Ganesh Chaturthi'),
  ('India', 'Bangalore', 2026, 'fixed', '2026-10-02', 'Gandhi Jayanti'),
  ('India', 'Bangalore', 2026, 'fixed', '2026-11-09', 'Diwali (Deepavali)'),
  ('India', 'Bangalore', 2026, 'fixed', '2026-12-25', 'Christmas'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-01-01', 'New Year''s Day'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-01-14', 'Makara Sankranti'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-01-26', 'Republic Day'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-03-04', 'Holi'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-03-20', 'Id-ul-Fitr (Ramzan)'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-03-27', 'Ugadi'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-04-03', 'Good Friday'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-04-14', 'Dr. B. R. Ambedkar Jayanti'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-05-01', 'May Day (Labour Day)'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-05-27', 'Bakrid / Eid-ul-Adha'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-08-15', 'Independence Day'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-09-14', 'Bathukamma Starting Day'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-10-02', 'Gandhi Jayanti'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-11-09', 'Diwali (Deepavali)'),
  ('India', 'Hyderabad', 2026, 'fixed', '2026-12-25', 'Christmas'),
  ('India', 'Chennai', 2026, 'fixed', '2026-01-01', 'New Year''s Day'),
  ('India', 'Chennai', 2026, 'fixed', '2026-01-15', 'Pongal'),
  ('India', 'Chennai', 2026, 'fixed', '2026-01-16', 'Thiruvalluvar Day'),
  ('India', 'Chennai', 2026, 'fixed', '2026-01-26', 'Republic Day'),
  ('India', 'Chennai', 2026, 'fixed', '2026-04-01', 'Tamil New Year’s Eve'),
  ('India', 'Chennai', 2026, 'fixed', '2026-04-03', 'Good Friday'),
  ('India', 'Chennai', 2026, 'fixed', '2026-04-14', 'Tamil New Year'),
  ('India', 'Chennai', 2026, 'fixed', '2026-05-01', 'May Day (Labour Day)'),
  ('India', 'Chennai', 2026, 'fixed', '2026-05-27', 'Bakrid / Eid-ul-Adha'),
  ('India', 'Chennai', 2026, 'fixed', '2026-08-15', 'Independence Day'),
  ('India', 'Chennai', 2026, 'fixed', '2026-10-02', 'Gandhi Jayanti'),
  ('India', 'Chennai', 2026, 'fixed', '2026-10-20', 'Ayudha Pooja / Vijayadashami'),
  ('India', 'Chennai', 2026, 'fixed', '2026-11-09', 'Diwali (Deepavali)'),
  ('India', 'Chennai', 2026, 'fixed', '2026-12-25', 'Christmas'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-01-01', 'New Year''s Day'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-01-14', 'Makara Sankranti'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-01-26', 'Republic Day'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-03-14', 'Holi'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-03-31', 'Id-ul-Fitr (Ramzan)'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-04-18', 'Good Friday'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-04-14', 'Dr. B. R. Ambedkar Jayanti'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-05-01', 'May Day (Labour Day)'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-06-07', 'Bakrid / Eid-ul-Adha'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-08-15', 'Independence Day'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-08-27', 'Ganesh Chaturthi'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-10-02', 'Gandhi Jayanti'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-10-21', 'Vijayadashami'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-10-21', 'Ayudha Pooja'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-11-01', 'Kannada Rajyotsava'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-10-20', 'Diwali (Deepavali)'),
  ('India', 'Bangalore', 2025, 'fixed', '2025-12-25', 'Christmas'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-01-01', 'New Year''s Day'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-01-14', 'Makara Sankranti'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-01-26', 'Republic Day'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-03-14', 'Holi'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-03-31', 'Id-ul-Fitr (Ramzan)'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-03-30', 'Ugadi'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-04-18', 'Good Friday'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-04-14', 'Dr. B. R. Ambedkar Jayanti'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-05-01', 'May Day (Labour Day)'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-06-07', 'Bakrid / Eid-ul-Adha'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-08-15', 'Independence Day'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-09-21', 'Bathukamma Starting Day'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-10-02', 'Gandhi Jayanti'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-10-21', 'Vijayadashami'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-10-20', 'Diwali (Deepavali)'),
  ('India', 'Hyderabad', 2025, 'fixed', '2025-12-25', 'Christmas'),
  ('India', 'Chennai', 2025, 'fixed', '2025-01-01', 'New Year''s Day'),
  ('India', 'Chennai', 2025, 'fixed', '2025-01-14', 'Pongal'),
  ('India', 'Chennai', 2025, 'fixed', '2025-01-15', 'Thiruvalluvar Day'),
  ('India', 'Chennai', 2025, 'fixed', '2025-01-26', 'Republic Day'),
  ('India', 'Chennai', 2025, 'fixed', '2025-04-14', 'Tamil New Year'),
  ('India', 'Chennai', 2025, 'fixed', '2025-04-18', 'Good Friday'),
  ('India', 'Chennai', 2025, 'fixed', '2025-05-01', 'May Day (Labour Day)'),
  ('India', 'Chennai', 2025, 'fixed', '2025-06-07', 'Bakrid / Eid-ul-Adha'),
  ('India', 'Chennai', 2025, 'fixed', '2025-08-15', 'Independence Day'),
  ('India', 'Chennai', 2025, 'fixed', '2025-10-02', 'Gandhi Jayanti'),
  ('India', 'Chennai', 2025, 'fixed', '2025-10-21', 'Ayudha Pooja'),
  ('India', 'Chennai', 2025, 'fixed', '2025-10-20', 'Diwali (Deepavali)'),
  ('India', 'Chennai', 2025, 'fixed', '2025-12-25', 'Christmas'),
  ('India', null, 2026, 'optional', '2026-02-15', 'Maha Shivaratri'),
  ('India', null, 2026, 'optional', '2026-03-19', 'Ugadi'),
  ('India', null, 2026, 'optional', '2026-04-02', 'Sri Rama Navami'),
  ('India', null, 2026, 'optional', '2026-04-06', 'Mahavir Jayanti'),
  ('India', null, 2026, 'optional', '2026-05-01', 'Basava Jayanti'),
  ('India', null, 2026, 'optional', '2026-08-28', 'Varalakshmi Vratham'),
  ('India', null, 2026, 'optional', '2026-08-28', 'Onam'),
  ('India', null, 2026, 'optional', '2026-09-04', 'Milad-un-Nabi'),
  ('India', null, 2026, 'optional', '2026-10-07', 'Mahanavami'),
  ('India', null, 2026, 'optional', '2026-11-14', 'Guru Nanak Jayanti'),
  ('India', null, 2025, 'optional', '2025-02-26', 'Maha Shivaratri'),
  ('India', null, 2025, 'optional', '2025-03-30', 'Ugadi'),
  ('India', null, 2025, 'optional', '2025-04-06', 'Sri Rama Navami'),
  ('India', null, 2025, 'optional', '2025-04-14', 'Mahavir Jayanti'),
  ('India', null, 2025, 'optional', '2025-05-12', 'Buddha Purnima'),
  ('India', null, 2025, 'optional', '2025-08-08', 'Varalakshmi Vratham'),
  ('India', null, 2025, 'optional', '2025-09-05', 'Onam'),
  ('India', null, 2025, 'optional', '2025-09-05', 'Milad-un-Nabi'),
  ('India', null, 2025, 'optional', '2025-10-07', 'Durgashtami'),
  ('India', null, 2025, 'optional', '2025-11-05', 'Guru Nanak Jayanti'),
  ('United States', 'Nashville, TN', 2026, 'fixed', '2026-01-01', 'New Year''s Day'),
  ('United States', 'Nashville, TN', 2026, 'fixed', '2026-01-19', 'Martin Luther King Jr. Day'),
  ('United States', 'Nashville, TN', 2026, 'fixed', '2026-05-25', 'Memorial Day'),
  ('United States', 'Nashville, TN', 2026, 'fixed', '2026-06-19', 'Juneteenth'),
  ('United States', 'Nashville, TN', 2026, 'fixed', '2026-07-03', 'Independence Day (observed)'),
  ('United States', 'Nashville, TN', 2026, 'fixed', '2026-09-07', 'Labor Day'),
  ('United States', 'Nashville, TN', 2026, 'fixed', '2026-11-26', 'Thanksgiving Day'),
  ('United States', 'Nashville, TN', 2026, 'fixed', '2026-11-27', 'Day after Thanksgiving'),
  ('United States', 'Nashville, TN', 2026, 'fixed', '2026-12-25', 'Christmas Day'),
  ('United States', 'Nashville, TN', 2025, 'fixed', '2025-01-01', 'New Year''s Day'),
  ('United States', 'Nashville, TN', 2025, 'fixed', '2025-01-20', 'Martin Luther King Jr. Day'),
  ('United States', 'Nashville, TN', 2025, 'fixed', '2025-05-26', 'Memorial Day'),
  ('United States', 'Nashville, TN', 2025, 'fixed', '2025-06-19', 'Juneteenth'),
  ('United States', 'Nashville, TN', 2025, 'fixed', '2025-07-04', 'Independence Day'),
  ('United States', 'Nashville, TN', 2025, 'fixed', '2025-09-01', 'Labor Day'),
  ('United States', 'Nashville, TN', 2025, 'fixed', '2025-11-27', 'Thanksgiving Day'),
  ('United States', 'Nashville, TN', 2025, 'fixed', '2025-11-28', 'Day after Thanksgiving'),
  ('United States', 'Nashville, TN', 2025, 'fixed', '2025-12-25', 'Christmas Day'),
  ('United States', null, 2026, 'optional', '2026-12-24', 'Christmas Eve'),
  ('United States', null, 2026, 'optional', '2026-12-31', 'New Year''s Eve'),
  ('United States', null, 2026, 'optional', '2026-11-03', 'Election Day'),
  ('United States', null, 2026, 'optional', '2026-06-14', 'Flag Day'),
  ('United States', null, 2026, 'optional', '2026-02-02', 'Groundhog Day (floating)'),
  ('United States', null, 2026, 'optional', '2026-07-10', 'Floating Personal Day'),
  ('United States', null, 2026, 'optional', '2026-03-06', 'Employee Appreciation Day'),
  ('United States', null, 2026, 'optional', '2026-10-30', 'Floating Wellness Day'),
  ('United States', null, 2025, 'optional', '2025-12-24', 'Christmas Eve'),
  ('United States', null, 2025, 'optional', '2025-12-31', 'New Year''s Eve'),
  ('United States', null, 2025, 'optional', '2025-11-04', 'Election Day'),
  ('United States', null, 2025, 'optional', '2025-06-14', 'Flag Day'),
  ('United States', null, 2025, 'optional', '2025-07-03', 'Floating Personal Day'),
  ('United States', null, 2025, 'optional', '2025-10-31', 'Floating Wellness Day'),
  ('United States', null, 2025, 'optional', '2025-03-07', 'Employee Appreciation Day'),
  ('United States', null, 2025, 'optional', '2025-05-06', 'National Nurses Week Floating');
