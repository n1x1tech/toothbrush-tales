import { useState } from 'react'
import VoiceInput from './VoiceInput'
import styles from './CharacterInput.module.css'

interface CharacterInputProps {
  value: string
  onChange: (name: string) => void
}

export default function CharacterInput({ value, onChange }: CharacterInputProps) {
  const [isListening, setIsListening] = useState(false)

  const handleVoiceResult = (transcript: string) => {
    onChange(transcript)
    setIsListening(false)
  }

  return (
    <div className={styles.container}>
      <label className={styles.label}>
        Who's the star of our story?
      </label>
      <div className={styles.inputWrapper}>
        <input
          type="text"
          className={styles.input}
          placeholder="Enter a name (like Arlo)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <VoiceInput
          onResult={handleVoiceResult}
          isListening={isListening}
          onListeningChange={setIsListening}
        />
      </div>
      <div className={styles.suggestions}>
        {['Arlo', 'Luna', 'Max', 'Mia'].map((name) => (
          <button
            key={name}
            type="button"
            className={styles.suggestionChip}
            onClick={() => onChange(name)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}
