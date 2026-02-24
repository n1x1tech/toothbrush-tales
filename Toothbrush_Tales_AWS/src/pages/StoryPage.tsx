import { useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Schema } from '../../amplify/data/resource'
import BrushTimer from '../components/timer/BrushTimer'
import StoryPlayer from '../components/story/StoryPlayer'
import PlaybackControls from '../components/story/PlaybackControls'
import type { Story } from '../hooks/useStoryGeneration'
import { useAppStore } from '../store/useAppStore'
import { trackTelemetryEvent } from '../lib/telemetry'
import { getAmplifyDataClient } from '../services/amplifyClient'
import styles from './StoryPage.module.css'

// Fallback story if none provided (e.g., direct navigation to /story)
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
  isFallback: true,
})

const MIN_INTRO_DURATION = 5000 // Don't transition too fast
const MAX_INTRO_DURATION = 25000 // Safety timeout
const TTS_REQUEST_TIMEOUT_MS = 35000

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
  const introAudioDoneRef = useRef(false)
  const introMinElapsedRef = useRef(false)
  const onQueueItemCompleteRef = useRef<(() => void) | null>(null)
  const sessionIdRef = useRef(crypto.randomUUID())

  // Polly TTS state
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [ttsError, setTtsError] = useState<string | null>(null)
  const [backgroundPauseNotice, setBackgroundPauseNotice] = useState<string | null>(null)
  const [isTimerPaused, setIsTimerPaused] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const amplifyClientRef = useRef<any>(null)
  const audioQueueRef = useRef<{ text: string; voiceId: string }[]>([])
  const isProcessingQueueRef = useRef(false)

  // Create audio element on mount - attached to DOM with explicit properties
  useEffect(() => {
    const audio = document.createElement('audio')
    audio.preload = 'auto'
    audio.volume = 1
    audio.muted = false
    audio.style.display = 'none'
    document.body.appendChild(audio)
    audioRef.current = audio
    console.log('[TTS] Audio element created and attached to DOM')
    return () => {
      audio.pause()
      audio.remove()
      audioRef.current = null
    }
  }, [])

  // Synthesize text to audio URL
  const synthesize = useCallback(async (text: string, voiceIdToUse: string): Promise<string | null> => {
    console.log('[TTS] synthesize called for voice:', voiceIdToUse)
    setIsSynthesizing(true)
    setTtsError(null) // Clear previous errors
    try {
      if (!amplifyClientRef.current) {
        amplifyClientRef.current = await getAmplifyDataClient<Schema>()
      }

      const result = await Promise.race([
        amplifyClientRef.current.queries.synthesizeSpeech({
          text,
          voiceId: voiceIdToUse,
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Voice narration timed out')), TTS_REQUEST_TIMEOUT_MS)
        }),
      ])

      console.log('[TTS] synthesize result:', { hasErrors: !!result.errors, hasData: !!result.data, dataLength: result.data?.length })

      if (result.errors || !result.data) {
        console.error('[TTS] Synthesis error:', result.errors)
        const errorMsg = result.errors?.[0]?.message || 'Voice narration unavailable'
        setTtsError(errorMsg)
        return null
      }

      return result.data
    } catch (error) {
      console.error('[TTS] Synthesis exception:', error)
      setTtsError('Voice narration unavailable - please check your connection')
      return null
    } finally {
      setIsSynthesizing(false)
    }
  }, [])

  // Play a single audio URL and return a promise that resolves when done
  const playAudioUrl = useCallback((url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log('[TTS] playAudioUrl called, URL length:', url?.length)

      const audio = audioRef.current
      if (!audio) {
        console.error('[TTS] No audio element available')
        reject(new Error('No audio element'))
        return
      }

      // Clear ALL previous handlers to prevent memory leaks and conflicts
      audio.oncanplaythrough = null
      audio.oncanplay = null
      audio.onloadedmetadata = null
      audio.onloadeddata = null
      audio.onplay = null
      audio.onended = null
      audio.onerror = null
      audio.onabort = null

      // Ensure audio properties are correct
      audio.volume = 1
      audio.muted = false
      audio.currentTime = 0

      let hasStartedPlaying = false
      let hasEnded = false
      let playbackTimeout: ReturnType<typeof setTimeout> | null = null

      const cleanup = () => {
        if (playbackTimeout) {
          clearTimeout(playbackTimeout)
          playbackTimeout = null
        }
        audio.oncanplaythrough = null
        audio.oncanplay = null
        audio.onloadedmetadata = null
        audio.onloadeddata = null
        audio.onplay = null
        audio.onended = null
        audio.onerror = null
        audio.onabort = null
      }

      const tryPlay = (source: string) => {
        if (hasStartedPlaying) return
        hasStartedPlaying = true
        console.log(`[TTS] ${source} fired, starting playback`)

        audio.play().then(() => {
          console.log('[TTS] audio.play() promise resolved')
        }).catch((err) => {
          console.error('[TTS] audio.play() rejected:', err)
          cleanup()
          reject(err)
        })
      }

      audio.onloadedmetadata = () => {
        console.log('[TTS] Audio metadata loaded, duration:', audio.duration, 'seconds')
      }

      // Use canplay (fires earlier than canplaythrough) - more reliable for data URLs
      audio.oncanplay = () => tryPlay('canplay')
      audio.oncanplaythrough = () => tryPlay('canplaythrough')

      // Fallback: if data URL is already loaded, loadeddata fires before canplay in some browsers
      audio.onloadeddata = () => {
        console.log('[TTS] loadeddata fired, readyState:', audio.readyState)
        if (audio.readyState >= 3) {
          tryPlay('loadeddata')
        }
      }

      audio.onplay = () => {
        console.log('[TTS] Audio onplay fired')
        setIsSpeaking(true)
      }

      audio.onended = () => {
        if (hasEnded) return
        hasEnded = true
        console.log('[TTS] Audio onended fired, played duration:', audio.currentTime)
        setIsSpeaking(false)
        cleanup()
        // Add delay before resolving to give browser time to cleanup
        setTimeout(() => resolve(), 150)
      }

      audio.onerror = (e) => {
        console.error('[TTS] Audio onerror:', e, audio.error)
        setIsSpeaking(false)
        cleanup()
        reject(new Error('Audio playback failed'))
      }

      // Set source and explicitly load - some browsers need load() for data URLs
      console.log('[TTS] Setting audio src and calling load()')
      audio.src = url
      audio.load()

      // Safety timeout: if no event fires within 5 seconds, try to play anyway
      playbackTimeout = setTimeout(() => {
        if (!hasStartedPlaying && audio.readyState >= 2) {
          console.warn('[TTS] No load event fired after 5s, forcing play (readyState:', audio.readyState, ')')
          tryPlay('timeout-fallback')
        } else if (!hasStartedPlaying) {
          console.error('[TTS] Audio failed to load after 5s, readyState:', audio.readyState)
          cleanup()
          reject(new Error('Audio failed to load'))
        }
      }, 5000)
    })
  }, [])

  // Process the audio queue sequentially
  const processQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) {
      console.log('[TTS] processQueue already running, skipping')
      return
    }
    isProcessingQueueRef.current = true
    console.log('[TTS] processQueue started')

    while (audioQueueRef.current.length > 0) {
      const item = audioQueueRef.current.shift()
      if (!item) break

      console.log('[TTS] Processing item:', item.text.substring(0, 50) + '...')

      // Reset audio element fully before each new play
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }

      try {
        const audioUrl = await synthesize(item.text, item.voiceId)
        if (audioUrl) {
          console.log('[TTS] Got audio URL, playing...')
          await playAudioUrl(audioUrl)
          console.log('[TTS] Playback complete')
          // Call completion callback if set
          if (onQueueItemCompleteRef.current) {
            onQueueItemCompleteRef.current()
            onQueueItemCompleteRef.current = null
          }
          // Natural breathing pause between items
          await new Promise(resolve => setTimeout(resolve, 300))
        } else {
          console.error('[TTS] synthesize returned null')
          // Still call completion callback on failure so intro doesn't hang
          if (onQueueItemCompleteRef.current) {
            onQueueItemCompleteRef.current()
            onQueueItemCompleteRef.current = null
          }
        }
      } catch (error) {
        console.error('[TTS] Queue playback error:', error)
        if (onQueueItemCompleteRef.current) {
          onQueueItemCompleteRef.current()
          onQueueItemCompleteRef.current = null
        }
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    console.log('[TTS] processQueue finished, queue empty')
    isProcessingQueueRef.current = false
  }, [synthesize, playAudioUrl])

  // Add text to queue and start processing
  const queueSpeech = useCallback((text: string, voiceIdToUse: string) => {
    console.log('[TTS] queueSpeech called:', text.substring(0, 50) + '...', 'voice:', voiceIdToUse)
    console.log('[TTS] Queue length before push:', audioQueueRef.current.length)
    audioQueueRef.current.push({ text, voiceId: voiceIdToUse })
    console.log('[TTS] Queue length after push:', audioQueueRef.current.length)
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
    onQueueItemCompleteRef.current = null

    // Stop current audio and fully clear state
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
    }
    setIsSpeaking(false)
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

  // Transition from intro to brushing when audio finishes (with min/max bounds)
  useEffect(() => {
    if (phase !== 'intro') return

    const shouldPlayAudio = autoPlay && (playbackMode === 'audio' || playbackMode === 'both')

    // Try to transition: both audio done AND min duration elapsed
    const tryTransition = () => {
      if (introAudioDoneRef.current && introMinElapsedRef.current) {
        setPhase('brushing')
      }
    }

    // Min duration timer - don't transition too fast
    const minTimer = setTimeout(() => {
      introMinElapsedRef.current = true
      tryTransition()
    }, MIN_INTRO_DURATION)

    // Max duration timer - safety net
    const maxTimer = setTimeout(() => {
      console.warn('[TTS] Max intro duration reached, forcing transition')
      setPhase('brushing')
    }, MAX_INTRO_DURATION)

    // For text-only mode, mark audio as "done" immediately
    if (!shouldPlayAudio) {
      introAudioDoneRef.current = true
    }

    return () => {
      clearTimeout(minTimer)
      clearTimeout(maxTimer)
    }
  }, [phase, autoPlay, playbackMode])

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
    console.log('[TTS] Auto-play effect:', { phase, currentSegment, autoPlay, playbackMode, hasSpoken: spokenSegments.has(currentSegment) })
    if (
      phase === 'brushing' &&
      autoPlay &&
      (playbackMode === 'audio' || playbackMode === 'both') &&
      !spokenSegments.has(currentSegment)
    ) {
      // Queue brushing prompt and segment text as separate items for cleaner transitions
      const promptText = story.brushingPrompts[currentSegment] || ''
      const segmentText = story.segments[currentSegment] || ''

      console.log('[TTS] Conditions met, queueing segment', currentSegment)
      if (segmentText) {
        if (promptText) {
          queueSpeech(promptText, voiceId)
        }
        queueSpeech(segmentText, voiceId)
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
    return () => {
      audioQueueRef.current = []
      isProcessingQueueRef.current = false
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  // Auto-pause session when the app is backgrounded for more than 5 seconds
  useEffect(() => {
    let hiddenAt: number | null = null

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }

      if (hiddenAt === null) return
      const hiddenDurationMs = Date.now() - hiddenAt
      hiddenAt = null

      if (phase !== 'brushing') return
      if (hiddenDurationMs < 5000) return

      setIsTimerPaused(true)
      pause()
      setBackgroundPauseNotice('Paused because the app was in the background. Tap Play to continue.')
      trackTelemetryEvent('session_pause', {
        sessionId: sessionIdRef.current,
        phase,
        currentSegment,
        autoPlay,
        playbackMode,
        reason: 'background_timeout',
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [phase, pause, currentSegment, autoPlay, playbackMode])

  const handleSegmentChange = (segment: number) => {
    if (phase === 'brushing') {
      setCurrentSegment(segment)
    }
  }

  const handleTimerComplete = () => {
    setIsTimerPaused(true)
    trackTelemetryEvent('session_complete', {
      sessionId: sessionIdRef.current,
      phase: 'complete',
      currentSegment,
      autoPlay,
      playbackMode,
    })
    setPhase('complete')
  }

  const handlePlayAgain = () => {
    stop()
    navigate('/')
  }

  const handlePlay = () => {
    if (isTimerPaused) {
      setIsTimerPaused(false)
      setBackgroundPauseNotice(null)
      trackTelemetryEvent('session_resume', {
        sessionId: sessionIdRef.current,
        phase,
        currentSegment,
        autoPlay,
        playbackMode,
      })
      resume()
      return
    }

    if (isSpeaking) {
      resume()
    } else {
      speakNow(getCurrentText(), voiceId)
    }
  }

  const handlePause = () => {
    setIsTimerPaused(true)
    setBackgroundPauseNotice(null)
    trackTelemetryEvent('session_pause', {
      sessionId: sessionIdRef.current,
      phase,
      currentSegment,
      autoPlay,
      playbackMode,
    })
    pause()
  }

  const handleStop = () => {
    setIsTimerPaused(true)
    setBackgroundPauseNotice(null)
    trackTelemetryEvent('session_stop', {
      sessionId: sessionIdRef.current,
      phase,
      currentSegment,
      autoPlay,
      playbackMode,
    })
    stop()
  }

  const handleToggleFavorite = () => {
    toggleFavorite(story.id)
  }

  // Handle tap to start - starts the story with audio from user gesture
  const handleStartStory = async () => {
    console.log('[TTS] handleStartStory called')
    console.log('[TTS] Settings:', { autoPlay, playbackMode, voiceId })

    // Reset intro tracking
    introAudioDoneRef.current = false
    introMinElapsedRef.current = false
    sessionIdRef.current = crypto.randomUUID()
    setIsTimerPaused(false)
    setBackgroundPauseNotice(null)

    // Move to intro phase IMMEDIATELY (synchronously)
    setPhase('intro')
    trackTelemetryEvent('session_start', {
      sessionId: sessionIdRef.current,
      phase: 'intro',
      currentSegment: 0,
      autoPlay,
      playbackMode,
    })

    // Check if audio should be played
    const shouldPlayAudio = autoPlay && (playbackMode === 'audio' || playbackMode === 'both')
    console.log('[TTS] Should play audio:', shouldPlayAudio)

    if (shouldPlayAudio) {
      hasSpokenIntro.current = true
      audioUnlocked.current = true

      // Unlock audio context from user gesture by playing a tiny silent sound
      // This ensures subsequent queue-driven playback works on iOS/mobile
      try {
        const audio = audioRef.current
        if (audio) {
          // Create a minimal silent audio to unlock the audio element
          // This is a tiny valid MP3 frame (silence)
          audio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwSHAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwSHAAAAAAAAAAAAAAAAAAAA'
          await audio.play()
          audio.pause()
          audio.currentTime = 0
          console.log('[TTS] Audio context unlocked from user gesture')
        }
      } catch (e) {
        console.warn('[TTS] Audio unlock failed (may still work):', e)
      }

      // Set completion callback - when intro audio finishes, mark it done
      onQueueItemCompleteRef.current = () => {
        console.log('[TTS] Intro audio finished')
        introAudioDoneRef.current = true
        // If min duration already elapsed, transition now
        if (introMinElapsedRef.current) {
          setPhase('brushing')
        }
      }

      // Queue intro through the queue system
      console.log('[TTS] Queueing intro speech')
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
          <div className={styles.sparkles}>
            <span className={styles.sparkle}>{'\u2728'}</span>
            <span className={styles.sparkle}>{'\u2B50'}</span>
            <span className={styles.sparkle}>{'\uD83C\uDF1F'}</span>
            <span className={styles.sparkle}>{'\u2728'}</span>
            <span className={styles.sparkle}>{'\u2B50'}</span>
            <span className={styles.sparkle}>{'\uD83C\uDF1F'}</span>
          </div>
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
        <div className={styles.ttsError}>
          <span>Audio unavailable</span>
          <button onClick={() => setTtsError(null)} className={styles.dismissError}>×</button>
        </div>
      )}
      {backgroundPauseNotice && (
        <div className={styles.pauseNotice} role="status" aria-live="polite">
          {backgroundPauseNotice}
        </div>
      )}
      {story.isFallback && (
        <div className={styles.fallbackNotice}>
          <span>Using a built-in story (AI generation was unavailable). Try again later for a custom story!</span>
        </div>
      )}
      <PlaybackControls
        isPlaying={isSpeaking}
        isPaused={isTimerPaused}
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
          isPaused={isTimerPaused}
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
          {isFavorite(story.id) ? '\u2B50 Favorited' : '\u2606 Add to Favorites'}
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




