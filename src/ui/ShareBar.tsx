import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { track } from '../analytics/track'
import type { ScenarioResult } from '../engine/scenario'
import type { Scenario } from '../engine/types'
import { SITE } from '../site'
import { sharedLink } from '../state/url'
import { buildReport, reportFileName } from './report/report'

/**
 * Two quiet actions under the summary: copy a link that reopens this
 * calculation, and save it as a PDF. Each says what happened in its own label,
 * so there is nothing else to read unless something goes wrong.
 */
export function ShareBar({
  scenario,
  printable,
}: {
  /** What is on screen, which the link reopens exactly. */
  scenario: Scenario
  /** The deal a PDF prints, once there is one and every field is valid. */
  printable?: { scenario: Scenario; run: ScenarioResult } | undefined
}) {
  const copy = useCopyLink(scenario)
  const pdf = usePdfDownload(printable)

  return (
    <div className="flex flex-col gap-2">
      <div className={`grid divide-x divide-rule overflow-hidden rounded-xl border border-rule bg-surface ${printable ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <Action label="Copy link to this calculation" onClick={() => void copy.share()} icon={copy.status === 'copied' ? <CheckIcon /> : <LinkIcon />}>
          {copy.status === 'copied' ? 'Copied' : 'Copy link'}
        </Action>
        {printable ? (
          <Action label="Download PDF" onClick={() => void pdf.download()} icon={<DownloadIcon />}>
            {pdf.status === 'working' ? 'Preparing…' : 'Download PDF'}
          </Action>
        ) : null}
      </div>
      <span role="status" className="sr-only">
        {copy.status === 'copied' ? 'Link copied' : ''}
      </span>
      {copy.status === 'manual' ? (
        <label className="flex flex-col gap-1 text-sm text-ink-soft">
          Copy this link:
          <input
            ref={copy.field}
            readOnly
            value={copy.link}
            onFocus={(e) => e.currentTarget.select()}
            onCopy={() => track({ name: 'calculation_link_copied', method: 'manual' })}
            className="w-full rounded-lg border border-rule bg-surface px-3 py-2 font-mono text-xs text-ink"
          />
        </label>
      ) : null}
      {pdf.status === 'failed' ? (
        <p role="alert" className="text-sm text-dilute">
          The PDF could not be made. Please try again.
        </p>
      ) : null}
    </div>
  )
}

function Action({ label, onClick, icon, children }: { label: string; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="group flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-ink-soft outline-none transition-colors hover:bg-accent-wash hover:text-accent focus-visible:bg-accent-wash focus-visible:text-accent"
    >
      <span aria-hidden="true" className="text-ink-faint transition-colors group-hover:text-accent group-focus-visible:text-accent">
        {icon}
      </span>
      <span aria-hidden="true">{children}</span>
    </button>
  )
}

const iconProps = {
  viewBox: '0 0 16 16',
  className: 'size-4',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

function LinkIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2l-.8.8" />
      <path d="M9.5 6.5a3 3 0 0 0-4.2 0L3 8.8A3 3 0 0 0 7.2 13l.8-.8" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg {...iconProps}>
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7" />
      <path d="M3 13.5h10" />
    </svg>
  )
}

type CopyStatus = 'idle' | 'copied' | 'manual'

/** Phones and tablets get the system share sheet; desktops copy to the clipboard. */
function prefersShareSheet(): boolean {
  return typeof navigator.share === 'function' && window.matchMedia?.('(pointer: coarse)').matches === true
}

/**
 * A link that reopens this calculation. The scenario rides in the link itself,
 * never in the address bar, so the page's own address stays clean.
 */
function useCopyLink(scenario: Scenario) {
  const [status, setStatus] = useState<CopyStatus>('idle')
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

  return { status, link, field, share }
}

type PdfStatus = 'idle' | 'working' | 'failed'

/**
 * Saves the deal on screen as a PDF. It is made in the browser, so the numbers
 * never leave it, and the PDF library is fetched only on the first click.
 */
function usePdfDownload(printable: { scenario: Scenario; run: ScenarioResult } | undefined) {
  const [status, setStatus] = useState<PdfStatus>('idle')
  const download = async () => {
    if (!printable || status === 'working') return
    setStatus('working')
    try {
      const { downloadReport } = await import('./report/pdf')
      downloadReport(buildReport(printable.scenario, printable.run), reportFileName(printable.scenario))
      track({ name: 'pdf_downloaded' })
      setStatus('idle')
    } catch {
      setStatus('failed')
    }
  }
  return { status, download }
}
