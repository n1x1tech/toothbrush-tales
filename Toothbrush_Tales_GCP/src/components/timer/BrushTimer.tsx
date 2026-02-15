import { useState, useEffect } from 'react'
import styles from './BrushTimer.module.css'

interface BrushTimerProps {
  duration: number // in seconds (120 for 2 minutes)
  onSegmentChange: (segment: number) => void
  onComplete: () => void
  isPaused: boolean
}

const SEGMENT_LABELS = [
  { label: 'Bottom Teeth', emoji: '\u2B07\uFE0F' },
  { label: 'Top Teeth', emoji: '\u2B06\uFE0F' },
  { label: 'Left Side', emoji: '\u2B05\uFE0F' },
  { label: 'Right Side', emoji: '\u27A1\uFE0F' },
]

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

  // Calculate progress (0 to 1)
  const progress = (duration - timeRemaining) / duration

  // Format time as M:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // SVG ring properties
  const size = 160
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  // Ring color transitions: teal → green → gold
  const getRingColor = () => {
    if (progress < 0.33) return 'var(--color-secondary)'
    if (progress < 0.66) return 'var(--color-success)'
    return '#F0C040'
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

  return (
    <div className={styles.container}>
      <div className={styles.ringWrapper}>
        <svg
          className={styles.ringSvg}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E8E8E8"
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getRingColor()}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={styles.progressRing}
          />
        </svg>
        <div className={styles.ringCenter}>
          <span className={styles.time}>{formatTime(timeRemaining)}</span>
          <span className={styles.segmentEmoji}>
            {timeRemaining > 0 ? '\uD83E\uDDB7' : '\u2728'}
          </span>
        </div>
      </div>

      <div className={styles.segmentLabel}>
        {timeRemaining > 0
          ? `${SEGMENT_LABELS[currentSegment].emoji} ${SEGMENT_LABELS[currentSegment].label}`
          : 'Done! \uD83C\uDF89'
        }
      </div>

      <div className={styles.segmentDots}>
        {SEGMENT_LABELS.map((seg, i) => (
          <span
            key={seg.label}
            className={`${styles.dot} ${i === currentSegment ? styles.dotActive : ''} ${i < currentSegment ? styles.dotComplete : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
