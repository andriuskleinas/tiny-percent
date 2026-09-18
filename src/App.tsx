import { useEffect, useReducer, useRef, useState } from 'react'
import { calculatorEvents, createJourney } from './analytics/calculatorEvents'
import { track, trackOnce } from './analytics/track'
import type { Scenario } from './engine/types'
import { Hero } from './landing/Hero'
import { Learn, SiteFooter, UpdatesSignup } from './landing/Sections'
import { SiteHeader } from './landing/SiteHeader'
import { scrollToSection } from './landing/scroll'
import { appReducer, initialAppState } from './state/app'
import { STARTING_POINT } from './state/presets'
import { SITE } from './site'
import { reducer } from './state/reducer'
import type { Action } from './state/reducer'
import { scenarioFromLocation } from './state/url'
import { Calculator } from './ui/Calculator'
import { ErrorBoundary } from './ui/ErrorNotice'
import { safeRun } from './ui/safeRun'

/**
 * A shared link wins over the default. It is checked for being runnable as well
 * as well-formed, so a link carrying a structurally valid but impossible deal
 * falls back rather than opening onto an error.
 */
function initialScenario(): Scenario {
  // At build time there is no address: the page is prerendered with the default.
  if (typeof window === 'undefined') return STARTING_POINT
  const shared = scenarioFromLocation(window.location.hash)
  return shared && safeRun(shared).run ? shared : STARTING_POINT
}

/** A plain section fragment such as `#calculator`, from a link on another page. */
function sectionFromLocation(hash: string): string | undefined {
  const id = hash.slice(1)
  return /^[a-z][a-z-]*$/.test(id) ? id : undefined
}

export default function App() {
  const [state, dispatchRaw] = useReducer(appReducer, undefined, () => initialAppState(initialScenario()))

  // Every calculator change passes through here once, so its funnel events are
  // worked out in one place from the scenario before and after it. Each change
  // re-renders before the next, so this render's scenario is the one it changes.
  const journey = useRef(createJourney())
  const dispatch = (action: Action) => {
    const prev = state.scenario
    for (const event of calculatorEvents(prev, action, reducer(prev, action), journey.current)) track(event)
    dispatchRaw(action)
  }

  useEffect(() => trackOnce({ name: 'page_viewed' }), [])
  // Read before the effect below replaces the fragment with the scenario.
  const [arrivedAt] = useState(() => (typeof window === 'undefined' ? undefined : sectionFromLocation(window.location.hash)))

  useEffect(() => {
    if (arrivedAt) scrollToSection(arrivedAt)
  }, [arrivedAt])

  // A shared link has been read into the calculator by now, so drop it from the
  // address: the address bar stays plain and "Copy link" is the way to share.
  useEffect(() => {
    if (window.location.hash.startsWith('#s=')) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }
  }, [])

  return (
    <ErrorBoundary>
      <SiteHeader />
      <main>
        <Hero />
        <Calculator state={state} dispatch={dispatch} />
        <Learn />
        {SITE.waitlist ? <UpdatesSignup /> : null}
      </main>
      <SiteFooter />
    </ErrorBoundary>
  )
}
