import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LegalPage } from './landing/LegalPage'
import './index.css'

const root = document.getElementById('root')!
const page = root.dataset['page'] === 'terms' ? 'terms' : 'privacy'

createRoot(root).render(
  <StrictMode>
    <LegalPage page={page} />
  </StrictMode>,
)
