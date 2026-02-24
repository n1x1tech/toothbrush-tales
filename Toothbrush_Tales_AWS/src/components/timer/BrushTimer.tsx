import { useState, useEffect } from 'react'
import { useRef } from 'react'
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
  const [remainingMs, setRemainingMs] = useState(duration * 1000)
  const rafRef = useRef<number | null>(null)
  const endTimeRef = useRef<number | null>(null)
  const remainingMsRef = useRef(duration * 1000)
  const hasCompletedRef = useRef(false)
  const lastPaintedRemainingMsRef = useRef(duration * 1000)

  const clearRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  const persistRemainingFromEndTime = () => {
    if (endTimeRef.current === null) return
    const nextRemaining = Math.max(0, endTimeRef.current - performance.now())
    remainingMsRef.current = nextRemaining
    setRemainingMs(nextRemaining)
    endTimeRef.current = null
  }

  // Calculate current segment (0-3 for 4 segments)
  const segmentDuration = duration / 4
  const elapsedSeconds = Math.max(0, duration - remainingMs / 1000)
  const currentSegment = Math.min(
    3,
    Math.floor(elapsedSeconds / segmentDuration)
  )

  // Calculate progress (0 to 1)
  const progress = Math.min(1, Math.max(0, elapsedSeconds / duration))
  const timeRemaining = Math.max(0, Math.ceil(remainingMs / 1000))

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

  // Ring color transitions: teal -> green -> gold
  const getRingColor = () => {
    if (progress < 0.33) return 'var(--color-secondary)'
    if (progress < 0.66) return 'var(--color-success)'
    return '#F0C040'
  }

  // Reset timer state when duration changes
  useEffect(() => {
    const initialMs = duration * 1000
    clearRaf()
    endTimeRef.current = null
    hasCompletedRef.current = false
    lastPaintedRemainingMsRef.current = initialMs
    remainingMsRef.current = initialMs
    setRemainingMs(initialMs)
  }, [duration])

  // Monotonic timer loop to avoid setInterval drift
  useEffect(() => {
    if (hasCompletedRef.current || remainingMsRef.current <= 0) return

    if (isPaused) {
      clearRaf()
      persistRemainingFromEndTime()
      return
    }

    endTimeRef.current = performance.now() + remainingMsRef.current

    const tick = () => {
      if (endTimeRef.current === null) return

      const nextRemaining = Math.max(0, endTimeRef.current - performance.now())
      remainingMsRef.current = nextRemaining
      // Paint at ~30 FPS to keep the ring smooth without over-rendering
      if (nextRemaining === 0 || Math.abs(nextRemaining - lastPaintedRemainingMsRef.current) >= 33) {
        lastPaintedRemainingMsRef.current = nextRemaining
        setRemainingMs(nextRemaining)
      }

      if (nextRemaining <= 0) {
        hasCompletedRef.current = true
        clearRaf()
        onComplete()
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return clearRaf
  }, [isPaused, onComplete])

  // Notify parent of segment changes
  useEffect(() => {
    if (timeRemaining <= 0) return
    onSegmentChange(currentSegment)
  }, [currentSegment, onSegmentChange, timeRemaining])

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

