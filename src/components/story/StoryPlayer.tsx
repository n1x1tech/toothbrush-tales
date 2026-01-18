import { useState, useEffect } from 'react'
import styles from './StoryPlayer.module.css'

interface Story {
  intro: string
  segments: string[]
  brushingPrompts: string[]
  conclusion: string
}

interface StoryPlayerProps {
  story: Story
  currentSegment: number // -1 = intro, 0-3 = segments, 4 = conclusion
  isComplete: boolean
}

export default function StoryPlayer({
  story,
  currentSegment,
  isComplete
}: StoryPlayerProps) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [prevSegment, setPrevSegment] = useState(currentSegment)

  // Show brushing prompt when segment changes
  useEffect(() => {
    if (currentSegment > prevSegment && currentSegment >= 0 && currentSegment < 4) {
      setShowPrompt(true)
      const timer = setTimeout(() => setShowPrompt(false), 3000)
      return () => clearTimeout(timer)
    }
    setPrevSegment(currentSegment)
  }, [currentSegment, prevSegment])

  const getCurrentContent = () => {
    if (isComplete) {
      return {
        type: 'conclusion',
        text: story.conclusion
      }
    }
    if (currentSegment < 0) {
      return {
        type: 'intro',
        text: story.intro
      }
    }
    return {
      type: 'segment',
      text: story.segments[currentSegment] || ''
    }
  }

  const content = getCurrentContent()

  return (
    <div className={styles.container}>
      {showPrompt && currentSegment >= 0 && currentSegment < 4 && (
        <div className={styles.brushingPrompt}>
          <span className={styles.promptIcon}>🪥</span>
          <span className={styles.promptText}>
            {story.brushingPrompts[currentSegment]}
          </span>
        </div>
      )}

      <div className={`${styles.storyCard} ${styles[content.type]}`}>
        {content.type === 'intro' && (
          <div className={styles.introLabel}>Story Time!</div>
        )}
        {content.type === 'conclusion' && (
          <div className={styles.celebrationEmojis}>🎉✨🌟</div>
        )}
        <p className={styles.storyText}>{content.text}</p>
        {content.type === 'conclusion' && (
          <div className={styles.celebrationEmojis}>🌟✨🎉</div>
        )}
      </div>

      {!isComplete && (
        <div className={styles.segmentIndicator}>
          {currentSegment < 0 ? 'Get ready!' : `Part ${currentSegment + 1} of 4`}
        </div>
      )}
    </div>
  )
}
