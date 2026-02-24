import { useState, useEffect } from 'react'
import styles from './InstallPrompt.module.css'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSPrompt, setShowIOSPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return // Already installed as PWA
    }

    // Check if dismissed recently
    const dismissedTime = localStorage.getItem('pwa-install-dismissed')
    if (dismissedTime) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60)
      if (hoursSinceDismissed < 24) {
        return // Don't show for 24 hours after dismissal
      }
    }

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as unknown as { standalone: boolean }).standalone

    if (isIOS && !isInStandaloneMode) {
      // Show iOS-specific prompt after a delay
      const timer = setTimeout(() => setShowIOSPrompt(true), 3000)
      return () => clearTimeout(timer)
    }

    // Handle Android/Desktop install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    setShowIOSPrompt(false)
    setDeferredPrompt(null)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  // Don't show if dismissed or no prompt available
  if (dismissed || (!deferredPrompt && !showIOSPrompt)) {
    return null
  }

  // iOS prompt
  if (showIOSPrompt) {
    return (
      <div className={styles.prompt}>
        <button className={styles.closeButton} onClick={handleDismiss}>
          ×
        </button>
        <div className={styles.content}>
          <span className={styles.icon}>{'\uD83D\uDCF1'}</span>
          <div className={styles.text}>
            <strong>Install Toothbrush Tales</strong>
            <p>
              Tap <span className={styles.shareIcon}>{'\u2B06\uFE0F'}</span> then "Add to Home Screen" for the best experience!
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Android/Desktop prompt
  return (
    <div className={styles.prompt}>
      <button className={styles.closeButton} onClick={handleDismiss}>
        ×
      </button>
      <div className={styles.content}>
        <span className={styles.icon}>{'\u2728'}</span>
        <div className={styles.text}>
          <strong>Install the app!</strong>
          <p>Add Toothbrush Tales to your home screen for quick access.</p>
        </div>
        <button className={styles.installButton} onClick={handleInstall}>
          Install
        </button>
      </div>
    </div>
  )
}

