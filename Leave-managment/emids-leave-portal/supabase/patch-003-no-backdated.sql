-- patch-003: block leave requests that start in the past.
--
-- BEFORE-INSERT trigger on leave_requests. The auth.uid() is not null guard
-- means only JWT sessions (i.e. the API) are checked — seed.sql inserts of
-- historical rows, which run outside a JWT session, still pass.
--
-- Run once in Supabase Studio (SQL Editor). Safe to re-run.

create or replace function public.leave_requests_no_backdated() returns trigger
language plpgsql stable set search_path = public as $$
begin
  if new.start_date < current_date and auth.uid() is not null then
    raise exception 'Leave cannot start in the past (start date %)', new.start_date
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger if not exists leave_requests_no_backdated
  before insert on public.leave_requests
  for each row execute function public.leave_requests_no_backdated();
