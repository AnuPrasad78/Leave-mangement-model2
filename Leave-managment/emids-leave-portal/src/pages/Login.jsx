import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import logoLight from '../assets/emids-logo-light.svg'

const FEATURES = [
  {
    num: '01',
    title: 'Real-time leave balances',
    text: 'Annual, contingency and comp-off pools — credit, utilised and available, always current.',
  },
  {
    num: '02',
    title: 'One-click approvals',
    text: 'Review team time off in a single queue. Approve or reject with a full audit trail.',
  },
  {
    num: '03',
    title: 'Holiday planning built in',
    text: 'Fixed and optional holiday calendars across Emids locations. Pick your three, early.',
  },
]

export default function Login() {
  const { signIn, signedIn } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (signedIn) navigate('/dashboard', { replace: true })
  }, [signedIn, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const message = await signIn(email.trim(), password)
    if (message) setError(message)
    setBusy(false)
  }

  return (
    <div className="login">
      <section className="login__brand">
        <div>
          <img className="login__logo" src={logoLight} alt="Emids" />
          <div className="login__plate">Leave Management Portal</div>
        </div>

        <div>
          <h1 className="login__headline">
            Your time off, managed <em>with precision.</em>
          </h1>
          <div className="login__features">
            {FEATURES.map((f, i) => (
              <div className={`login__feature ${i === 0 ? 'login__feature--accent' : ''}`} key={f.num}>
                <div>
                  <span className="mono">{i + 1}/03 · {f.num}</span>
                  <b>{f.title}</b>
                  <span>{f.text}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="login__plate-foot">
            <span>EMIDS · ABSENCE SUITE</span>
            <span>FIG. 01.00 · SSO ENTRY</span>
          </div>
        </div>
      </section>

      <section className="login__form-side">
        <div className="login__form">
          <span className="eyebrow">↘ Employee Sign-in</span>
          <h1>Welcome back.</h1>
          <p className="login__lede">
            Sign in with your Emids credentials. Accounts are provisioned by
            Emids IT — this portal never stores your password.
          </p>

          <form className="login__fields" onSubmit={handleSubmit}>
            <label className="field">
              <span className="field__label">Corporate Email <span className="req">*</span></span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@emids.com"
                autoComplete="email"
                required
              />
            </label>
            <label className="field">
              <span className="field__label">Password <span className="req">*</span></span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <span className="muted mono">{error}</span>}
            <button className="btn btn--primary btn--sso" type="submit" disabled={busy}>
              {busy ? <span className="spinner" /> : null}
              {busy ? 'Verifying credentials' : 'Sign in'}
            </button>
          </form>

          <p className="login__note">
            Access is provisioned by Emids · People Success
            <br />Trouble signing in? raise it at helpdesk.emids.com
          </p>
        </div>
      </section>
    </div>
  )
}
