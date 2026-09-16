import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App.tsx'
import { scenarioFromLocation } from './state/url'
import '@fontsource-variable/inter-tight/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import './index.css'

const root = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// The HTML arrives prerendered with the default calculation. Hydrate it —
// unless the address carries a shared calculation, which would not match that
// HTML; then render fresh so the shared numbers are the first ones shown.
if (root.hasChildNodes() && !scenarioFromLocation(window.location.hash)) {
  hydrateRoot(root, app)
} else {
  root.replaceChildren()
  createRoot(root).render(app)
}
