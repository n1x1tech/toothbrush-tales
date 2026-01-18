import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import BrushTimer from '../components/timer/BrushTimer'
import StoryPlayer from '../components/story/StoryPlayer'
import PlaybackControls from '../components/story/PlaybackControls'
import type { Story } from '../hooks/useStoryGeneration'
import { useBrowserTTS } from '../hooks/useTextToSpeech'
import { useAppStore } from '../store/useAppStore'
import styles from './StoryPage.module.css'

// Fallback story if none provided
const createFallbackStory = (): Story => ({
  id: crypto.randomUUID(),
  characterName: 'Alex',
  theme: 'going on an adventure',
  intro: "This story is about Alex going on an adventure. Get ready to brush, here we go!",
  segments: [
    "Once upon a time, Alex woke up feeling super excited! Today was the day for a big adventure. WHOOOOSH! Alex jumped out of bed and did a silly dance, wiggling and giggling!",
    "Alex found a magical toothbrush that could talk! \"Hello friend!\" said the toothbrush. \"Let's make your teeth sparkle like stars!\" And they zoomed off on their journey together. ZOOM ZOOM!",
    "Along the way, Alex met a friendly dragon who loved clean teeth! The dragon showed them how to brush in circles. \"Round and round, up and down!\" they sang together. SPLISH SPLASH!",
    "Finally, Alex reached the end of the adventure with the shiniest, cleanest teeth ever! The magical toothbrush did a happy wiggle. \"You did it!\" cheered everyone. HOORAY!"
  ],
  brushingPrompts: [
    "Now brush your bottom teeth!",
    "Time to brush the top teeth!",
    "Brush the teeth on your left side!",
    "Brush the teeth on your right side!"
  ],
  conclusion: "Hooray! Your teeth are super clean and sparkly! Great job brushing! You're a toothbrushing champion!",
  audioUrl: null,
  isFavorite: false,
})

const INTRO_DURATION = 8000 // 8 seconds for intro

export default function StoryPage() {
  const location = useLocation()
  const navigate = useNavigate()

  // Store
  const { playbackMode, autoPlay, voiceId, addToHistory, toggleFavorite, isFavorite } = useAppStore()

  // Get story from navigation state, or use fallback
  const [story] = useState<Story>(() => {
    const passedStory = location.state?.story as Story | undefined
    if (passedStory) return passedStory
    return createFallbackStory()
  })

  // Phases: 'intro' -> 'brushing' -> 'complete'
  const [phase, setPhase] = useState<'intro' | 'brushing' | 'complete'>('intro')
  const [currentSegment, setCurrentSegment] = useState(0)
  const [spokenSegments, setSpokenSegments] = useState<Set<number>>(new Set())
  const hasSpokenIntro = useRef(false)

  // Browser TTS (free, works offline)
  const { speak, stop, pause, resume, isSpeaking } = useBrowserTTS()

  // Add story to history on mount
  useEffect(() => {
    addToHistory(story)
  }, [story, addToHistory])

  // Speak intro immediately on mount
  useEffect(() => {
    if (phase === 'intro' && autoPlay && (playbackMode === 'audio' || playbackMode === 'both') && !hasSpokenIntro.current) {
      hasSpokenIntro.current = true
      speak(story.intro, voiceId)
    }
  }, [phase, autoPlay, playbackMode, speak, story.intro, voiceId])

  // Transition from intro to brushing after INTRO_DURATION
  useEffect(() => {
    if (phase === 'intro') {
      const timer = setTimeout(() => {
        setPhase('brushing')
      }, INTRO_DURATION)
      return () => clearTimeout(timer)
    }
  }, [phase])

  // Get current text to speak
  const getCurrentText = useCallback(() => {
    if (phase === 'complete') return story.conclusion
    if (phase === 'intro') return story.intro
    if (currentSegment < story.segments.length) {
      return story.segments[currentSegment]
    }
    return ''
  }, [currentSegment, phase, story])

  // Auto-play TTS when segment changes during brushing phase
  useEffect(() => {
    if (
      phase === 'brushing' &&
      autoPlay &&
      (playbackMode === 'audio' || playbackMode === 'both') &&
      !spokenSegments.has(currentSegment)
    ) {
      // Speak brushing prompt + segment text
      const promptText = story.brushingPrompts[currentSegment] || ''
      const segmentText = story.segments[currentSegment] || ''

      if (segmentText) {
        const fullText = promptText ? `${promptText}... ${segmentText}` : segmentText
        speak(fullText, voiceId)
        setSpokenSegments(prev => new Set(prev).add(currentSegment))
      }
    }
  }, [currentSegment, phase, autoPlay, playbackMode, speak, spokenSegments, story.brushingPrompts, story.segments, voiceId])

  // Speak conclusion when complete
  useEffect(() => {
    if (phase === 'complete' && autoPlay && (playbackMode === 'audio' || playbackMode === 'both')) {
      speak(story.conclusion, voiceId)
    }
  }, [phase, autoPlay, playbackMode, speak, story.conclusion, voiceId])

  // Cleanup on unmount
  useEffect(() => {
    return () => stop()
  }, [stop])

  const handleSegmentChange = (segment: number) => {
    if (phase === 'brushing') {
      setCurrentSegment(segment)
    }
  }

  const handleTimerComplete = () => {
    setPhase('complete')
  }

  const handlePlayAgain = () => {
    stop()
    navigate('/')
  }

  const handlePlay = () => {
    if (isSpeaking) {
      resume()
    } else {
      speak(getCurrentText(), voiceId)
    }
  }

  const handlePause = () => {
    pause()
  }

  const handleStop = () => {
    stop()
  }

  const handleToggleFavorite = () => {
    toggleFavorite(story.id)
  }

  // Convert phase to segment for StoryPlayer
  const displaySegment = phase === 'intro' ? -1 : currentSegment

  return (
    <div className={styles.container}>
      <PlaybackControls
        isPlaying={isSpeaking}
        isPaused={false}
        isSynthesizing={false}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
      />

      {phase === 'intro' ? (
        <div className={styles.introTimer}>
          <span className={styles.getReady}>Get Ready!</span>
          <span className={styles.countdown}>Starting soon...</span>
        </div>
      ) : (
        <BrushTimer
          duration={120}
          onSegmentChange={handleSegmentChange}
          onComplete={handleTimerComplete}
          isPaused={false}
        />
      )}

      <StoryPlayer
        story={story}
        currentSegment={displaySegment}
        isComplete={phase === 'complete'}
      />

      <div className={styles.actions}>
        <button
          className={`${styles.favoriteButton} ${isFavorite(story.id) ? styles.favorited : ''}`}
          onClick={handleToggleFavorite}
        >
          {isFavorite(story.id) ? '⭐ Favorited' : '☆ Add to Favorites'}
        </button>

        {phase === 'complete' && (
          <button className={styles.playAgainButton} onClick={handlePlayAgain}>
            Brush Again!
          </button>
        )}
      </div>
    </div>
  )
}
