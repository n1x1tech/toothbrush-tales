import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyCZxQW-_Hq-QBU58FsnFVBJHwTT0_Tc5s8",
  authDomain: "toothbrush-tales.firebaseapp.com",
  projectId: "toothbrush-tales",
  storageBucket: "toothbrush-tales.firebasestorage.app",
  messagingSenderId: "836626453942",
  appId: "1:836626453942:web:7389883b4ae467456add17",
  measurementId: "G-REW6043P3F"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, 'us-central1')
export const storage = getStorage(app)

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
