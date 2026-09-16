/**
 * Product analytics, with no provider attached yet. Every event the PRD's
 * funnel needs (§30–31) is sent through `track`, which does nothing until
 * `setAnalyticsSink` is given a destination — so choosing Umami, Plausible or
 * PostHog later is one call in `main.tsx` plus an update to the Privacy page.
 * In development, events are logged to the console instead.
 *
 * Events carry what the user did, never what they typed: no amounts,
 * valuations, ownership percentages or email addresses. The types below are
 * the whole vocabulary, and the only numbers they allow are small counts.
 */

export type CtaPlacement = 'hero' | 'nav' | 'features' | 'worked_example' | 'toolbar'

export type AnalyticsEvent =
  // Landing page
  | { name: 'page_viewed' }
  | { name: 'hero_cta_clicked'; placement: CtaPlacement }
  | { name: 'example_cta_clicked'; placement: CtaPlacement }
  | { name: 'calculator_viewed' }
  // Calculator
  | { name: 'calculator_started' }
  | { name: 'initial_investment_entered' }
  | { name: 'ownership_calculated' }
  | { name: 'funding_round_added'; rounds: number }
  | { name: 'second_funding_round_added' }
  | { name: 'follow_on_amount_entered'; pro_rata: boolean }
  | { name: 'pro_rata_scenario_viewed' }
  | { name: 'path_chart_viewed' }
  | { name: 'exit_valuation_changed'; preset: boolean }
  | { name: 'exit_scenario_completed' }
  // Growth
  | { name: 'example_loaded'; placement: CtaPlacement }
  | { name: 'share_clicked' }
  | { name: 'calculation_link_copied'; method: 'share_sheet' | 'clipboard' | 'manual' }
  | { name: 'email_submitted' }
  // Activation (§31)
  | { name: 'activated' }
  | { name: 'strongly_activated' }

export type AnalyticsSink = (event: AnalyticsEvent) => void

const devSink: AnalyticsSink = (event) => console.info('[analytics]', event.name, event)

let sink: AnalyticsSink | undefined = import.meta.env?.DEV && import.meta.env.MODE !== 'test' ? devSink : undefined
const sentOnce = new Set<string>()

export function setAnalyticsSink(next: AnalyticsSink | undefined): void {
  sink = next
}

export function track(event: AnalyticsEvent): void {
  if (!sink) return
  try {
    sink(event)
  } catch {
    // A failing provider must never break the calculator.
  }
}

/** For events that count visitors, not clicks: sent at most once per page load. */
export function trackOnce(event: AnalyticsEvent): void {
  if (sentOnce.has(event.name)) return
  sentOnce.add(event.name)
  track(event)
}

/** Tests only: forget the sink and what has been sent. */
export function resetAnalytics(): void {
  sink = undefined
  sentOnce.clear()
}
