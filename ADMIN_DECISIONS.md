# Admin Persona — Decision Log

Recorded 2026-10-28 from the Q1–Q9 policy questions in `ADMIN_PERSONA_PLAN.md`. These are binding for the admin-persona implementation.

| Q | Decision |
|---|---|
| Q1 (attendance evidence) | **WFH + travel requests as proxy.** No attendance table. Stale-request review shows the employee's overlapping approved `Work From Home` / `Business Travel` requests plus holidays in the window as read-only context. |
| Q2a (proration method) | **Months worked / 12.** `annual = 22 × (months worked in year / 12)`, calendar months, the DOJ month counts as a worked month. Round to nearest 0.5 (Python `ROUND_HALF_UP` on a 0.5 grid). Contingency stays flat 10, never prorated. |
| Q2b (rounding) | **0.5-day grid** (matches `Numeric(5,2)` columns). |
| Q2c (eligibility) | No half-year rule; months-worked proration applies to everyone including year-1 joiners (their monthly fraction accumulates in their joining year). |
| Q2d (existing 18-credit rows) | **Grandfather.** Existing rows keep their credited values; prorated credit applies only to rows created on/after this change. Admin hand-corrects via the Phase-5 balance editor if needed. |
| Q3 (landing) | **Admins keep the shared Dashboard.** No redirect in `Login.tsx`; admin pages reached via nav. |
| Q4 (reset delivery) | **Admin-copied link.** Reset API returns the plaintext token / URL **once** in the response; admin shares it out-of-band. TTL 60 minutes, single-use. No email integration. |
| Q4b (reset while inactive) | **Blocked.** A deactivated user's live tokens can't be used; reactivate first. |
| Q5/Q6 (deactivation) | **Block login only** — `users.is_active = false`, no cascade, no auto reassignment. Reports and in-flight pending requests stay with the deactivated person; the admin reassigns managers via `PUT /admin/employees` and resolves pending requests from the org-wide stale/team views. |
| Q7 (notifications) | **Build DB-backed notifications.** New `notifications` table + `GET /notifications` read endpoint; decision and stale-review flows write rows for the affected employee (and their manager). |
| Q8 (carry-forward) | **Admin-triggered, strict.** `POST /admin/leave-requests/carry-forward {year}` refuses any year other than the previous year; idempotent; audited. No scheduler, no catch-up. |
| Q9 (optional holidays) | **Existing 3-picks mechanism stands.** Per-employee 3 optional-holiday picks per year (already DB-enforced) satisfies the requirement; no static admin-defined list. |

No further open questions. The plan phases follow `ADMIN_PERSONA_PLAN.md` §4 verbatim.
