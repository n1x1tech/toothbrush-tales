import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CharacterInput from '../components/input/CharacterInput'
import ThemeInput from '../components/input/ThemeInput'
import { useStoryGeneration } from '../hooks/useStoryGeneration'
import styles from './HomePage.module.css'

export default function HomePage() {
  const navigate = useNavigate()
  const [characterName, setCharacterName] = useState('')
  const [theme, setTheme] = useState('')
  const [generationError, setGenerationError] = useState<string | null>(null)
  const { generateStory, isGenerating } = useStoryGeneration()

  const handleGenerateStory = async () => {
    if (!characterName.trim() || !theme.trim()) return
    setGenerationError(null)

    try {
      const story = await generateStory(characterName.trim(), theme.trim())
      // Navigate to story page, passing fallback warning if applicable
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
