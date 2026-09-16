/**
 * In-page navigation that leaves the address bar alone. The fragment already
 * holds the whole calculation (`#s=…`), so a plain `href="#how-it-works"` would replace
 * it and a reload or a copied link would lose the user's numbers. Links keep a
 * real `href` for crawlers and no-JS readers; clicks come through here.
 */
export function scrollToSection(id: string, focus?: HTMLElement | null): void {
  const target = document.getElementById(id)
  if (!target) return
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  target.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  const destination = focus ?? target.querySelector<HTMLElement>('h1, h2')
  if (destination) {
    if (!destination.matches('input, button, a, select, textarea')) destination.tabIndex = -1
    destination.focus({ preventScroll: true })
  }
}

/** The calculator's first input, for "Use calculator". */
export const INVESTMENT_INPUT_ID = 'investment-amount'
