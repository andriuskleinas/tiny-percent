import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

/**
 * The engine throws on inputs that have no answer — an option pool larger than
 * the pre-money, for instance. Those throws are deliberate and carry a readable
 * message, so they are shown rather than swallowed. This boundary is the
 * backstop for anything else.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in the calculator', error, info)
  }

  override render() {
    if (this.state.error) {
      return (
        <main className="mx-auto max-w-xl px-6 py-20">
          <h1 className="text-2xl font-medium text-ink">Something broke</h1>
          <p className="mt-3 text-ink-soft">{this.state.error.message}</p>
          <button
            type="button"
            className="mt-6 border border-accent px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-accent"
            onClick={() => window.location.reload()}
          >
            Start again
          </button>
        </main>
      )
    }
    return this.props.children
  }
}

/** Inline banner for an input the engine cannot answer. */
export function ErrorNotice({ message }: { message: string }) {
  return (
    <div role="alert" className="border border-dilute bg-dilute/10 px-5 py-4 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-wider text-dilute">
        That figure has no answer
      </p>
      <p className="mt-1.5 max-w-prose text-sm text-ink">{message}</p>
      <p className="mt-1.5 text-xs text-ink-faint">
        The numbers below are from your last workable figures until you change it.
      </p>
    </div>
  )
}
