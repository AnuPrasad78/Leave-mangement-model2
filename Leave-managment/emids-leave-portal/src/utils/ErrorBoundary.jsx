import { Component } from 'react'
import { IconSun } from '../components/Icons'

/** Page-level crash guard: keeps a crashed route from blanking the whole app. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('[portal] uncaught page error:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="page">
        <div className="card card--padded">
          <div className="warn-banner">
            <IconSun size={20} />
            <div>
              Something went wrong on this page.
              <div className="muted" style={{ marginTop: 4 }}>
                Reload and, if it repeats, report it at helpdesk.emids.com.
              </div>
            </div>
          </div>
          <div className="form-actions" style={{ marginTop: 12 }}>
            <button className="btn btn--ghost" onClick={() => { this.setState({ error: null }); window.location.assign('/dashboard') }}>
              Reload dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }
}
