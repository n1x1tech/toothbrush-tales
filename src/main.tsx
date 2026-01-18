import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import App from './App'
import './index.css'
import outputs from '../amplify_outputs.json'

// Configure Amplify with the generated outputs
// This will be populated after running `npx ampx sandbox`
try {
  if (outputs && Object.keys(outputs).length > 1) {
    Amplify.configure(outputs)
    console.log('Amplify configured successfully')
  } else {
    console.log('Amplify outputs not configured - run `npx ampx sandbox` to deploy backend')
  }
} catch (error) {
  console.log('Amplify configuration skipped:', error)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
