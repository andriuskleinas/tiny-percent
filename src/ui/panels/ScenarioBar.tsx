import { useEffect, useState } from 'react'
import type { Scenario } from '../../engine/types'
import { PRESETS } from '../../state/presets'
import { deleteSaved, listSaved, saveScenario } from '../../state/storage'
import type { SavedScenario } from '../../state/storage'
import { Button } from '../controls'

/**
 * Sharing and saving. The address bar always holds the current scenario, so
 * copying the link from anywhere works; the button is a convenience, not the
 * only route. Saved scenarios live in this browser alone, and a browser that
 * refuses to store them says so rather than failing silently.
 */
export function ScenarioBar({
  scenario,
  onLoad,
}: {
  scenario: Scenario
  onLoad: (scenario: Scenario) => void
}) {
  const [saved, setSaved] = useState<SavedScenario[]>(listSaved)
  const [name, setName] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setNotice('Link copied. It carries this exact scenario.')
    } catch {
      setNotice('Copying was blocked. The address bar holds the link — copy it from there.')
    }
  }

  const save = () => {
    if (!name.trim()) {
      setNotice('Give it a name first.')
      return
    }
    if (saveScenario(name, scenario)) {
      setSaved(listSaved())
      setNotice(`Saved as “${name.trim()}” in this browser.`)
      setName('')
    } else {
      setNotice('This browser will not store anything. The link still works.')
    }
  }

  const control =
    'border border-rule bg-surface px-2.5 py-1.5 text-sm text-ink outline-none ' +
    'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30'

  return (
    <div className="border border-rule bg-surface">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="preset" className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Start from
          </label>
          <select
            id="preset"
            className={`${control} min-w-[14rem]`}
            value=""
            onChange={(e) => {
              const found = PRESETS.find(([label]) => label === e.target.value)
              if (found) onLoad(found[1])
            }}
          >
            <option value="">Choose an example…</option>
            {PRESETS.map(([label]) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="save-name" className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Save in this browser
          </label>
          <div className="flex gap-2">
            <input
              id="save-name"
              className={`${control} w-40`}
              placeholder="Name it"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
              }}
            />
            <Button onClick={save}>Save</Button>
          </div>
        </div>

        {saved.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="saved" className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Saved ({saved.length})
            </label>
            <div className="flex gap-2">
              <select
                id="saved"
                className={`${control} min-w-[10rem]`}
                value=""
                onChange={(e) => {
                  const found = saved.find((s) => s.name === e.target.value)
                  if (found) onLoad(found.scenario)
                }}
              >
                <option value="">Load…</option>
                {saved.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button
                tone="quiet"
                title="Delete the most recently saved scenario"
                onClick={() => {
                  const first = saved[0]
                  if (!first) return
                  deleteSaved(first.name)
                  setSaved(listSaved())
                  setNotice(`Deleted “${first.name}”.`)
                }}
              >
                Delete newest
              </Button>
            </div>
          </div>
        ) : null}

        <div className="ml-auto flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Share</span>
          <Button onClick={copyLink}>Copy link</Button>
        </div>
      </div>

      {notice ? (
        <p role="status" className="border-t border-rule px-5 py-2.5 text-sm text-ink-soft sm:px-6">
          {notice}
        </p>
      ) : null}
    </div>
  )
}
