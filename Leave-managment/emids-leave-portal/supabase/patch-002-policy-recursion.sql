-- patch-002: fix infinite recursion in employees_select (postgres 42P17).
--
-- The employees_select policy sub-queried the employees table from inside a
-- policy on that same table, which Postgres aborts with
-- "infinite recursion detected in policy for relation employees".
-- Every authenticated-row lookup (profile fetch, team lists, the leave
-- request insert) hit this, so nothing worked past sign-in.
--
-- Fix: no sub-selects inside policy expressions. Direct scope:
--   * the user's own row            -> auth_user_id = auth.uid()
--   * the user's direct report rows -> manager_id = auth_employee_id()
--   * the user's own manager row    -> id = auth_manager_id()   (new helper)
--   * admins                        -> auth_system_role() = 'admin'
--
-- Run once in Supabase Studio (SQL Editor). Safe to re-run.

create or replace function  public.auth_manager_id() returns uuid
language sql stable security definer set search_path = public as $$
  select manager_id from public.employees where auth_user_id = auth.uid()
$$;

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select to authenticated
  using (
    auth_user_id = auth.uid()
    or manager_id = public.auth_employee_id()
    or id = public.auth_manager_id()
    or public.auth_system_role() = 'admin'
  );
