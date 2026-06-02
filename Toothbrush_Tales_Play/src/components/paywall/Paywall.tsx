import { useEffect } from 'react'
import { useAppStore, PaywallReason } from '../../store/useAppStore'
import { trackEvent } from '../../lib/analytics'
import styles from './Paywall.module.css'

const REASON_COPY: Record<PaywallReason, { title: string; body: string }> = {
  daily_limit: {
    title: 'Out of stories for today!',
    body: "You've used your free story for today. Upgrade to Premium for unlimited stories anytime.",
  },
  custom_theme: {
    title: 'Custom themes are a Premium feature',
    body: 'Type any adventure you can imagine! Upgrade to Premium to unlock custom themes.',
  },
  multi_character: {
    title: 'Multiple characters are a Premium feature',
    body: 'Add siblings, friends, even pets to the story! Upgrade to Premium for multiple characters.',
  },
  cloud_voice: {
    title: 'Premium voices unlock with Premium',
    body: 'Natural AI narration that brings stories to life. Upgrade to Premium for premium voices.',
  },
  history_limit: {
    title: 'Save unlimited stories with Premium',
    body: 'Free saves your last 3 stories. Premium remembers every story your child has loved.',
  },
  manual: {
    title: 'Unlock Toothbrush Tales Premium',
    body: 'Unlimited stories, custom themes, multiple characters, and premium voices.',
  },
}

const FEATURES = [
  'Unlimited new stories every day',
  'Custom adventure themes',
  'Multiple character names (siblings, friends)',
  'Premium AI narration voices',
  'Unlimited story history',
]

export default function Paywall() {
  const { paywallOpen, paywallReason, closePaywall } = useAppStore()

  useEffect(() => {
    if (paywallOpen && paywallReason) {
      trackEvent('paywall_shown', { reason: paywallReason })
    }
  }, [paywallOpen, paywallReason])

  if (!paywallOpen) return null

  const copy = paywallReason ? REASON_COPY[paywallReason] : REASON_COPY.manual

  const handlePurchase = (plan: 'monthly' | 'annual') => {
    trackEvent('paywall_purchase_clicked', { plan, reason: paywallReason ?? 'manual' })
    // TODO Phase 3: trigger Google Play Billing via Digital Goods API
    console.log('[Paywall] TODO: trigger Play Billing for plan:', plan)
    alert('Purchase flow coming soon! (Play Billing wires in Phase 3.)')
  }

  const handleClose = () => {
    trackEvent('paywall_dismissed', { reason: paywallReason ?? 'manual' })
    closePaywall()
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="paywall-title">
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={handleClose} aria-label="Close">
          ×
        </button>

        <h2 id="paywall-title" className={styles.title}>{copy.title}</h2>
        <p className={styles.body}>{copy.body}</p>

        <ul className={styles.featureList}>
          {FEATURES.map((feature) => (
            <li key={feature} className={styles.feature}>
              <span className={styles.checkmark}>✓</span>
              {feature}
            </li>
          ))}
        </ul>

        <div className={styles.planButtons}>
          <button
            className={`${styles.planButton} ${styles.annualPlan}`}
            onClick={() => handlePurchase('annual')}
          >
            <span className={styles.planBadge}>Best value · save 50%</span>
            <span className={styles.planName}>Annual</span>
            <span className={styles.planPrice}>$29.99/year</span>
            <span className={styles.planSubtext}>Just $2.50/month</span>
          </button>

          <button
            className={`${styles.planButton} ${styles.monthlyPlan}`}
            onClick={() => handlePurchase('monthly')}
          >
            <span className={styles.planName}>Monthly</span>
            <span className={styles.planPrice}>$4.99/month</span>
            <span className={styles.planSubtext}>Cancel anytime</span>
          </button>
        </div>

        <button className={styles.dismissButton} onClick={handleClose}>
          Maybe later
        </button>

        <p className={styles.footnote}>
          Subscription auto-renews until canceled in Google Play.
        </p>
      </div>
    </div>
  )
}
