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
            className={`${styles.modeButton} ${playbackMode === mode.value ? styles.active : ''}`}
            onClick={() => setPlaybackMode(mode.value)}
            title={mode.label}
          >
            <span>{mode.icon}</span>
          </button>
        ))}
      </div>

      {(playbackMode === 'audio' || playbackMode === 'both') && (
        <div className={styles.audioControls}>
          {isSynthesizing ? (
            <button className={styles.controlButton} disabled>
              <span className={styles.loading}>{'\u23F3'}</span>
            </button>
          ) : isPlaying && !isPaused ? (
            <button className={styles.controlButton} onClick={onPause}>
              <span>{'\u23F8\uFE0F'}</span>
            </button>
          ) : (
            <button className={styles.controlButton} onClick={onPlay}>
              <span>{'\u25B6\uFE0F'}</span>
            </button>
          )}
          <button className={styles.controlButton} onClick={onStop}>
            <span>{'\u23F9\uFE0F'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
