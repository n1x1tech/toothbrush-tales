import { useState, useEffect } from 'react'
import styles from './BrushTimer.module.css'

interface BrushTimerProps {
  duration: number // in seconds (120 for 2 minutes)
  onSegmentChange: (segment: number) => void
  onComplete: () => void
  isPaused: boolean
}

export default function BrushTimer({
  duration,
  onSegmentChange,
  onComplete,
  isPaused
}: BrushTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(duration)
  const [isRunning, setIsRunning] = useState(false)

  // Calculate current segment (0-3 for 4 segments)
  const segmentDuration = duration / 4
  const currentSegment = Math.min(
    3,
    Math.floor((duration - timeRemaining) / segmentDuration)
  )

  // Calculate progress percentage
  const progress = ((duration - timeRemaining) / duration) * 100

  // Format time as M:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Start timer on mount
  useEffect(() => {
    setIsRunning(true)
  }, [])

  // Timer countdown logic
  useEffect(() => {
    if (!isRunning || isPaused || timeRemaining <= 0) return

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          onComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, isPaused, timeRemaining, onComplete])

  // Notify parent of segment changes
  useEffect(() => {
    onSegmentChange(currentSegment)
  }, [currentSegment, onSegmentChange])

  const segmentLabels = ['Bottom', 'Top', 'Left', 'Right']

  return (
    <div className={styles.container}>
      <div className={styles.timerDisplay}>
        <span className={styles.time}>{formatTime(timeRemaining)}</span>
        <span className={styles.segmentLabel}>
          {timeRemaining > 0 ? segmentLabels[currentSegment] : 'Done!'}
        </span>
      </div>

      <div className={styles.progressContainer}>
        <div
          className={styles.progressBar}
          style={{ width: `${progress}%` }}
        />
        <div className={styles.segmentMarkers}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`${styles.segmentMarker} ${i <= currentSegment ? styles.active : ''}`}
            />
          ))}
        </div>
      </div>

      <div className={styles.teethIndicator}>
        {segmentLabels.map((label, i) => (
          <span
            key={label}
            className={`${styles.toothSection} ${i === currentSegment ? styles.current : ''}`}
          >
            {i === currentSegment ? '\uD83E\uDDB7' : '\u25CB'}
          </span>
        ))}
      </div>
    </div>
  )
}
