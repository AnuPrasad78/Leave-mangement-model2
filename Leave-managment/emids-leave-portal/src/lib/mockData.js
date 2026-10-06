// Seed data for the in-browser mock store. Mirrors seed.sql (staff, requests,
// balances) and schema.sql (leave_types). Rows use real column names so read
// projections map 1:1 with the REST shape. One deliberate drift from seed.sql:
// Sai reports to Sandeep here, so the submission-notification trigger has a
// manager to notify. Holidays live in mockHolidays.js (schema.sql verbatim).
import { HOLIDAYS } from './mockHolidays'

export const USERS = [
  { uid: 'u-sai', email: 'sai.nithinreddy@emids.com', password: 'Portal@2026' },
  { uid: 'u-sandeep', email: 'sandeep.venkateshkamath@emids.com', password: 'Portal@2026' },
]

const STAFF = ['HUMANA', 'HUMANA - CenterWell Consent & Preferences Phase 2', 'Engineering · Digital Platforms', 'Arumugam Thiraviam', 'Bangalore, IN']
// [id, emp_no, name, initials, email, job_title, doj, managerId, systemRole, authUid]
const EMPLOYEE_TUPLES = [
  ['E1', 'EM-20762', 'Vootkuri Sai Nithin Reddy', 'VS', 'sai.nithinreddy@emids.com', 'Associate Consultant', '2025-07-21', 'E2', 'manager', 'u-sai'],
  ['E2', 'EM-30000', 'Sandeep Venkatesh Kamath', 'SK', 'sandeep.venkateshkamath@emids.com', 'Delivery Manager', null, null, 'manager', 'u-sandeep'],
  ['E3', 'EM-20810', 'Vikram Deshmukh', 'VD', 'vikram.deshmukh@emids.com', 'Associate Consultant', '2025-06-02', 'E1', 'employee', null],
  ['E4', 'EM-20754', 'Meera Krishnan', 'MK', 'meera.krishnan@emids.com', 'Consultant', '2024-11-18', 'E1', 'employee', null],
  ['E5', 'EM-21190', 'Sahil Bhatnagar', 'SB', 'sahil.bhatnagar@emids.com', 'Associate Consultant', '2026-02-09', 'E1', 'employee', null],
  ['E6', 'EM-20988', 'Nandini Sharma', 'NS', 'nandini.sharma@emids.com', 'Consultant', '2025-04-21', 'E1', 'employee', null],
  ['E7', 'EM-20867', 'Rahul Iyer', 'RI', 'rahul.iyer@emids.com', 'Consultant', '2025-01-13', 'E1', 'employee', null],
  ['E8', 'EM-21034', 'Divya Menon', 'DM', 'divya.menon@emids.com', 'Associate Consultant', '2025-10-06', 'E1', 'employee', null],
  ['E9', 'EM-20902', 'Karthik Suresh', 'KS', 'karthik.suresh@emids.com', 'Consultant', '2025-03-24', 'E1', 'employee', null],
  ['E10', 'EM-21111', 'Priya Balan', 'PB', 'priya.balan@emids.com', 'Associate Consultant', '2026-01-12', 'E1', 'employee', null],
  ['E11', 'EM-20761', 'Ananya Rao', 'AR', 'ananya.rao@emids.com', 'Associate Consultant', '2025-08-11', 'E1', 'employee', null],
]

export const EMPLOYEES = EMPLOYEE_TUPLES.map(([id, emp_no, full_name, initials, email, job_title, doj, manager_id, system_role, auth_user_id]) => ({
  id, emp_no, full_name, initials, email, job_title, doj,
  account: STAFF[0], project_name: STAFF[1], function_name: STAFF[2],
  delivery_partner_name: id === 'E2' ? null : STAFF[3],
  location: STAFF[4], system_role, manager_id, auth_user_id,
  created_at: doj ? `${doj}T04:30:00Z` : '2024-06-01T04:30:00Z',
}))

export const LEAVE_TYPES = [
  'Paid Time Off', 'Adoption', 'Business Travel', 'Compensatory Off', 'Contingency Bucket',
  'Leave Without Pay', 'Loss Of Pay', 'My Special Day', 'Optional Holiday', 'Paternity Leave',
  'Voting Leave', 'Work From Home',
].map((name, i) => ({ id: i + 1, name, is_active: true }))

// [id, request_no, employee_id, type, start, end, days, mode, reason, status, approver_id, decided_at, requested_on]
const REQUEST_TUPLES = [
  [1, 'LV-09988', 'E1', 'Voting Leave', '2025-05-10', '2025-05-10', 1, 'Full Day', 'Assembly elections — voting duty', 'Approved', null, null, '2025-05-05'],
  [2, 'LV-10003', 'E1', 'Optional Holiday', '2025-08-15', '2025-08-15', 1, 'Full Day', 'Independence Day — campus event', 'Approved', null, null, '2025-08-08'],
  [3, 'LV-10012', 'E1', 'My Special Day', '2025-09-05', '2025-09-05', 1, 'Full Day', 'Birthday — family day out', 'Approved', null, null, '2025-08-29'],
  [4, 'LV-10040', 'E1', 'Work From Home', '2025-10-30', '2025-10-30', 1, 'Second Half', 'Apartment association meeting', 'Approved', null, null, '2025-10-27'],
  [5, 'LV-10051', 'E1', 'Paternity Leave', '2025-11-24', '2025-12-05', 10, 'Full Day', 'Paternity leave — newborn care', 'Approved', null, null, '2025-11-10'],
  [6, 'LV-10098', 'E1', 'Paid Time Off', '2026-02-16', '2026-02-17', 2, 'Full Day', 'Sister’s engagement ceremony', 'Approved', null, null, '2026-02-05'],
  [7, 'LV-10122', 'E1', 'Business Travel', '2026-03-10', '2026-03-12', 3, 'Full Day', 'CenterWell C&P sprint planning onsite', 'Approved', null, null, '2026-02-26'],
  [8, 'LV-10170', 'E1', 'Work From Home', '2026-04-27', '2026-04-28', 2, 'Full Day', 'Home internet maintenance — remote setup', 'Approved', null, null, '2026-04-22'],
  [9, 'LV-10189', 'E1', 'Compensatory Off', '2026-05-09', '2026-05-09', 1, 'Full Day', 'Comp off for UAT release weekend', 'Approved', null, null, '2026-05-08'],
  [10, 'LV-10241', 'E1', 'Paid Time Off', '2026-05-18', '2026-05-22', 5, 'Full Day', 'Annual family trip to Coorg', 'Approved', null, null, '2026-04-28'],
  [11, 'LV-10286', 'E10', 'Work From Home', '2026-08-19', '2026-08-20', 2, 'Full Day', 'Monsoon advisory — work from home', 'Approved', 'E1', '2026-08-15T04:30:00Z', '2026-08-14'],
  [12, 'LV-10290', 'E9', 'Leave Without Pay', '2026-09-02', '2026-09-04', 3, 'Full Day', 'Extended trip beyond leave balance', 'Rejected', 'E1', '2026-08-21T04:30:00Z', '2026-08-20'],
  [13, 'LV-10298', 'E8', 'Paid Time Off', '2026-09-21', '2026-09-23', 3, 'Full Day', 'Onam — trip with parents', 'Approved', 'E1', '2026-09-11T04:30:00Z', '2026-09-10'],
  [14, 'LV-10305', 'E7', 'Business Travel', '2026-10-13', '2026-10-15', 3, 'Full Day', 'Client onsite — Humana Louisville visit', 'Approved', 'E1', '2026-09-25T04:30:00Z', '2026-09-24'],
  [15, 'LV-10311', 'E6', 'Paid Time Off', '2026-10-27', '2026-10-30', 4, 'Full Day', 'Family relocation Support', 'Pending', null, null, '2026-09-30'],
  [16, 'LV-10312', 'E5', 'Optional Holiday', '2026-10-21', '2026-10-21', 1, 'Full Day', 'Diwali travel to Jaipur', 'Pending', null, null, '2026-09-29'],
  [17, 'LV-10313', 'E4', 'Compensatory Off', '2026-10-09', '2026-10-09', 1, 'Full Day', 'Comp off — CenterWell go-live night shift', 'Pending', null, null, '2026-09-30'],
  [18, 'LV-10314', 'E3', 'Work From Home', '2026-10-05', '2026-10-06', 2, 'Full Day', 'Physiotherapy sessions — travel constrained', 'Pending', null, null, '2026-09-29'],
  [19, 'LV-10315', 'E11', 'Paid Time Off', '2026-10-12', '2026-10-16', 5, 'Full Day', 'Wedding leave — family function in Mangalore', 'Pending', null, null, '2026-09-28'],
]

export const LEAVE_REQUESTS = REQUEST_TUPLES.map(
  ([id, request_no, employee_id, leave_type, start_date, end_date, days, mode, reason, status, approver_id, decided_at, requested_on]) => ({
    id, request_no, employee_id,
    leave_type_id: typeId(leave_type),
    start_date, end_date, days, mode, reason, status, approver_id, decided_at, requested_on,
    created_at: `${requested_on}T04:30:00Z`,
  })
)

function typeId(name) {
  const t = LEAVE_TYPES.find((x) => x.name === name)
  return t ? t.id : 0
}

export const BALANCES = [
  { id: 1, employee_id: 'E1', year: 2026, opening_annual: 4.25, annual_credited: 18, annual_utilized: 11.25, contingency_credited: 10, contingency_utilized: 6, annual_cap: 18, contingency_cap: 10 },
  { id: 2, employee_id: 'E1', year: 2025, opening_annual: 0, annual_credited: 18, annual_utilized: 0, contingency_credited: 10, contingency_utilized: 0, annual_cap: 18, contingency_cap: 10 },
  { id: 3, employee_id: 'E2', year: 2026, opening_annual: 0, annual_credited: 18, annual_utilized: 0, contingency_credited: 10, contingency_utilized: 0, annual_cap: 18, contingency_cap: 10 },
]

export function buildStore() {
  return {
    employees: structuredClone(EMPLOYEES),
    leaveTypes: structuredClone(LEAVE_TYPES),
    holidays: structuredClone(HOLIDAYS),
    leaveRequests: structuredClone(LEAVE_REQUESTS),
    balances: structuredClone(BALANCES),
    picks: [],
    separations: [],
    notifications: [],
    seqRequestId: 10316, // schema.sql: leave_request_no_seq start 10316
    seqRowId: 10000,
    seqNotifId: 1,
    seqUserId: 1,
  }
}
