import styles from './CharacterInput.module.css'

interface CharacterInputProps {
  value: string
  onChange: (name: string) => void
  multiLocked?: boolean
  onUnlockTap?: () => void
}

const MULTI_NAME_REGEX = /,|\s+and\s+|\s+&\s+/i

export default function CharacterInput({ value, onChange, multiLocked = false, onUnlockTap }: CharacterInputProps) {
  const showMultiHint = multiLocked && MULTI_NAME_REGEX.test(value)
  return (
    <div className={styles.container}>
      <label className={styles.label}>
        Who's the star of our story?
      </label>
      <input
        type="text"
        className={styles.input}
        placeholder={multiLocked ? 'Enter a name' : 'Enter names (e.g. John, Jane and Paul)'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {showMultiHint && (
        <button type="button" className={styles.unlockHint} onClick={onUnlockTap}>
          Multiple characters need Premium — tap to learn more
        </button>
      )}
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
