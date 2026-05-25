import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ensureAuth } from './lib/firebase'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Warm anonymous auth in the background. Pages re-await ensureAuth() before
// they need it, so a transient auth failure must not blank the entire app.
void ensureAuth().catch((error) => {
  console.warn('[Firebase] Anonymous auth warmup failed:', error)
})
