import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore, PlaybackMode, AgeRange, VoiceMode, PAYWALL_ENABLED } from '../store/useAppStore'
import { db, ensureAuth } from '../lib/firebase'
import { trackEvent } from '../lib/analytics'
import { collection, addDoc, onSnapshot, doc } from 'firebase/firestore'
import { getAvailableVoices, VoiceOption } from '../hooks/useTextToSpeech'
import styles from './SettingsPage.module.css'

const AGE_RANGES: { value: AgeRange; label: string; description: string }[] = [
  { value: '2-5', label: 'Ages 2-5', description: 'Very simple words, short sentences, silly sounds' },
  { value: '5-10', label: 'Ages 5-10', description: 'Playful and clear, the classic experience' },
  { value: '10-15', label: 'Ages 10-15', description: 'More adventure, richer vocabulary, longer narrative' },
]

const PLAYBACK_MODES: { value: PlaybackMode; label: string; description: string }[] = [
  { value: 'audio', label: 'Audio Only', description: 'Listen to the story being read aloud' },
  { value: 'text', label: 'Text Only', description: 'Read the story on screen' },
  { value: 'both', label: 'Audio + Text', description: 'Listen and read along' },
]

const VOICE_MODES: { value: VoiceMode; label: string; description: string }[] = [
  { value: 'device', label: 'Device Voices', description: "Free, works offline. Uses your phone's built-in voices." },
  { value: 'cloud', label: 'Premium Voices', description: 'Higher-quality natural AI voices. Requires internet.' },
]

// Google Cloud TTS voices - using friendly names that map to voice IDs on the backend
interface TTSVoice {
  id: string
  name: string
  accent: string
  description: string
}

const TTS_VOICES: TTSVoice[] = [
  // Australian
  { id: 'Olivia', name: 'Olivia', accent: 'Australian', description: 'Natural & warm' },

  // British
  { id: 'Amy', name: 'Amy', accent: 'British', description: 'Natural & clear' },
  { id: 'Emma', name: 'Emma', accent: 'British', description: 'Natural & warm' },
  { id: 'Brian', name: 'Brian', accent: 'British', description: 'Gentle' },
  { id: 'Arthur', name: 'Arthur', accent: 'British', description: 'Warm' },

  // American
  { id: 'Joanna', name: 'Joanna', accent: 'American', description: 'Natural & friendly (Recommended)' },
  { id: 'Kevin', name: 'Kevin', accent: 'American', description: 'Natural & casual' },
  { id: 'Matthew', name: 'Matthew', accent: 'American', description: 'Natural & gentle' },
  { id: 'Ivy', name: 'Ivy', accent: 'American', description: 'Expressive' },
  { id: 'Ruth', name: 'Ruth', accent: 'American', description: 'Expressive' },
  { id: 'Salli', name: 'Salli', accent: 'American', description: 'Friendly' },
  { id: 'Joey', name: 'Joey', accent: 'American', description: 'Casual' },
  { id: 'Kendra', name: 'Kendra', accent: 'American', description: 'Clear' },

  // Indian
  { id: 'Kajal', name: 'Kajal', accent: 'Indian', description: 'Warm' },
]

const TTS_PREVIEW_TIMEOUT_MS = 35000

export default function SettingsPage() {
  const {
    ageRange,
    setAgeRange,
    playbackMode,
    setPlaybackMode,
    voiceMode,
    setVoiceMode,
    voiceId,
    setVoiceId,
    deviceVoiceId,
    setDeviceVoiceId,
    autoPlay,
    setAutoPlay,
    clearHistory,
    entitlement,
    openPaywall,
  } = useAppStore()

  // When paywall is disabled (v1), cloud voices are available to everyone.
  const isPremium = !PAYWALL_ENABLED || entitlement === 'premium'

  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Device voices load asynchronously in some browsers — listen for changes.
  const [deviceVoices, setDeviceVoices] = useState<VoiceOption[]>(() => getAvailableVoices())
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const refresh = () => setDeviceVoices(getAvailableVoices())
    refresh()
    window.speechSynthesis.onvoiceschanged = refresh
    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  // Preview a device voice via the browser's built-in SpeechSynthesis
  const previewDeviceVoice = (voice: VoiceOption) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setPreviewError('This device does not support browser voices.')
      return
    }
    window.speechSynthesis.cancel()
    setPreviewingVoice(voice.id)
    setPreviewError(null)

    const utterance = new SpeechSynthesisUtterance(
      `Hi there! I'm ${voice.name}. Let's brush those teeth and make them sparkle!`
    )
    utterance.rate = 0.9
    utterance.pitch = 1.05
    const match = window.speechSynthesis.getVoices().find((v) => v.name === voice.id)
    if (match) utterance.voice = match

    utterance.onend = () => setPreviewingVoice(null)
    utterance.onerror = () => {
      setPreviewingVoice(null)
      setPreviewError('Failed to play this device voice.')
    }
    window.speechSynthesis.speak(utterance)
  }

  // Preview a voice using Google Cloud TTS via Firestore
  const previewVoice = async (voice: TTSVoice) => {
    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    setPreviewingVoice(voice.id)
    setPreviewError(null)

    try {
      await ensureAuth()

      // Write TTS request to Firestore
      const docRef = await addDoc(collection(db, 'ttsRequests'), {
        text: `Hi there! I'm ${voice.name}. Let's brush those teeth and make them sparkle!`,
        voiceId: voice.id,
        status: 'pending',
        createdAt: new Date(),
      })

      // Wait for the function to process
      const audioUrl = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          unsubscribe()
          reject(new Error('Voice preview timed out'))
        }, TTS_PREVIEW_TIMEOUT_MS)

        const unsubscribe = onSnapshot(doc(db, 'ttsRequests', docRef.id), (snap) => {
          const data = snap.data()
          if (!data) return

          if (data.status === 'complete' && data.audioData) {
            clearTimeout(timeout)
            unsubscribe()
            resolve(data.audioData)
          } else if (data.status === 'error') {
            clearTimeout(timeout)
            unsubscribe()
            reject(new Error(data.error || 'TTS failed'))
          }
        })
      })

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => setPreviewingVoice(null)
      audio.onerror = () => {
        setPreviewingVoice(null)
        setPreviewError('Failed to play audio')
      }

      await audio.play()
    } catch (error) {
      console.error('Preview error:', error)
      setPreviewingVoice(null)
      setPreviewError('Failed to preview voice. Make sure you are online.')
    }
  }

  // Group voices by accent
  const voicesByAccent = TTS_VOICES.reduce((acc, voice) => {
    if (!acc[voice.accent]) {
      acc[voice.accent] = []
    }
    acc[voice.accent].push(voice)
    return acc
  }, {} as Record<string, TTSVoice[]>)

  // Order accents with Australian first
  const accentOrder = ['Australian', 'British', 'American', 'Indian']
  const sortedAccents = Object.keys(voicesByAccent).sort((a, b) => {
    const aIndex = accentOrder.indexOf(a)
    const bIndex = accentOrder.indexOf(b)
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Voice & Playback</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Story Age Range</h2>
        <div className={styles.optionList}>
          {AGE_RANGES.map((range) => (
            <label key={range.value} className={styles.radioOption}>
              <input
                type="radio"
                name="ageRange"
                value={range.value}
                checked={ageRange === range.value}
                onChange={() => { setAgeRange(range.value); trackEvent('settings_changed', { setting_name: 'age_range', new_value: range.value }) }}
              />
              <div className={styles.radioContent}>
                <span className={styles.radioLabel}>{range.label}</span>
                <span className={styles.radioDescription}>{range.description}</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Playback Mode</h2>
        <div className={styles.optionList}>
          {PLAYBACK_MODES.map((mode) => (
            <label key={mode.value} className={styles.radioOption}>
              <input
                type="radio"
                name="playbackMode"
                value={mode.value}
                checked={playbackMode === mode.value}
                onChange={() => { setPlaybackMode(mode.value); trackEvent('settings_changed', { setting_name: 'playback_mode', new_value: mode.value }) }}
              />
              <div className={styles.radioContent}>
                <span className={styles.radioLabel}>{mode.label}</span>
                <span className={styles.radioDescription}>{mode.description}</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Voice Source</h2>
        <div className={styles.optionList}>
          {VOICE_MODES.map((mode) => {
            const isLocked = mode.value === 'cloud' && !isPremium
            return (
              <label key={mode.value} className={styles.radioOption}>
                <input
                  type="radio"
                  name="voiceMode"
                  value={mode.value}
                  checked={voiceMode === mode.value}
                  onChange={() => {
                    if (isLocked) {
                      openPaywall('cloud_voice')
                      return
                    }
                    setVoiceMode(mode.value)
                    trackEvent('settings_changed', { setting_name: 'voice_mode', new_value: mode.value })
                  }}
                />
                <div className={styles.radioContent}>
                  <span className={styles.radioLabel}>
                    {mode.label}{isLocked ? ' 🔒 Premium' : ''}
                  </span>
                  <span className={styles.radioDescription}>{mode.description}</span>
                </div>
              </label>
            )
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Voice Selection</h2>
        <p className={styles.sectionHint}>
          {voiceMode === 'device'
            ? "Pick from voices installed on this device (tap to preview)"
            : "Natural AI voices powered by Google Cloud TTS (tap to preview)"}
        </p>

        {previewError && (
          <div className={styles.voiceTip}>
            <strong>Preview failed</strong>
            <p>{previewError}</p>
          </div>
        )}

        {voiceMode === 'device' ? (
          deviceVoices.length === 0 ? (
            <p className={styles.loadingVoices}>Loading device voices...</p>
          ) : (
            Object.entries(
              deviceVoices.reduce((acc, voice) => {
                if (!acc[voice.accent]) acc[voice.accent] = []
                acc[voice.accent].push(voice)
                return acc
              }, {} as Record<string, VoiceOption[]>)
            )
              .sort(([a], [b]) => {
                const order = ['Australian', 'British', 'American', 'Canadian', 'Irish', 'Indian', 'New Zealand', 'South African']
                const ai = order.indexOf(a), bi = order.indexOf(b)
                if (ai === -1 && bi === -1) return a.localeCompare(b)
                if (ai === -1) return 1
                if (bi === -1) return -1
                return ai - bi
              })
              .map(([accent, voices]) => (
                <div key={accent} className={styles.accentGroup}>
                  <h3 className={styles.accentTitle}>
                    {accent === 'Australian' ? '\uD83E\uDD98 ' : accent === 'British' ? '\uD83C\uDDEC\uD83C\uDDE7 ' : accent === 'American' ? '\uD83C\uDDFA\uD83C\uDDF8 ' : accent === 'Indian' ? '\uD83C\uDDEE\uD83C\uDDF3 ' : ''}
                    {accent}
                  </h3>
                  <div className={styles.voiceGrid}>
                    {voices.map((voice) => (
                      <button
                        key={voice.id}
                        className={`${styles.voiceButton} ${deviceVoiceId === voice.id ? styles.selected : ''} ${previewingVoice === voice.id ? styles.previewing : ''}`}
                        onClick={() => {
                          setDeviceVoiceId(voice.id)
                          trackEvent('settings_changed', { setting_name: 'device_voice', new_value: voice.id })
                          previewDeviceVoice(voice)
                        }}
                        disabled={previewingVoice !== null}
                      >
                        <span className={styles.voiceName}>{voice.name}</span>
                        <span className={styles.voiceDescription}>{voice.description}</span>
                        {previewingVoice === voice.id && (
                          <span className={styles.previewIndicator}>Playing...</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))
          )
        ) : (
          sortedAccents.map((accent) => (
            <div key={accent} className={styles.accentGroup}>
              <h3 className={styles.accentTitle}>
                {accent === 'Australian' ? '\uD83E\uDD98 ' : accent === 'British' ? '\uD83C\uDDEC\uD83C\uDDE7 ' : accent === 'American' ? '\uD83C\uDDFA\uD83C\uDDF8 ' : accent === 'Indian' ? '\uD83C\uDDEE\uD83C\uDDF3 ' : ''}
                {accent}
              </h3>
              <div className={styles.voiceGrid}>
                {voicesByAccent[accent].map((voice) => (
                  <button
                    key={voice.id}
                    className={`${styles.voiceButton} ${voiceId === voice.id ? styles.selected : ''} ${previewingVoice === voice.id ? styles.previewing : ''}`}
                    onClick={() => {
                      setVoiceId(voice.id)
                      trackEvent('settings_changed', { setting_name: 'voice', new_value: voice.id })
                      previewVoice(voice)
                    }}
                    disabled={previewingVoice !== null}
                  >
                    <span className={styles.voiceName}>{voice.name}</span>
                    <span className={styles.voiceDescription}>{voice.description}</span>
                    {previewingVoice === voice.id && (
                      <span className={styles.previewIndicator}>Playing...</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Auto-Play</h2>
        <label className={styles.toggleOption}>
          <input
            type="checkbox"
            checked={autoPlay}
            onChange={(e) => { setAutoPlay(e.target.checked); trackEvent('settings_changed', { setting_name: 'auto_play', new_value: e.target.checked }) }}
          />
          <div className={styles.toggleContent}>
            <span className={styles.toggleLabel}>Auto-play narration</span>
            <span className={styles.toggleDescription}>
              Automatically start reading when story segments change
            </span>
          </div>
        </label>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Data</h2>
        <button className={styles.dangerButton} onClick={clearHistory}>
          Clear Story History
        </button>
        <p className={styles.dangerHint}>
          This will remove all saved stories and favorites from this device.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>About</h2>
        <p>
          <Link to="/privacy">Privacy Policy</Link>
        </p>
      </section>
    </div>
  )
}
