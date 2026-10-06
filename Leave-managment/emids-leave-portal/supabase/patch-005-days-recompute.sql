-- ============================================================
-- patch-005: server-side days recomputation for leave_requests
--
-- The client-sent `days` is no longer trusted. A BEFORE INSERT
-- trigger recomputes working days from start_date / end_date:
--   * counts weekdays (Mon–Fri) in the range, inclusive
--   * First Half / Second Half mode → count * 0.5
--   * zero working days (weekend-only range) → rejected with a
--     readable message, as a check_violation
--
-- Same JWT-session guard as patch-003: inserts from the SQL
-- editor / seed.sql run with no auth.uid() and keep their own
-- `days` (seed stores a few verbatim historical rows that do not
-- follow the workday rule). Real API inserts always recompute.
--
-- Run once in Supabase Studio (SQL Editor). Safe to re-run.
-- ============================================================

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
