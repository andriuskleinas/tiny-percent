import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { LegalPage } from './landing/LegalPage'
import '@fontsource-variable/inter-tight/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import './index.css'

const root = document.getElementById('root')!
const page = root.dataset['page'] === 'terms' ? 'terms' : 'privacy'

const app = (
  <StrictMode>
    <LegalPage page={page} />
  </StrictMode>
)

if (root.hasChildNodes()) hydrateRoot(root, app)
else createRoot(root).render(app)
