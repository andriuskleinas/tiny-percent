import { useEffect, useReducer, useState } from 'react'
import type { Scenario } from './engine/types'
import { Hero } from './landing/Hero'
import { Faq, Features, HowItWorks, Learn, SiteFooter, UpdatesSignup, WorkedExample } from './landing/Sections'
import { SiteHeader } from './landing/SiteHeader'
import { scrollToSection } from './landing/scroll'
import { appReducer, initialAppState } from './state/app'
import { EXAMPLE, STARTING_POINT } from './state/presets'
import { encodeScenario, scenarioFromLocation } from './state/url'
import { Calculator } from './ui/Calculator'
import { ErrorBoundary } from './ui/ErrorNotice'
import { safeRun } from './ui/safeRun'

/**
 * A shared link wins over the default. It is checked for being runnable as well
 * as well-formed, so a link carrying a structurally valid but impossible deal
 * falls back rather than opening onto an error.
 */
function initialScenario(): Scenario {
  const shared = scenarioFromLocation(window.location.hash)
  return shared && safeRun(shared).run ? shared : STARTING_POINT
}

/** A plain section fragment such as `#calculator`, from a link on another page. */
function sectionFromLocation(hash: string): string | undefined {
  const id = hash.slice(1)
  return /^[a-z][a-z-]*$/.test(id) ? id : undefined
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, () => initialAppState(initialScenario()))
  // Read before the effect below replaces the fragment with the scenario.
  const [arrivedAt] = useState(() => sectionFromLocation(window.location.hash))

  useEffect(() => {
    if (arrivedAt) scrollToSection(arrivedAt)
  }, [arrivedAt])

  // Keep the address bar holding the current scenario, without filling the back
  // button with an entry for every keystroke.
  useEffect(() => {
    window.history.replaceState(null, '', `#s=${encodeScenario(state.scenario)}`)
  }, [state.scenario])

  const openExample = () => {
    dispatch({ type: 'scenario:load', scenario: EXAMPLE })
    scrollToSection('calculator')
  }

  return (
    <ErrorBoundary>
      <SiteHeader />
      <main>
        <Hero onExample={openExample} />
        <Calculator state={state} dispatch={dispatch} />
        <Features />
        <HowItWorks />
        <WorkedExample onOpen={openExample} />
        <Learn />
        <Faq />
        <UpdatesSignup />
      </main>
      <SiteFooter />
    </ErrorBoundary>
  )
}
