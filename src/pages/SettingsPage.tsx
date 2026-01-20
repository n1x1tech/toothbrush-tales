import { useState, useRef } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'
import { useAppStore, PlaybackMode } from '../store/useAppStore'
import styles from './SettingsPage.module.css'

const client = generateClient<Schema>()

const PLAYBACK_MODES: { value: PlaybackMode; label: string; description: string }[] = [
  { value: 'audio', label: 'Audio Only', description: 'Listen to the story being read aloud' },
  { value: 'text', label: 'Text Only', description: 'Read the story on screen' },
  { value: 'both', label: 'Audio + Text', description: 'Listen and read along' },
]

// Amazon Polly Neural Voices - natural sounding!
interface PollyVoice {
  id: string
  name: string
  accent: string
  description: string
}

const POLLY_VOICES: PollyVoice[] = [
  // Australian
  { id: 'Olivia', name: 'Olivia', accent: 'Australian', description: 'Warm & natural' },

  // British
  { id: 'Amy', name: 'Amy', accent: 'British', description: 'Clear & friendly' },
  { id: 'Emma', name: 'Emma', accent: 'British', description: 'Warm' },
  { id: 'Brian', name: 'Brian', accent: 'British', description: 'Gentle' },
  { id: 'Arthur', name: 'Arthur', accent: 'British', description: 'Warm' },

  // American
  { id: 'Ivy', name: 'Ivy', accent: 'American', description: 'Child-like (Recommended)' },
  { id: 'Kevin', name: 'Kevin', accent: 'American', description: 'Boy voice' },
  { id: 'Joanna', name: 'Joanna', accent: 'American', description: 'Warm & friendly' },
  { id: 'Matthew', name: 'Matthew', accent: 'American', description: 'Gentle' },
  { id: 'Ruth', name: 'Ruth', accent: 'American', description: 'Expressive' },
  { id: 'Salli', name: 'Salli', accent: 'American', description: 'Friendly' },
  { id: 'Joey', name: 'Joey', accent: 'American', description: 'Casual' },
  { id: 'Kendra', name: 'Kendra', accent: 'American', description: 'Clear' },

  // Indian
  { id: 'Kajal', name: 'Kajal', accent: 'Indian', description: 'Warm' },
]

export default function SettingsPage() {
  const {
    playbackMode,
    setPlaybackMode,
    voiceId,
    setVoiceId,
    autoPlay,
    setAutoPlay,
    clearHistory,
  } = useAppStore()

  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Preview a voice using Polly
  const previewVoice = async (voice: PollyVoice) => {
    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    setPreviewingVoice(voice.id)
    setPreviewError(null)

    try {
      const result = await client.queries.synthesizeSpeech({
        text: `Hi there! I'm ${voice.name}. Let's brush those teeth and make them sparkle!`,
        voiceId: voice.id,
      })

      if (result.errors || !result.data) {
        throw new Error(result.errors?.[0]?.message || 'Failed to generate preview')
      }

      const audio = new Audio(result.data)
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
  const voicesByAccent = POLLY_VOICES.reduce((acc, voice) => {
    if (!acc[voice.accent]) {
      acc[voice.accent] = []
    }
    acc[voice.accent].push(voice)
    return acc
  }, {} as Record<string, PollyVoice[]>)

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
      <h1 className={styles.title}>Settings</h1>

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
                onChange={() => setPlaybackMode(mode.value)}
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
        <h2 className={styles.sectionTitle}>Voice Selection</h2>
        <p className={styles.sectionHint}>Natural AI voices powered by Amazon Polly (tap to preview)</p>

        {previewError && (
          <div className={styles.voiceTip}>
            <strong>Preview failed</strong>
            <p>{previewError}</p>
          </div>
        )}

        {sortedAccents.map((accent) => (
          <div key={accent} className={styles.accentGroup}>
            <h3 className={styles.accentTitle}>
              {accent === 'Australian' ? '🦘 ' : accent === 'British' ? '🇬🇧 ' : accent === 'American' ? '🇺🇸 ' : accent === 'Indian' ? '🇮🇳 ' : ''}
              {accent}
            </h3>
            <div className={styles.voiceGrid}>
              {voicesByAccent[accent].map((voice) => (
                <button
                  key={voice.id}
                  className={`${styles.voiceButton} ${voiceId === voice.id ? styles.selected : ''} ${previewingVoice === voice.id ? styles.previewing : ''}`}
                  onClick={() => {
                    setVoiceId(voice.id)
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
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Auto-Play</h2>
        <label className={styles.toggleOption}>
          <input
            type="checkbox"
            checked={autoPlay}
            onChange={(e) => setAutoPlay(e.target.checked)}
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
    </div>
  )
}
