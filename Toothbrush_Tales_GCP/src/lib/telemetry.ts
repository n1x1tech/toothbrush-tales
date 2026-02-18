import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { auth, db, ensureAuth } from './firebase'

export type TelemetryPayload = Record<string, string | number | boolean | null>

export async function trackTelemetryEvent(
  eventName: string,
  payload: TelemetryPayload = {},
): Promise<void> {
  try {
    await ensureAuth()
    const user = auth.currentUser
    if (!user) return

    await addDoc(collection(db, `users/${user.uid}/telemetry`), {
      eventName,
      payload,
      createdAt: serverTimestamp(),
      clientTimestamp: Date.now(),
      app: 'toothbrush-tales-gcp',
    })
  } catch (error) {
    console.warn('[Telemetry] Failed to track event:', eventName, error)
  }
}
