import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import CharacterInput from '../components/input/CharacterInput'
import ThemeInput from '../components/input/ThemeInput'
import { useStoryGeneration } from '../hooks/useStoryGeneration'
import {
  useAppStore,
  canGenerateNewStory,
  isInHoneymoon,
  honeymoonDaysLeft,
  storiesUsedToday,
  FREE_DAILY_NEW_STORIES,
  PAYWALL_ENABLED,
} from '../store/useAppStore'
import { ensureAuth } from '../lib/firebase'
import styles from './HomePage.module.css'

const MULTI_NAME_REGEX = /,|\s+and\s+|\s+&\s+/i

export default function HomePage() {
  const navigate = useNavigate()
  const [characterName, setCharacterName] = useState('')
  const [theme, setTheme] = useState('')
  const [generationError, setGenerationError] = useState<string | null>(null)
  const { generateStory, isGenerating } = useStoryGeneration()
  const ageRange = useAppStore((s) => s.ageRange)
  const entitlement = useAppStore((s) => s.entitlement)
  const installDate = useAppStore((s) => s.installDate)
  const dailyUsage = useAppStore((s) => s.dailyUsage)
  const openPaywall = useAppStore((s) => s.openPaywall)
  const incrementDailyStoryCount = useAppStore((s) => s.incrementDailyStoryCount)

  // When paywall is disabled (v1), treat every user as premium. All paywall
  // checks downstream become inert without touching call sites.
  const isPremium = !PAYWALL_ENABLED || entitlement === 'premium'
  const inHoneymoon = isInHoneymoon({ installDate })
  const usedToday = storiesUsedToday({ dailyUsage })
  const canGenerate = canGenerateNewStory({ entitlement, installDate, dailyUsage })

  // Warm anonymous auth early so first story request is less likely to stall.
  useEffect(() => {
    void ensureAuth().catch((error) => {
      console.warn('[StoryGen] Auth warmup failed:', error)
    })
  }, [])

  const handleGenerateStory = async () => {
    if (!characterName.trim() || !theme.trim()) return
    setGenerationError(null)

    // Free tier: multi-character requires Premium
    if (!isPremium && MULTI_NAME_REGEX.test(characterName)) {
      openPaywall('multi_character')
      return
    }

    // Free tier post-honeymoon: enforce daily quota
    if (!canGenerate) {
      openPaywall('daily_limit')
      return
    }

    try {
      const story = await generateStory(characterName.trim(), theme.trim(), ageRange)
      incrementDailyStoryCount()
      navigate('/story', { state: { story, wasFallback: story.isFallback } })
    } catch (err) {
      console.error('Failed to generate story:', err)
      setGenerationError('Something went wrong. Please try again.')
    }
  }

  const isFormValid = characterName.trim() && theme.trim()

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Time to Brush!</h1>
        <p className={styles.subtitle}>
          Let's create a fun story while you brush your teeth!
        </p>
      </div>

      {PAYWALL_ENABLED && (
        <StatusBadge
          isPremium={isPremium}
          inHoneymoon={inHoneymoon}
          installDate={installDate}
          usedToday={usedToday}
          onUpgradeTap={() => openPaywall('manual')}
        />
      )}

      <div className={styles.form}>
        <CharacterInput
          value={characterName}
          onChange={setCharacterName}
          multiLocked={!isPremium}
          onUnlockTap={() => openPaywall('multi_character')}
        />

        <ThemeInput
          value={theme}
          onChange={setTheme}
          locked={!isPremium}
          onUnlockTap={() => openPaywall('custom_theme')}
        />

        {generationError && (
          <div className={styles.errorBanner}>
            {generationError}
          </div>
        )}

        <button
          className={styles.generateButton}
          onClick={handleGenerateStory}
          disabled={!isFormValid || isGenerating}
        >
          {isGenerating ? 'Creating Story...' : 'Start Brushing!'}
        </button>
      </div>
    </div>
  )
}

interface StatusBadgeProps {
  isPremium: boolean
  inHoneymoon: boolean
  installDate: number
  usedToday: number
  onUpgradeTap: () => void
}

function StatusBadge({ isPremium, inHoneymoon, installDate, usedToday, onUpgradeTap }: StatusBadgeProps) {
  if (isPremium) {
    return (
      <div className={`${styles.statusBadge} ${styles.statusPremium}`}>
        <span className={styles.statusIcon}>⭐</span>
        <span className={styles.statusText}>Premium · Unlimited stories</span>
      </div>
    )
  }

  if (inHoneymoon) {
    const daysLeft = honeymoonDaysLeft({ installDate })
    return (
      <div className={`${styles.statusBadge} ${styles.statusHoneymoon}`}>
        <span className={styles.statusIcon}>🎁</span>
        <span className={styles.statusText}>
          Welcome week · Unlimited stories for {daysLeft} more {daysLeft === 1 ? 'day' : 'days'}
        </span>
      </div>
    )
  }

  const remaining = Math.max(0, FREE_DAILY_NEW_STORIES - usedToday)
  return (
    <div className={`${styles.statusBadge} ${styles.statusFree}`}>
      <span className={styles.statusText}>
        Free · {remaining} of {FREE_DAILY_NEW_STORIES} {FREE_DAILY_NEW_STORIES === 1 ? 'story' : 'stories'} left today
      </span>
      <button type="button" className={styles.statusUpgrade} onClick={onUpgradeTap}>
        Upgrade
      </button>
    </div>
  )
}
