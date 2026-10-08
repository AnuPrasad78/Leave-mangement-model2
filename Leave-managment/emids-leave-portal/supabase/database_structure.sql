-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  emp_no text NOT NULL DEFAULT ('EM-'::text || lpad((nextval('emp_no_seq'::regclass))::text, 5, '0'::text)) UNIQUE,
  full_name text NOT NULL,
  initials text,
  email text NOT NULL UNIQUE,
  job_title text,
  doj date,
  account text,
  project_name text,
  function_name text,
  manager_id uuid,
  delivery_partner_name text,
  location text,
  system_role USER-DEFINED NOT NULL DEFAULT 'employee'::system_role,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT employees_pkey PRIMARY KEY (id),
  CONSTRAINT employees_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id),
  CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id)
);
CREATE TABLE public.leave_types (
  id smallint NOT NULL DEFAULT nextval('leave_types_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT leave_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.leave_requests (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  request_no text NOT NULL DEFAULT ('LV-'::text || lpad((nextval('leave_request_no_seq'::regclass))::text, 5, '0'::text)) UNIQUE,
  employee_id uuid NOT NULL,
  leave_type_id smallint NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days numeric NOT NULL CHECK (days > 0::numeric),
  mode USER-DEFINED NOT NULL DEFAULT 'Full Day'::leave_mode,
  reason text NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'Pending'::leave_status,
  approver_id uuid,
  decided_at timestamp with time zone,
  requested_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_pkey PRIMARY KEY (id),
  CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id),
  CONSTRAINT leave_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.employees(id)
);
CREATE TABLE public.leave_balances (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  employee_id uuid NOT NULL,
  year smallint NOT NULL CHECK (year >= 2000 AND year <= 2999),
  opening_annual numeric NOT NULL DEFAULT 0,
  annual_credited numeric NOT NULL DEFAULT 0,
  annual_utilized numeric NOT NULL DEFAULT 0,
  contingency_credited numeric NOT NULL DEFAULT 0,
  contingency_utilized numeric NOT NULL DEFAULT 0,
  annual_cap numeric NOT NULL DEFAULT 18,
  contingency_cap numeric NOT NULL DEFAULT 10,
  CONSTRAINT leave_balances_pkey PRIMARY KEY (id),
  CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.holidays (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  country text NOT NULL,
  location text,
  year smallint NOT NULL CHECK (year >= 2000 AND year <= 2999),
  kind text NOT NULL CHECK (kind = ANY (ARRAY['fixed'::text, 'optional'::text])),
  holiday_date date NOT NULL,
  name text NOT NULL,
  CONSTRAINT holidays_pkey PRIMARY KEY (id)
);
CREATE TABLE public.optional_holiday_picks (
  employee_id uuid NOT NULL,
  holiday_id bigint NOT NULL,
  picked_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT optional_holiday_picks_pkey PRIMARY KEY (employee_id, holiday_id),
  CONSTRAINT optional_holiday_picks_holiday_id_fkey FOREIGN KEY (holiday_id) REFERENCES public.holidays(id),
  CONSTRAINT optional_holiday_picks_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.separation_requests (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  employee_id uuid NOT NULL,
  last_working_day date NOT NULL,
  reason text NOT NULL CHECK (reason = ANY (ARRAY['Better Opportunity'::text, 'Higher Studies'::text, 'Personal Reasons'::text, 'Health Reasons'::text, 'Relocation'::text, 'Entrepreneurship'::text, 'Career Break'::text, 'Other'::text])),
  remarks text CHECK (char_length(remarks) <= 800),
  status USER-DEFINED NOT NULL DEFAULT 'Pending'::separation_status,
  reviewed_by uuid,
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT separation_requests_pkey PRIMARY KEY (id),
  CONSTRAINT separation_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT separation_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.employees(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recipient_employee_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['leave_pending_approval'::text, 'leave_approved'::text, 'leave_rejected'::text])),
  title text NOT NULL,
  body text NOT NULL,
  link text,
  related_leave_request_id bigint,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_recipient_employee_id_fkey FOREIGN KEY (recipient_employee_id) REFERENCES public.employees(id),
  CONSTRAINT notifications_related_leave_request_id_fkey FOREIGN KEY (related_leave_request_id) REFERENCES public.leave_requests(id)
);