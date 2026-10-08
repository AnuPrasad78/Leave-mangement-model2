-- Patch 003 — restore the self-referencing FK on employees.manager_id.
--
-- The profile menu fetches the manager with a self-join
-- (`manager:employees ( full_name )`). PostgREST resolves that embed only
-- through a foreign key between employees and employees; while the constraint
-- is missing on the hosted project, the embed silently degrades to an empty
-- array and the Manager field renders as "—".
--
-- Adds the constraint ONLY when no employees -> employees FK exists (avoids
-- duplicate constraints, which would also re-ambiguate embeds), then reloads
-- the PostgREST schema cache. Safe to re-run.

do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conrelid  = 'public.employees'::regclass
       and confrelid = 'public.employees'::regclass
       and contype   = 'f'
  ) then
    alter table public.employees
      add constraint employees_manager_id_fkey
      foreign key (manager_id) references public.employees (id) on delete set null;
  end if;
end $$;

create index if not exists employees_manager_id_idx on public.employees (manager_id);

-- Make PostgREST rebuild its schema cache so the embed resolves immediately.
notify pgrst, 'reload schema';
