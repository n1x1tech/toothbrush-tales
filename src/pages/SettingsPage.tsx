import { useState, useEffect } from 'react'
import { useAppStore, PlaybackMode } from '../store/useAppStore'
import { getAvailableVoices, VoiceOption } from '../hooks/useTextToSpeech'
import styles from './SettingsPage.module.css'

const PLAYBACK_MODES: { value: PlaybackMode; label: string; description: string }[] = [
  { value: 'audio', label: 'Audio Only', description: 'Listen to the story being read aloud' },
  { value: 'text', label: 'Text Only', description: 'Read the story on screen' },
  { value: 'both', label: 'Audio + Text', description: 'Listen and read along' },
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

  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null)

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = getAvailableVoices()
      setVoices(availableVoices)
    }

    // Load immediately
    loadVoices()

    // Also load when voices change (needed for some browsers)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices
    }

    // Cleanup
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // Preview a voice
  const previewVoice = (voice: VoiceOption) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setPreviewingVoice(voice.id)

      const utterance = new SpeechSynthesisUtterance(
        `Hi there! I'm ${voice.name}. Let's brush those teeth!`
      )
      utterance.rate = 0.85
      utterance.pitch = 1.1

      const allVoices = window.speechSynthesis.getVoices()
      const selectedVoice = allVoices.find(v => v.name === voice.id)
      if (selectedVoice) {
        utterance.voice = selectedVoice
      }

      utterance.onend = () => setPreviewingVoice(null)
      utterance.onerror = () => setPreviewingVoice(null)

      window.speechSynthesis.speak(utterance)
    }
  }

  // Group voices by accent
  const voicesByAccent = voices.reduce((acc, voice) => {
    if (!acc[voice.accent]) {
      acc[voice.accent] = []
    }
    acc[voice.accent].push(voice)
    return acc
  }, {} as Record<string, VoiceOption[]>)

  // Order accents with Australian first
  const accentOrder = ['Australian', 'British', 'American', 'Canadian', 'Irish', 'Indian', 'New Zealand', 'South African']
  const sortedAccents = Object.keys(voicesByAccent).sort((a, b) => {
    const aIndex = accentOrder.indexOf(a)
    const bIndex = accentOrder.indexOf(b)
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

  // Check if Australian voices are available
  const hasAustralianVoices = voicesByAccent['Australian']?.length > 0

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
        <p className={styles.sectionHint}>Choose a voice for story narration (tap to preview)</p>

        {voices.length === 0 ? (
          <p className={styles.loadingVoices}>Loading available voices...</p>
        ) : (
          <>
            {!hasAustralianVoices && (
              <div className={styles.voiceTip}>
                <strong>Want Australian voices?</strong>
                <p>On Windows: Settings → Time & Language → Language → Add "English (Australia)"</p>
                <p>On Mac: System Preferences → Accessibility → Spoken Content → System Voice → Manage Voices</p>
              </div>
            )}
            {sortedAccents.map((accent) => (
            <div key={accent} className={styles.accentGroup}>
              <h3 className={styles.accentTitle}>
                {accent === 'Australian' ? '🦘 ' : accent === 'British' ? '🇬🇧 ' : accent === 'American' ? '🇺🇸 ' : ''}
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
                  >
                    <span className={styles.voiceName}>{voice.name}</span>
                    {previewingVoice === voice.id && (
                      <span className={styles.previewIndicator}>Playing...</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
          </>
        )}
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
