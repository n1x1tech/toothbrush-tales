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
    { value: 'audio', label: 'Audio', icon: '🔊' },
    { value: 'text', label: 'Text', icon: '📖' },
    { value: 'both', label: 'Both', icon: '🔊📖' },
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
              <span className={styles.loading}>⏳</span>
            </button>
          ) : isPlaying && !isPaused ? (
            <button className={styles.controlButton} onClick={onPause}>
              <span>⏸️</span>
            </button>
          ) : (
            <button className={styles.controlButton} onClick={onPlay}>
              <span>▶️</span>
            </button>
          )}
          <button className={styles.controlButton} onClick={onStop}>
            <span>⏹️</span>
          </button>
        </div>
      )}
    </div>
  )
}
