import { useEffect, useRef } from 'react'
import styles from './VoiceInput.module.css'

interface VoiceInputProps {
  onResult: (transcript: string) => void
  isListening: boolean
  onListeningChange: (listening: boolean) => void
}

// Extend Window interface for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

export default function VoiceInput({
  onResult,
  isListening,
  onListeningChange
}: VoiceInputProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    if (!isSupported) return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    recognitionRef.current = new SpeechRecognition()
    recognitionRef.current.continuous = false
    recognitionRef.current.interimResults = false
    recognitionRef.current.lang = 'en-US'

    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript
      onResult(transcript)
    }

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      onListeningChange(false)
    }

    recognitionRef.current.onend = () => {
      onListeningChange(false)
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [isSupported, onResult, onListeningChange])

  const toggleListening = () => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      onListeningChange(false)
    } else {
      recognitionRef.current.start()
      onListeningChange(true)
    }
  }

  if (!isSupported) {
    return null
  }

  return (
    <button
      type="button"
      className={`${styles.voiceButton} ${isListening ? styles.listening : ''}`}
      onClick={toggleListening}
      aria-label={isListening ? 'Stop listening' : 'Start voice input'}
    >
      {isListening ? (
        <span className={styles.listeningIcon}>🎙️</span>
      ) : (
        <span className={styles.micIcon}>🎤</span>
      )}
    </button>
  )
}
