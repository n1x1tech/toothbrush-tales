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
  const { generateStory, isGenerating } = useStoryGeneration()

  const handleGenerateStory = async () => {
    if (!characterName.trim() || !theme.trim()) return

    try {
      const story = await generateStory(characterName.trim(), theme.trim())
      navigate('/story', { state: { story } })
    } catch (error) {
      console.error('Failed to generate story:', error)
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
