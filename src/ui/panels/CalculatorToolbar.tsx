import { useEffect, useRef, useState } from 'react'
import type { Currency } from '../../engine/types'
import { EXAMPLE, blankScenario } from '../../state/presets'
import type { Action } from '../../state/reducer'
import { Button } from '../controls'

type ShareState = 'idle' | 'copied' | 'manual'

/**
 * Clear the example, load it back, or share what is on screen. The address bar
 * already holds the whole scenario, so sharing is only a matter of handing that
 * address over: the system share sheet where there is one, the clipboard where
 * there is not, and the link itself to copy by hand if both are refused.
 */
export function CalculatorToolbar({ currency, dispatch }: { currency: Currency; dispatch: (action: Action) => void }) {
  const [share, setShare] = useState<ShareState>('idle')
  const manual = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (share === 'copied') {
      const timer = window.setTimeout(() => setShare('idle'), 2500)
      return () => window.clearTimeout(timer)
    }
    if (share === 'manual') manual.current?.select()
    return undefined
  }, [share])

  const onShare = async () => {
    const url = window.location.href
    const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false
    if (touch && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'My angel investment calculation', url })
        return
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShare('copied')
    } catch {
      setShare('manual')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button tone="quiet" onClick={() => dispatch({ type: 'scenario:load', scenario: blankScenario(currency) })}>
          Start from scratch
        </Button>
        <Button tone="quiet" onClick={() => dispatch({ type: 'scenario:load', scenario: EXAMPLE })}>
          Load example
        </Button>
        <span className="grow" />
        <Button onClick={() => void onShare()}>Share calculation</Button>
      </div>
      <p role="status" className="min-h-4 text-right text-xs text-ink-faint">
        {share === 'copied' ? 'Link copied. Anyone who opens it sees exactly this calculation.' : ''}
      </p>
      {share === 'manual' ? (
        <label className="flex flex-col gap-1.5 text-xs text-ink-faint">
          Copy this link to share the calculation:
          <input
            ref={manual}
            readOnly
            value={window.location.href}
            className="w-full border border-rule bg-surface px-3 py-2 font-mono text-xs text-ink"
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      ) : null}
    </div>
  )
}
