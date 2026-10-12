-- Patch 001 — bind auth users to employee rows that already exist
-- Apply if supabase/schema.sql was run before 2026-10-05 (its profile-creation
-- trigger crashed when an employee row with the same email was already seeded).
-- Safe to run once; replaces the function body in place.

create or replace function public.handle_new_user() returns trigger
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
