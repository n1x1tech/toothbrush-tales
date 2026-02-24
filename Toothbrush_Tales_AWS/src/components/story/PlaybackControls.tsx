import { useAppStore, PlaybackMode } from '../../store/useAppStore'
import styles from './PlaybackControls.module.css'

interface PlaybackControlsProps {
  isPlaying: boolean
  isPaused: boolean
  isSynthesizing: boolean
  onPlay: () => void
  onPause: () => void
  onStop: () => void
}

export default function PlaybackControls({
  isPlaying,
  isPaused,
  isSynthesizing,
  onPlay,
  onPause,
  onStop,
}: PlaybackControlsProps) {
  const { playbackMode, setPlaybackMode } = useAppStore()

  const modes: { value: PlaybackMode; label: string; icon: string }[] = [
    { value: 'audio', label: 'Audio', icon: '\uD83D\uDD0A' },
    { value: 'text', label: 'Text', icon: '\uD83D\uDCD6' },
    { value: 'both', label: 'Both', icon: '\uD83D\uDD0A\uD83D\uDCD6' },
  ]

  return (
    <div className={styles.container}>
      <div className={styles.modeSelector}>
        {modes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            className={`${styles.modeButton} ${playbackMode === mode.value ? styles.active : ''}`}
            onClick={() => setPlaybackMode(mode.value)}
            title={mode.label}
            aria-label={`Switch to ${mode.label} mode`}
            aria-pressed={playbackMode === mode.value}
          >
            <span>{mode.icon}</span>
          </button>
        ))}
      </div>

      {(playbackMode === 'audio' || playbackMode === 'both') && (
        <div className={styles.audioControls}>
          {isSynthesizing ? (
            <button type="button" className={styles.controlButton} disabled aria-label="Preparing narration">
              <span className={styles.loading}>{'\u23F3'}</span>
            </button>
          ) : isPlaying && !isPaused ? (
            <button type="button" className={styles.controlButton} onClick={onPause} aria-label="Pause narration">
              <span>{'\u23F8\uFE0F'}</span>
            </button>
          ) : (
            <button type="button" className={styles.controlButton} onClick={onPlay} aria-label="Play narration">
              <span>{'\u25B6\uFE0F'}</span>
            </button>
          )}
          <button type="button" className={styles.controlButton} onClick={onStop} aria-label="Stop narration">
            <span>{'\u23F9\uFE0F'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

