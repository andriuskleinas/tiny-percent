import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App.tsx'
import type { Scenario } from './engine/types'
import { carriesScenario, isSharedPath, scenarioFromAddress } from './state/url'
import '@fontsource-variable/inter-tight/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import './index.css'

const root = document.getElementById('root')!
const app = (shared?: Scenario) => (
  <StrictMode>
    <App shared={shared} />
  </StrictMode>
)

function renderFresh(shared?: Scenario) {
  root.replaceChildren()
  createRoot(root).render(app(shared))
}

// The HTML arrives prerendered with the default calculation. Hydrate it —
// unless the address carries a shared calculation, which would not match that
// HTML; then render fresh so the shared numbers are the first ones shown. A
// `/shared#…` link is compressed, and unpacking it is asynchronous.
if (isSharedPath(window.location.pathname) && carriesScenario(window.location)) {
  void scenarioFromAddress(window.location).then(renderFresh, () => renderFresh())
} else if (root.hasChildNodes() && !carriesScenario(window.location)) {
  hydrateRoot(root, app())
} else {
  renderFresh()
}
