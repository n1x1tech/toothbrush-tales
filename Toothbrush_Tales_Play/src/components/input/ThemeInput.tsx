import styles from './ThemeInput.module.css'

interface ThemeInputProps {
  value: string
  onChange: (theme: string) => void
  locked?: boolean
  onUnlockTap?: () => void
}

const THEME_SUGGESTIONS = [
  'explore the outback',
  'fly to the moon',
  'make friends with dinosaurs',
  'become a superhero',
  'swim with dolphins',
  'bake magical cookies'
]

export default function ThemeInput({ value, onChange, locked = false, onUnlockTap }: ThemeInputProps) {
  return (
    <div className={styles.container}>
      <label className={styles.label}>
        What adventure are they having?
      </label>
      {locked ? (
        <button
          type="button"
          className={styles.lockedInput}
          onClick={onUnlockTap}
        >
          <span className={styles.lockedHint}>Tap a suggestion below — or unlock custom themes</span>
        </button>
      ) : (
        <input
          type="text"
          className={styles.input}
          placeholder="Type what they're doing!"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
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
      {locked && (
        <button type="button" className={styles.unlockLink} onClick={onUnlockTap}>
          Want any adventure? Unlock custom themes with Premium →
        </button>
      )}
    </div>
  )
}
