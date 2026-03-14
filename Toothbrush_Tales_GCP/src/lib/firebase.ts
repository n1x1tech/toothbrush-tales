import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'
import { getAnalytics, setConsent, type Analytics } from 'firebase/analytics'

function requireEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const firebaseConfig = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID'),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1')
export const storage = getStorage(app)

// COPPA-compliant analytics: deny all ad-related consent before initialization
setConsent({
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'granted',
})

export let analytics: Analytics | null = null
try {
  if (firebaseConfig.measurementId) {
    analytics = getAnalytics(app)
  }
} catch {
  // Analytics unavailable (e.g., blocked by browser extension)
}

// Auto sign-in anonymously (equivalent to Cognito guest access)
export async function ensureAuth() {
  if (auth.currentUser) {
    return auth.currentUser
  }

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          unsubscribe()
          resolve(user)
          return
        }

        await signInAnonymously(auth)
        unsubscribe()
        resolve(auth.currentUser)
      } catch (error) {
        unsubscribe()
        reject(error)
      }
    }, (error) => {
      unsubscribe()
      reject(error)
    })
  })
}
