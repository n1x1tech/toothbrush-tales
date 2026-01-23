import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'
import BrushTimer from '../components/timer/BrushTimer'
import StoryPlayer from '../components/story/StoryPlayer'
import PlaybackControls from '../components/story/PlaybackControls'
import type { Story } from '../hooks/useStoryGeneration'
import { useAppStore } from '../store/useAppStore'
import styles from './StoryPage.module.css'

const client = generateClient<Schema>()

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

  // Phases: 'waiting' -> 'intro' -> 'brushing' -> 'complete'
  // 'waiting' phase requires user tap to unlock audio on iOS
  const [phase, setPhase] = useState<'waiting' | 'intro' | 'brushing' | 'complete'>('waiting')
  const [currentSegment, setCurrentSegment] = useState(0)
  const [spokenSegments, setSpokenSegments] = useState<Set<number>>(new Set())
  const hasSpokenIntro = useRef(false)
  const audioUnlocked = useRef(false)

  // Polly TTS state
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [ttsError, setTtsError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioQueueRef = useRef<{ text: string; voiceId: string; retries: number }[]>([])
  const isProcessingQueueRef = useRef(false)
  const introAudioDoneRef = useRef(false)

  // Constants for retry and timeout
  const MAX_RETRIES = 2
  const SYNTHESIS_TIMEOUT = 15000 // 15 seconds

  // Synthesize text to audio URL with timeout protection
  const synthesize = useCallback(async (text: string, voiceIdToUse: string): Promise<string | null> => {
    setIsSynthesizing(true)
    setTtsError(null)

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Synthesis timeout')), SYNTHESIS_TIMEOUT)
      })

      // Race between the actual call and timeout
      const result = await Promise.race([
        client.queries.synthesizeSpeech({
          text,
          voiceId: voiceIdToUse,
        }),
        timeoutPromise
      ])

      if (result.errors || !result.data) {
        console.error('TTS error:', result.errors)
        return null
      }

      return result.data
    } catch (error) {
      console.error('TTS synthesis error:', error)
      return null
    } finally {
      setIsSynthesizing(false)
    }
  }, [])

  // Play a single audio URL and return a promise that resolves when done
  const playAudioUrl = useCallback((url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url)
      audioRef.current = audio

      audio.onplay = () => setIsSpeaking(true)
      audio.onended = () => {
        setIsSpeaking(false)
        audioRef.current = null
        resolve()
      }
      audio.onerror = () => {
        setIsSpeaking(false)
        audioRef.current = null
        reject(new Error('Audio playback failed'))
      }

      audio.play().catch((err) => {
        audioRef.current = null
        reject(err)
      })
    })
  }, [])

  // Process the audio queue sequentially with retry logic
  const processQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) return
    isProcessingQueueRef.current = true

    while (audioQueueRef.current.length > 0) {
      const item = audioQueueRef.current[0] // Peek, don't shift yet
      if (!item) break

      try {
        const audioUrl = await synthesize(item.text, item.voiceId)
        if (audioUrl) {
          await playAudioUrl(audioUrl)
          // Success - remove from queue
          audioQueueRef.current.shift()
          setTtsError(null)

          // Mark intro as done if this was the first item (intro)
          if (!introAudioDoneRef.current) {
            introAudioDoneRef.current = true
          }
        } else {
          // Synthesis returned null - retry or skip
          if (item.retries < MAX_RETRIES) {
            console.warn(`Retrying synthesis (attempt ${item.retries + 1}/${MAX_RETRIES})`)
            item.retries++
            // Wait a bit before retry
            await new Promise(resolve => setTimeout(resolve, 1000))
          } else {
            // Max retries reached - skip this item
            console.error('Max retries reached, skipping item')
            audioQueueRef.current.shift()
            setTtsError('Audio temporarily unavailable. Story will continue in text mode.')
          }
        }
      } catch (error) {
        console.error('Queue playback error:', error)
        // Retry on playback error
        if (item.retries < MAX_RETRIES) {
          item.retries++
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          audioQueueRef.current.shift()
          setTtsError('Audio playback failed. Story will continue in text mode.')
        }
      }
    }

    isProcessingQueueRef.current = false
  }, [synthesize, playAudioUrl])

  // Add text to queue and start processing
  const queueSpeech = useCallback((text: string, voiceIdToUse: string) => {
    audioQueueRef.current.push({ text, voiceId: voiceIdToUse, retries: 0 })
    processQueue()
  }, [processQueue])

  // Speak immediately (used for manual play button)
  const speakNow = useCallback(async (text: string, voiceIdToUse: string) => {
    const audioUrl = await synthesize(text, voiceIdToUse)
    if (audioUrl) {
      try {
        await playAudioUrl(audioUrl)
      } catch (error) {
        console.error('Playback error:', error)
      }
    }
  }, [synthesize, playAudioUrl])

  const stop = useCallback(() => {
    // Clear the queue
    audioQueueRef.current = []
    isProcessingQueueRef.current = false
    introAudioDoneRef.current = false

    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setIsSpeaking(false)
    setTtsError(null)
  }, [])

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsSpeaking(false)
    }
  }, [])

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play()
      setIsSpeaking(true)
    }
  }, [])

  // Add story to history on mount
  useEffect(() => {
    addToHistory(story)
  }, [story, addToHistory])

  // Note: Intro speech is now triggered by handleStartStory to work on iOS

  // Transition from intro to brushing when intro audio finishes (or after max wait time)
  useEffect(() => {
    if (phase === 'intro') {
      let transitioned = false

      // Check periodically if intro audio is done
      const checkInterval = setInterval(() => {
        if (introAudioDoneRef.current && !isSpeaking && !transitioned) {
          transitioned = true
          clearInterval(checkInterval)
          setPhase('brushing')
        }
      }, 500)

      // Fallback: transition after max wait time regardless
      const maxWaitTimer = setTimeout(() => {
        if (!transitioned) {
          transitioned = true
          clearInterval(checkInterval)
          setPhase('brushing')
        }
      }, INTRO_DURATION + 10000) // Give extra 10 seconds beyond base duration

      return () => {
        clearInterval(checkInterval)
        clearTimeout(maxWaitTimer)
      }
    }
  }, [phase, isSpeaking])

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
      // Queue brushing prompt + segment text (won't interrupt current playback)
      const promptText = story.brushingPrompts[currentSegment] || ''
      const segmentText = story.segments[currentSegment] || ''

      if (segmentText) {
        const fullText = promptText ? `${promptText}... ${segmentText}` : segmentText
        queueSpeech(fullText, voiceId)
        setSpokenSegments(prev => new Set(prev).add(currentSegment))
      }
    }
  }, [currentSegment, phase, autoPlay, playbackMode, queueSpeech, spokenSegments, story.brushingPrompts, story.segments, voiceId])

  // Queue conclusion when complete
  useEffect(() => {
    if (phase === 'complete' && autoPlay && (playbackMode === 'audio' || playbackMode === 'both')) {
      queueSpeech(story.conclusion, voiceId)
    }
  }, [phase, autoPlay, playbackMode, queueSpeech, story.conclusion, voiceId])

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
      speakNow(getCurrentText(), voiceId)
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

  // Handle tap to start - unlocks audio on iOS and starts the story
  const handleStartStory = () => {
    // Reset audio tracking
    introAudioDoneRef.current = false
    setTtsError(null)

    // Move to intro phase IMMEDIATELY (synchronously)
    setPhase('intro')

    // Unlock audio on iOS by playing a tiny silent sound from user gesture
    // Do this without awaiting to prevent blocking
    if (!audioUnlocked.current) {
      try {
        const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=')
        silentAudio.play()
          .then(() => {
            silentAudio.pause()
            audioUnlocked.current = true
          })
          .catch(() => {
            // Audio unlock failed, but continue anyway
            audioUnlocked.current = true
          })
      } catch (e) {
        // Ignore errors, continue with the story
        audioUnlocked.current = true
      }
    }

    // Queue intro speech if audio is enabled
    if (autoPlay && (playbackMode === 'audio' || playbackMode === 'both')) {
      hasSpokenIntro.current = true
      queueSpeech(story.intro, voiceId)
    }
  }

  // Convert phase to segment for StoryPlayer
  const displaySegment = phase === 'intro' ? -1 : currentSegment

  // Show tap to start screen on mobile
  if (phase === 'waiting') {
    return (
      <div className={styles.container}>
        <div className={styles.waitingScreen}>
          <h1 className={styles.waitingTitle}>Ready to Brush?</h1>
          <p className={styles.waitingText}>
            Get your toothbrush ready and tap the button to start your adventure!
          </p>
          <button
            type="button"
            className={styles.startButton}
            onClick={handleStartStory}
          >
            Tap to Start!
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {ttsError && (
        <div className={styles.errorBanner} onClick={() => setTtsError(null)}>
          {ttsError}
          <span className={styles.dismissError}>✕</span>
        </div>
      )}

      <PlaybackControls
        isPlaying={isSpeaking}
        isPaused={false}
        isSynthesizing={isSynthesizing}
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
