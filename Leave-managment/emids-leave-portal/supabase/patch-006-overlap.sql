-- ============================================================
-- patch-006: one live request per employee per date range
--
-- EXCLUDE constraint: an employee cannot have two requests with
-- status Pending/Approved that share any date. Cancelling (or a
-- rejection) frees the range immediately. Uses btree_gist so the
-- employee_id equality runs alongside the daterange test.
--
-- If ADD CONSTRAINT fails naming existing rows, resolve those
-- overlaps first — the constraint checks historical data at
-- creation time.
--
-- Inclusive '[]' bounds: the day AFTER an approved leave (range
-- starting at end_date + 1) never conflicts, but sharing the end
-- date itself does.
--
-- Run once in Supabase Studio (SQL Editor). Safe to re-run.
-- ============================================================

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
end $$;
