
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui'
import { useAuth } from '../store/AuthContext'
import { TOAST_KIND } from '../constants'
import {
  adminCarryForward,
  fetchAdminEmployees,
  fetchLeavePolicies,
  fetchOrgRequests,
  fetchStaleRequests,
} from '../services/admin'
import { todayISO } from '../utils/dates'
import type {
  EmployeeAdminRow,
  LeavePolicyConfig,
  LeaveRequestSelectRow,
} from '../types/models'

type DashboardStats = {
  activeEmployees: number | null
  activeManagers: number | null
  pendingRequests: number | null
  staleRequests: number | null
}

const INITIAL_STATS: DashboardStats = {
  activeEmployees: null,
  activeManagers: null,
  pendingRequests: null,
  staleRequests: null,
}

const ADMIN_LINKS = [
  {
    title: 'Admin — Employees',
    description: 'Provision and manage employee accounts.',
    to: '/admin/employees',
    number: '01',
  },
  {
    title: 'Admin — Balances',
    description: 'Review and adjust employee leave balances.',
    to: '/admin/leave-policies',
    number: '02',
  },
  {
    title: 'Admin — Audit Logs',
    description: 'Review administrative activity and changes.',
    to: '/admin/audit-logs',
    number: '03',
  },
  {
    title: 'Admin — Stale & Nudges',
    description: 'Review overdue requests and send reminders.',
    to: '/admin/reminders',
    number: '04',
  },
]

function formatDate(value: string | null | undefined) {
  if (!value) return 'Date unavailable'

  const date = new Date(`${value.slice(0, 10)}T00:00:00`)

  if (Number.isNaN(date.getTime())) return 'Date unavailable'

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function AdminDashboard() {
  const { setToast } = useAuth()

  const [stats, setStats] = useState(INITIAL_STATS)
  const [policy, setPolicy] = useState<LeavePolicyConfig | null>(null)
  const [latestJoiners, setLatestJoiners] = useState<EmployeeAdminRow[]>([])
  const [runningCarryForward, setRunningCarryForward] = useState(false)

  useEffect(() => {
    let mounted = true

    const loadDashboard = async () => {
      try {
        const [
          employeesResult,
          managersResult,
          requestsResult,
          staleResult,
          policyResult,
          joinersResult,
        ] = await Promise.all([
          fetchAdminEmployees({ active: true, pageSize: 1 }),
          fetchAdminEmployees({ role: 'manager', active: true, pageSize: 1 }),
          fetchOrgRequests(),
          fetchStaleRequests(todayISO()),
          fetchLeavePolicies(),
          fetchAdminEmployees({
            sort: 'doj',
            order: 'desc',
            pageSize: 5,
          }),
        ])

        if (!mounted) return

        if (employeesResult.error) {
          setToast(employeesResult.error.userMessage, TOAST_KIND.Error)
        }

        if (managersResult.error) {
          setToast(managersResult.error.userMessage, TOAST_KIND.Error)
        }

        if (requestsResult.error) {
          setToast(requestsResult.error.userMessage, TOAST_KIND.Error)
        }

        if (staleResult.error) {
          setToast(staleResult.error.userMessage, TOAST_KIND.Error)
        }

        if (policyResult.error) {
          setToast(policyResult.error.userMessage, TOAST_KIND.Error)
        }

        if (joinersResult.error) {
          setToast(joinersResult.error.userMessage, TOAST_KIND.Error)
        }

        setStats({
          activeEmployees: employeesResult.error
            ? null
            : employeesResult.page.total,

          activeManagers: managersResult.error
            ? null
            : managersResult.page.total,

          pendingRequests: requestsResult.error
            ? null
            : requestsResult.rows.filter(
                (row: LeaveRequestSelectRow) => row.status === 'Pending'
              ).length,

          staleRequests: staleResult.error
            ? null
            : staleResult.page.total,
        })

        if (!policyResult.error) {
          setPolicy(policyResult.config)
        }

        if (!joinersResult.error) {
          setLatestJoiners(joinersResult.page.rows)
        }
      } catch {
        if (mounted) {
          setToast(
            'Unable to load some dashboard information.',
            TOAST_KIND.Error
          )
        }
      }
    }

    void loadDashboard()

    return () => {
      mounted = false
    }
  }, [setToast])

  const previousYear = new Date().getFullYear() - 1

  const runCarryForward = async () => {
    if (runningCarryForward) return

    setRunningCarryForward(true)

    try {
      const { summary, error } = await adminCarryForward(previousYear)

      if (error) {
        setToast(error.userMessage, TOAST_KIND.Error)
      } else if (summary) {
        setToast(
          `Carry-forward for ${summary.source_year} done · ${summary.employees} employees`,
          TOAST_KIND.Ok
        )
      }
    } catch {
      setToast(
        'The carry-forward run could not be confirmed. Check audit logs before rerunning.',
        TOAST_KIND.Error
      )
    } finally {
      setRunningCarryForward(false)
    }
  }

  return (
    <div className="page admin-console">

      {/* Dashboard heading */}
      <section className="admin-console__intro">
        <div>
          <span className="admin-console__eyebrow">
            ADMINISTRATION / CONTROL CENTER
          </span>

          <h1>The operating floor</h1>

          <p>
            Provision people, keep the allocation ledger honest and keep
            manager queues moving.
          </p>
        </div>

        <span className="admin-console__date">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </section>

      {/* KPI cards */}
      <section className="admin-console__stats">

        <article className="admin-console__stat">
          <span className="admin-console__stat-label">
            ACTIVE DIRECTORY HEADCOUNT
          </span>
          <strong>
            {stats.activeEmployees ?? '—'}
          </strong>
          <span className="admin-console__stat-note">
            Active employee accounts
          </span>
        </article>

        <article className="admin-console__stat">
          <span className="admin-console__stat-label">
            ACTIVE MANAGERS
          </span>
          <strong>
            {stats.activeManagers ?? '—'}
          </strong>
          <span className="admin-console__stat-note">
            Active manager accounts
          </span>
        </article>

        <article className="admin-console__stat">
          <span className="admin-console__stat-label">
            LEAVE REQUESTS PENDING
          </span>
          <strong>
            {stats.pendingRequests ?? '—'}
          </strong>
          <span className="admin-console__stat-note">
            Awaiting review
          </span>
        </article>

        <article className="admin-console__stat">
          <span className="admin-console__stat-label">
            CARRY-FORWARD ALLOWANCE
          </span>
          <strong>
            {policy ? `${policy.carry_forward_max}` : '—'}
          </strong>
          <span className="admin-console__stat-note">
            Maximum annual days carried forward
          </span>
        </article>

      </section>

      {/* Main dashboard columns */}
      <section className="admin-console__workspace">

        {/* Operator moves */}
        <article className="card admin-console__panel">
          <div className="admin-console__panel-heading">
            <div>
              <span className="admin-console__eyebrow">
                QUICK ACCESS
              </span>
              <h2>Operator Moves</h2>
              <p>Navigate directly to administrative workspaces.</p>
            </div>
            <span className="admin-console__panel-count">05</span>
          </div>

          <div className="admin-console__links">
            {ADMIN_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="admin-console__link"
              >
                <span className="admin-console__link-number">
                  {item.number}
                </span>

                <span className="admin-console__link-content">
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>

                <span className="admin-console__link-arrow">
                  →
                </span>
              </Link>
            ))}
          </div>
        </article>

        {/* Watchlist */}
        <article className="card admin-console__panel">
          <div className="admin-console__panel-heading">
            <div>
              <span className="admin-console__eyebrow">
                NEEDS ATTENTION
              </span>
              <h2>Watchlist</h2>
              <p>Items that may require administrative action.</p>
            </div>
          </div>

          <div className="admin-console__watchlist">

            <div className="admin-console__watch-item">
              <span className="admin-console__watch-indicator admin-console__watch-indicator--warning" />

              <div>
                <strong>Past-dated pending requests</strong>
                <small>Requests requiring stale review</small>
              </div>

              <b>{stats.staleRequests ?? '—'}</b>
            </div>

            <div className="admin-console__watch-item">
              <span className="admin-console__watch-indicator admin-console__watch-indicator--info" />

              <div>
                <strong>Pending leave requests</strong>
                <small>Requests awaiting a decision</small>
              </div>

              <b>{stats.pendingRequests ?? '—'}</b>
            </div>

            <Link
              to="/admin/reminders"
              className="admin-console__watch-link"
            >
              Review stale requests <span>→</span>
            </Link>

          </div>

          <div className="admin-console__rollover">
            <div>
              <span className="admin-console__eyebrow">
                YEAR-END OPERATION
              </span>
              <h3>Carry-forward</h3>
              <p>
                Move eligible unused annual leave from {previousYear} into{' '}
                {previousYear + 1} opening balances. The operation runs once
                per year-end.
              </p>
            </div>

            <Button
              variant="primary"
              onClick={runCarryForward}
              busy={runningCarryForward}
              busyLabel="Running..."
            >
              Run carry-forward
            </Button>
          </div>
        </article>

      </section>

      {/* Latest joiners */}
      <section className="card admin-console__directory">

        <div className="admin-console__panel-heading">
          <div>
            <span className="admin-console__eyebrow">
              PEOPLE DIRECTORY
            </span>
            <h2>Latest Joiners</h2>
            <p>Employees with the most recent dates of joining.</p>
          </div>

          <Link
            to="/admin/employees"
            className="admin-console__directory-link"
          >
            View all employees →
          </Link>
        </div>

        <div className="admin-console__employee-list">

          {latestJoiners.length === 0 ? (
            <div className="admin-console__empty">
              No employee records available.
            </div>
          ) : (
            latestJoiners.map((employee) => (
              <div
                className="admin-console__employee"
                key={employee.id}
              >
                <span className="admin-console__avatar">
                  {employee.initials ||
                    employee.full_name
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                </span>

                <div className="admin-console__employee-info">
                  <strong>{employee.full_name}</strong>
                  <small>
                    {employee.emp_no}
                    {employee.job_title
                      ? ` · ${employee.job_title}`
                      : ''}
                  </small>
                </div>

                <span className="admin-console__employee-role">
                  {employee.system_role}
                </span>

                <span className="admin-console__employee-date">
                  {formatDate(employee.doj)}
                </span>
              </div>
            ))
          )}

        </div>
      </section>

    </div>
  )
}
