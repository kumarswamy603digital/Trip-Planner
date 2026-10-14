import React from 'react'

/**
 * A visible failure beats a blank screen. The engine is total and the data is local, so
 * reaching this page means something unexpected — say so, keep the header, and hand the
 * traveller back a working app instead of a white rectangle.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('NammaYatri view error:', error, info?.componentStack?.slice(0, 400))
  }

  render() {
    if (!this.state.error) return this.props.children
    const err = this.state.error
    return (
      <div className="container-app py-12">
        <div className="card max-w-xl p-6">
          <p className="label text-primary-700">Something in this view broke</p>
          <h1 className="mt-2 font-display text-2xl font-bold">Your trip is still safe</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            The plan lives in this browser, not on a server, so nothing was lost. Reload it and keep going.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-ink-900/5 p-3 font-mono text-xs text-ink-700">
            {String(err?.message || err)}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                this.setState({ error: null })
                window.location.assign('/itinerary')
              }}
            >
              Back to my itinerary
            </button>
            <button type="button" className="btn-ghost" onClick={() => this.setState({ error: null })}>
              Try this page again
            </button>
          </div>
        </div>
      </div>
    )
  }
}
