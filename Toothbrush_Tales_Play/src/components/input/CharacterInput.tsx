import styles from './CharacterInput.module.css'

interface CharacterInputProps {
  value: string
  onChange: (name: string) => void
}

export default function CharacterInput({ value, onChange }: CharacterInputProps) {
  return (
    <div className={styles.container}>
      <label className={styles.label}>
        Who's the star of our story?
      </label>
      <input
        type="text"
        className={styles.input}
        placeholder="Enter names (e.g. John, Jane and Paul)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className={styles.suggestions}>
        {['John', 'Jane', 'Paul', 'Lisa'].map((name) => (
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
