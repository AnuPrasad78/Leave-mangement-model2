-- ============================================================
-- Emids Leave Portal — demo seed data
-- Run AFTER supabase/schema.sql. Order vs scripts/seed-users.mjs
-- does not matter: if the auth users don't exist yet, this file
-- creates the employee rows without them, and the profile trigger
-- binds auth users by email once the script runs.
-- Safe to re-run: upserts / conflicts are handled.
-- ============================================================

-- ---------- Managers ----------
insert into public.employees
  (emp_no, full_name, initials, email, job_title, doj, account, project_name, function_name, delivery_partner_name, location, system_role)
values
  ('EM-20762', 'Vootkuri Sai Nithin Reddy', 'VS', 'sai.nithinreddy@emids.com', 'Associate Consultant', '2025-07-21', 'HUMANA',
   'HUMANA - CenterWell Consent & Preferences Phase 2', 'Engineering · Digital Platforms', 'Arumugam Thiraviam', 'Bangalore, IN', 'manager')
on conflict (email) do update
  set emp_no                = excluded.emp_no,
      full_name             = excluded.full_name,
      initials              = excluded.initials,
      job_title             = excluded.job_title,
      doj                   = excluded.doj,
      account               = excluded.account,
      project_name          = excluded.project_name,
      function_name         = excluded.function_name,
      delivery_partner_name = excluded.delivery_partner_name,
      location              = excluded.location,
      system_role           = excluded.system_role;

insert into public.employees
  (full_name, initials, email, job_title, account, project_name, function_name, location, system_role)
values
  ('Sandeep Venkatesh Kamath', 'SK', 'sandeep.venkateshkamath@emids.com', 'Delivery Manager', 'HUMANA',
   'HUMANA - CenterWell Consent & Preferences Phase 2', 'Engineering · Digital Platforms', 'Bangalore, IN', 'manager')
on conflict (email) do update
  set full_name             = excluded.full_name,
      initials              = excluded.initials,
      job_title             = excluded.job_title,
      account               = excluded.account,
      project_name          = excluded.project_name,
      function_name         = excluded.function_name,
      location              = excluded.location,
      system_role           = excluded.system_role;

-- ---------- Sai's direct reports (the team queue) ----------
insert into public.employees
  (emp_no, full_name, initials, email, job_title, doj, account, project_name, function_name, manager_id, delivery_partner_name, location, system_role)
values
  ('EM-20810', 'Vikram Deshmukh', 'VD', 'vikram.deshmukh@emids.com', 'Associate Consultant', '2025-06-02',  'HUMANA', 'HUMANA - CenterWell Consent & Preferences Phase 2', 'Engineering · Digital Platforms', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), 'Arumugam Thiraviam', 'Bangalore, IN', 'employee'),
  ('EM-20754', 'Meera Krishnan',  'MK', 'meera.krishnan@emids.com',  'Consultant',           '2024-11-18', 'HUMANA', 'HUMANA - CenterWell Consent & Preferences Phase 2', 'Engineering · Digital Platforms', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), 'Arumugam Thiraviam', 'Bangalore, IN', 'employee'),
  ('EM-21190', 'Sahil Bhatnagar', 'SB', 'sahil.bhatnagar@emids.com', 'Associate Consultant', '2026-02-09', 'HUMANA', 'HUMANA - CenterWell Consent & Preferences Phase 2', 'Engineering · Digital Platforms', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), 'Arumugam Thiraviam', 'Bangalore, IN', 'employee'),
  ('EM-20988', 'Nandini Sharma',  'NS', 'nandini.sharma@emids.com',  'Consultant',           '2025-04-21', 'HUMANA', 'HUMANA - CenterWell Consent & Preferences Phase 2', 'Engineering · Digital Platforms', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), 'Arumugam Thiraviam', 'Bangalore, IN', 'employee'),
  ('EM-20867', 'Rahul Iyer',      'RI', 'rahul.iyer@emids.com',      'Consultant',           '2025-01-13', 'HUMANA', 'HUMANA - CenterWell Consent & Preferences Phase 2', 'Engineering · Digital Platforms', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), 'Arumugam Thiraviam', 'Bangalore, IN', 'employee'),
  ('EM-21034', 'Divya Menon',     'DM', 'divya.menon@emids.com',     'Associate Consultant', '2025-10-06', 'HUMANA', 'HUMANA - CenterWell Consent & Preferences Phase 2', 'Engineering · Digital Platforms', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), 'Arumugam Thiraviam', 'Bangalore, IN', 'employee'),
  ('EM-20902', 'Karthik Suresh',  'KS', 'karthik.suresh@emids.com',  'Consultant',           '2025-03-24', 'HUMANA', 'HUMANA - CenterWell Consent & Preferences Phase 2', 'Engineering · Digital Platforms', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), 'Arumugam Thiraviam', 'Bangalore, IN', 'employee'),
  ('EM-21111', 'Priya Balan',     'PB', 'priya.balan@emids.com',     'Associate Consultant', '2026-01-12', 'HUMANA', 'HUMANA - CenterWell Consent & Preferences Phase 2', 'Engineering · Digital Platforms', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), 'Arumugam Thiraviam', 'Bangalore, IN', 'employee'),
  ('EM-20761', 'Ananya Rao',      'AR', 'ananya.rao@emids.com',      'Associate Consultant', '2025-08-11', 'HUMANA', 'HUMANA - CenterWell Consent & Preferences Phase 2', 'Engineering · Digital Platforms', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), 'Arumugam Thiraviam', 'Bangalore, IN', 'employee')
on conflict (emp_no) do update
  set full_name            = excluded.full_name,
      initials             = excluded.initials,
      email                = excluded.email,
      job_title            = excluded.job_title,
      doj                  = excluded.doj,
      account              = excluded.account,
      project_name         = excluded.project_name,
      function_name        = excluded.function_name,
      manager_id           = excluded.manager_id,
      delivery_partner_name = excluded.delivery_partner_name,
      location             = excluded.location,
      system_role          = excluded.system_role;

-- ---------- Sai's own requests (verbatim from the mock; all Approved) ----------
insert into public.leave_requests
  (request_no, employee_id, leave_type_id, start_date, end_date, days, mode, reason, status, requested_on)
values
  ('LV-10241', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), (select id from public.leave_types where name = 'Paid Time Off'),      '2026-05-18', '2026-05-22', 5.0, 'Full Day',    'Annual family trip to Coorg',                  'Approved', '2026-04-28'),
  ('LV-10189', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), (select id from public.leave_types where name = 'Compensatory Off'),   '2026-05-09', '2026-05-09', 1.0, 'Full Day',    'Comp off for UAT release weekend',             'Approved', '2026-05-08'),
  ('LV-10170', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), (select id from public.leave_types where name = 'Work From Home'),     '2026-04-27', '2026-04-28', 2.0, 'Full Day',    'Home internet maintenance — remote setup',     'Approved', '2026-04-22'),
  ('LV-10122', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), (select id from public.leave_types where name = 'Business Travel'),    '2026-03-10', '2026-03-12', 3.0, 'Full Day',    'CenterWell C&P sprint planning onsite',        'Approved', '2026-02-26'),
  ('LV-10098', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), (select id from public.leave_types where name = 'Paid Time Off'),      '2026-02-16', '2026-02-17', 2.0, 'Full Day',    'Sister’s engagement ceremony',                 'Approved', '2026-02-05'),
  ('LV-10051', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), (select id from public.leave_types where name = 'Paternity Leave'),    '2025-11-24', '2025-12-05', 10.0, 'Full Day',   'Paternity leave — newborn care',               'Approved', '2025-11-10'),
  ('LV-10040', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), (select id from public.leave_types where name = 'Work From Home'),     '2025-10-30', '2025-10-30', 1.0, 'Second Half', 'Apartment association meeting',                'Approved', '2025-10-27'),
  ('LV-10012', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), (select id from public.leave_types where name = 'My Special Day'),     '2025-09-05', '2025-09-05', 1.0, 'Full Day',    'Birthday — family day out',                    'Approved', '2025-08-29'),
  ('LV-10003', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), (select id from public.leave_types where name = 'Optional Holiday'),   '2025-08-15', '2025-08-15', 1.0, 'Full Day',    'Independence Day — campus event',              'Approved', '2025-08-08'),
  ('LV-09988', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), (select id from public.leave_types where name = 'Voting Leave'),       '2025-05-10', '2025-05-10', 1.0, 'Full Day',    'Assembly elections — voting duty',             'Approved', '2025-05-05')
on conflict (request_no) do nothing;

-- ---------- Team queue requests (verbatim from the mock) ----------
insert into public.leave_requests
  (request_no, employee_id, leave_type_id, start_date, end_date, days, mode, reason, status, approver_id, decided_at, requested_on)
values
  ('LV-10315', (select id from public.employees where emp_no = 'EM-20761'), (select id from public.leave_types where name = 'Paid Time Off'),       '2026-10-12', '2026-10-16', 5.0, 'Full Day', 'Wedding leave — family function in Mangalore',    'Pending', null, null, '2026-09-28'),
  ('LV-10314', (select id from public.employees where emp_no = 'EM-20810'), (select id from public.leave_types where name = 'Work From Home'),      '2026-10-05', '2026-10-06', 2.0, 'Full Day', 'Physiotherapy sessions — travel constrained',     'Pending', null, null, '2026-09-29'),
  ('LV-10313', (select id from public.employees where emp_no = 'EM-20754'), (select id from public.leave_types where name = 'Compensatory Off'),    '2026-10-09', '2026-10-09', 1.0, 'Full Day', 'Comp off — CenterWell go-live night shift',       'Pending', null, null, '2026-09-30'),
  ('LV-10312', (select id from public.employees where emp_no = 'EM-21190'), (select id from public.leave_types where name = 'Optional Holiday'),    '2026-10-21', '2026-10-21', 1.0, 'Full Day', 'Diwali travel to Jaipur',                         'Pending', null, null, '2026-09-29'),
  ('LV-10311', (select id from public.employees where emp_no = 'EM-20988'), (select id from public.leave_types where name = 'Paid Time Off'),       '2026-10-27', '2026-10-30', 4.0, 'Full Day', 'Family relocation Support',                       'Pending', null, null, '2026-09-30'),
  ('LV-10305', (select id from public.employees where emp_no = 'EM-20867'), (select id from public.leave_types where name = 'Business Travel'),     '2026-10-13', '2026-10-15', 3.0, 'Full Day', 'Client onsite — Humana Louisville visit',         'Approved', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), '2026-09-25 04:30:00+00', '2026-09-24'),
  ('LV-10298', (select id from public.employees where emp_no = 'EM-21034'), (select id from public.leave_types where name = 'Paid Time Off'),       '2026-09-21', '2026-09-23', 3.0, 'Full Day', 'Onam — trip with parents',                        'Approved', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), '2026-09-11 04:30:00+00', '2026-09-10'),
  ('LV-10290', (select id from public.employees where emp_no = 'EM-20902'), (select id from public.leave_types where name = 'Leave Without Pay'),   '2026-09-02', '2026-09-04', 3.0, 'Full Day', 'Extended trip beyond leave balance',              'Rejected', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), '2026-08-21 04:30:00+00', '2026-08-20'),
  ('LV-10286', (select id from public.employees where emp_no = 'EM-21111'), (select id from public.leave_types where name = 'Work From Home'),      '2026-08-19', '2026-08-20', 2.0, 'Full Day', 'Monsoon advisory — work from home',               'Approved', (select id from public.employees where email = 'sai.nithinreddy@emids.com'), '2026-08-15 04:30:00+00', '2026-08-14')
on conflict (request_no) do nothing;

-- ---------- Balances (stored snapshot numbers, not derived from requests) ----------
insert into public.leave_balances
  (employee_id, year, opening_annual, annual_credited, annual_utilized, contingency_credited, contingency_utilized)
values
  ((select id from public.employees where email = 'sai.nithinreddy@emids.com'),      2026, 4.25, 18.00, 11.25, 10.00, 6.00),
  ((select id from public.employees where email = 'sai.nithinreddy@emids.com'),      2025, 0,    18.00, 0,     10.00, 0),
  ((select id from public.employees where email = 'sandeep.venkateshkamath@emids.com'), 2026, 0, 18.00, 0,     10.00, 0)
on conflict (employee_id, year) do update
  set opening_annual       = excluded.opening_annual,
      annual_credited      = excluded.annual_credited,
      annual_utilized      = excluded.annual_utilized,
      contingency_credited = excluded.contingency_credited,
      contingency_utilized = excluded.contingency_utilized;
