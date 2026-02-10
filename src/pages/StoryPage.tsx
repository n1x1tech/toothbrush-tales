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
      const result = await client.queries.synthesizeSpeech({
        text,
        voiceId: voiceIdToUse,
      })

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

      try {
        const audioUrl = await synthesize(item.text, item.voiceId)
        if (audioUrl) {
          console.log('[TTS] Got audio URL, playing...')
          await playAudioUrl(audioUrl)
          console.log('[TTS] Playback complete')
          // Small delay between items to let browser stabilize
          await new Promise(resolve => setTimeout(resolve, 100))
        } else {
          console.error('[TTS] synthesize returned null')
        }
      } catch (error) {
        console.error('[TTS] Queue playback error:', error)
        // On error, wait before trying next item
        await new Promise(resolve => setTimeout(resolve, 200))
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

    // Stop current audio (but keep the element for reuse)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
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

  // Note: Intro speech is now triggered by handleStartStory to work on iOS

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
    console.log('[TTS] Auto-play effect:', { phase, currentSegment, autoPlay, playbackMode, hasSpoken: spokenSegments.has(currentSegment) })
    if (
      phase === 'brushing' &&
      autoPlay &&
      (playbackMode === 'audio' || playbackMode === 'both') &&
      !spokenSegments.has(currentSegment)
    ) {
      // Queue brushing prompt + segment text (won't interrupt current playback)
      const promptText = story.brushingPrompts[currentSegment] || ''
      const segmentText = story.segments[currentSegment] || ''

      console.log('[TTS] Conditions met, queueing segment', currentSegment)
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

  // Cleanup on unmount - just stop playback, audio element cleanup handled separately
  useEffect(() => {
    return () => {
      audioQueueRef.current = []
      isProcessingQueueRef.current = false
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

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

  // Handle tap to start - starts the story with audio from user gesture
  const handleStartStory = async () => {
    console.log('[TTS] handleStartStory called')
    console.log('[TTS] Settings:', { autoPlay, playbackMode, voiceId })

    // Move to intro phase IMMEDIATELY (synchronously)
    setPhase('intro')

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

      // Queue intro through the queue system to prevent race conditions
      // with segment playback that starts after INTRO_DURATION
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
      {story.isFallback && (
        <div className={styles.fallbackNotice}>
          <span>Using a built-in story (AI generation was unavailable). Try again later for a custom story!</span>
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
