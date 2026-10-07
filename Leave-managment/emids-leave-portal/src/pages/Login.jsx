import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { Button, Field } from '../components/ui'
import logoLight from '../assets/emids-logo-light.svg'

const FEATURES = [
  {
    num: '1',
    title: 'Real-time leave balances',
    text: 'Annual, contingency and comp-off pools — credit, utilised and available, always current.',
  },
  {
    num: '2',
    title: 'One-click approvals',
    text: 'Review team time off in a single queue. Approve or reject with a full audit trail.',
  },
  {
    num: '3',
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
          </div>
        </div>
      </section>

      <section className="login__form-side">
        <div className="login__form">
          <span className="eyebrow">Employee Sign-in</span>
          <h1>Welcome back.</h1>
          <p className="login__lede">
            Sign in with your Emids credentials. Accounts are provisioned by
            Emids IT — this portal never stores your password.
          </p>

          <form className="login__fields" onSubmit={handleSubmit}>
            <Field label='Corporate Email' required htmlFor='login-email'>
              <input
                id='login-email'
                className='input'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='name@emids.com'
                autoComplete='email'
                required
              />
            </Field>
            <Field label='Password' required error={error} htmlFor='login-password'>
              <input
                id='login-password'
                className='input'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete='current-password'
                required
              />
            </Field>
            <Button className='btn--sso' type='submit' busy={busy} busyLabel='Verifying credentials'>
              Sign in
            </Button>
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
