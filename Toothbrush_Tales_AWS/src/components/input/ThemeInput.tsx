import styles from './ThemeInput.module.css'

interface ThemeInputProps {
  value: string
  onChange: (theme: string) => void
}

const THEME_SUGGESTIONS = [
  'exploring the outback',
  'flying to the moon',
  'making friends with dinosaurs',
  'becoming a superhero',
  'swimming with dolphins',
  'baking magical cookies'
]

export default function ThemeInput({ value, onChange }: ThemeInputProps) {
  return (
    <div className={styles.container}>
      <label className={styles.label}>
        What adventure are they having?
      </label>
      <input
        type="text"
        className={styles.input}
        placeholder="Type what they're doing!"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className={styles.suggestions}>
        {THEME_SUGGESTIONS.map((theme) => (
          <button
            key={theme}
            type="button"
            className={styles.suggestionChip}
            onClick={() => onChange(theme)}
          >
            {theme}
          </button>
        ))}
      </div>
    </div>
  )
}
