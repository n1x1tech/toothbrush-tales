import { logEvent } from 'firebase/analytics'
import { analytics } from './firebase'

type EventParams = Record<string, string | number | boolean>

export function trackEvent(eventName: string, params?: EventParams): void {
  try {
    if (analytics) {
      logEvent(analytics, eventName, params)
    }
  } catch {
    // Fire-and-forget — never let analytics break the app
  }
}
