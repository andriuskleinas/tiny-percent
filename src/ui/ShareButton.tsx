import { useEffect, useRef, useState } from 'react'
import { track } from '../analytics/track'
import type { Scenario } from '../engine/types'
import { SITE } from '../site'
import { sharedLink } from '../state/url'
import { Button } from './controls'

type Status = 'idle' | 'copied' | 'manual'

/** Phones and tablets get the system share sheet; desktops copy to the clipboard. */
function prefersShareSheet(): boolean {
  return typeof navigator.share === 'function' && window.matchMedia?.('(pointer: coarse)').matches === true
}

/**
 * Copies a link that reopens this calculation. The scenario rides in the link
 * itself, never in the address bar, so the page's own address stays clean.
 */
export function ShareButton({ scenario }: { scenario: Scenario }) {
  const [status, setStatus] = useState<Status>('idle')
  const [link, setLink] = useState('')
  const field = useRef<HTMLInputElement>(null)

  // Compressing is asynchronous, so the link is made ahead of the click: the
  // clipboard and share sheet only work while the click is still fresh.
  useEffect(() => {
    let current = true
    void sharedLink(scenario, window.location.origin).then((next) => {
      if (current) setLink(next)
    })
    return () => {
      current = false
    }
  }, [scenario])

  useEffect(() => {
    if (status !== 'copied') return undefined
    const timer = window.setTimeout(() => setStatus('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [status])

  useEffect(() => {
    if (status === 'manual') field.current?.select()
  }, [status])

  const share = async () => {
    track({ name: 'share_clicked' })
    const url = link || (await sharedLink(scenario, window.location.origin))
    setLink(url)
    if (prefersShareSheet()) {
      try {
        await navigator.share({ title: SITE.name, url })
        track({ name: 'calculation_link_copied', method: 'share_sheet' })
        return
      } catch (err) {
        // Closing the sheet is a choice, not a failure.
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      track({ name: 'calculation_link_copied', method: 'clipboard' })
      setStatus('copied')
    } catch {
      setStatus('manual')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button onClick={() => void share()}>
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2l-.8.8" />
            <path d="M9.5 6.5a3 3 0 0 0-4.2 0L3 8.8A3 3 0 0 0 7.2 13l.8-.8" />
          </svg>
          Copy link to this calculation
        </Button>
        <span role="status" className="text-sm text-ink-faint">
          {status === 'copied' ? 'Link copied' : ''}
        </span>
      </div>
      {status === 'manual' ? (
        <label className="flex flex-col gap-1 text-sm text-ink-soft">
          Copy this link:
          <input
            ref={field}
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            onCopy={() => track({ name: 'calculation_link_copied', method: 'manual' })}
            className="w-full rounded-lg border border-rule bg-surface px-3 py-2 font-mono text-xs text-ink"
          />
        </label>
      ) : null}
    </div>
  )
}
