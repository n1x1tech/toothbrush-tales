import { useEffect, useRef } from 'react'

// Hold the screen awake while `active` is true. No-op on browsers without
// the Screen Wake Lock API (e.g. iOS Safari < 16.4) — the brush session
// just behaves the way it did before.
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return
    }

    let cancelled = false

    const acquire = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          await sentinel.release().catch(() => {})
          return
        }
        sentinelRef.current = sentinel
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) {
            sentinelRef.current = null
          }
        })
      } catch {
        // Denied — tab not visible, low battery, or policy. Silent no-op.
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinelRef.current) {
        void acquire()
      }
    }

    void acquire()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      const sentinel = sentinelRef.current
      sentinelRef.current = null
      if (sentinel) {
        void sentinel.release().catch(() => {})
      }
    }
  }, [active])
}
