import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import CharacterInput from '../components/input/CharacterInput'
import ThemeInput from '../components/input/ThemeInput'
import { useStoryGeneration } from '../hooks/useStoryGeneration'
import { getAmplifyDataClient } from '../services/amplifyClient'
import styles from './HomePage.module.css'

// Cycle through fun messages while the story loads
const LOADING_MESSAGES = [
  'Sharpening the pencils...',
  'Waking up the story gnomes...',
  'Polishing the adventure gems...',
  'Gathering magic toothbrush dust...',
  'Almost ready... hang tight!',
]

export default function HomePage() {
  const navigate = useNavigate()
  const [characterName, setCharacterName] = useState('')
  const [theme, setTheme] = useState('')
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const { generateStory, isGenerating } = useStoryGeneration()

  // Warm the Amplify client on mount so the first story request is faster
  useEffect(() => {
    void getAmplifyDataClient().catch((err) => {
      console.warn('[HomePage] Client warmup failed:', err)
    })
  }, [])

  // Cycle through fun loading messages every 6 seconds while generating
  useEffect(() => {
    if (!isGenerating) {
      setLoadingMessageIndex(0)
      return
    }
    const interval = setInterval(() => {
      setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [isGenerating])

  const handleGenerateStory = async () => {
    if (!characterName.trim() || !theme.trim()) return
    setGenerationError(null)

    try {
      const story = await generateStory(characterName.trim(), theme.trim())
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

      <div className={styles.form}>
        <CharacterInput
          value={characterName}
          onChange={setCharacterName}
        />

        <ThemeInput
          value={theme}
          onChange={setTheme}
        />

        {isGenerating && (
          <div className={styles.loadingBanner} role="status" aria-live="polite">
            <span className={styles.loadingSpinner} aria-hidden="true">✨</span>
            <span>{LOADING_MESSAGES[loadingMessageIndex]}</span>
          </div>
        )}

        {generationError && (
          <div className={styles.errorBanner} role="alert">
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
