import { useState, useRef, useCallback, useEffect } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'

export interface UseTextToSpeechReturn {
  synthesize: (text: string, voiceId?: string) => Promise<string | null>
  speak: (text: string, voiceId?: string) => Promise<void>
  play: () => void
  pause: () => void
  stop: () => void
  isSynthesizing: boolean
  isPlaying: boolean
  isPaused: boolean
  error: Error | null
}

export function useTextToSpeech(): UseTextToSpeechReturn {
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioQueueRef = useRef<string[]>([])
  const currentIndexRef = useRef(0)

  // Synthesize text to speech and return the audio URL
  const synthesize = useCallback(async (text: string, voiceId = 'Joanna'): Promise<string | null> => {
    setIsSynthesizing(true)
    setError(null)

    try {
      const client = generateClient<Schema>()

      const result = await client.queries.synthesizeSpeech({
        text,
        voiceId,
      })

      if (result.errors || !result.data) {
        throw new Error(result.errors?.[0]?.message || 'Failed to synthesize speech')
      }

      return result.data
    } catch (err) {
      console.error('TTS synthesis error:', err)
      setError(err instanceof Error ? err : new Error('Failed to synthesize speech'))
      return null
    } finally {
      setIsSynthesizing(false)
    }
  }, [])

  // Synthesize and immediately play
  const speak = useCallback(async (text: string, voiceId = 'Joanna'): Promise<void> => {
    const audioUrl = await synthesize(text, voiceId)

    if (audioUrl) {
      // Stop any current playback
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onplay = () => {
        setIsPlaying(true)
        setIsPaused(false)
      }

      audio.onpause = () => {
        setIsPaused(true)
      }

      audio.onended = () => {
        setIsPlaying(false)
        setIsPaused(false)
      }

      audio.onerror = () => {
        setError(new Error('Failed to play audio'))
        setIsPlaying(false)
      }

      await audio.play()
    }
  }, [synthesize])

  const play = useCallback(() => {
    if (audioRef.current && isPaused) {
      audioRef.current.play()
      setIsPlaying(true)
      setIsPaused(false)
    }
  }, [isPaused])

  const pause = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause()
      setIsPaused(true)
    }
  }, [isPlaying])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
      setIsPlaying(false)
      setIsPaused(false)
    }
    audioQueueRef.current = []
    currentIndexRef.current = 0
  }, [])

  return {
    synthesize,
    speak,
    play,
    pause,
    stop,
    isSynthesizing,
    isPlaying,
    isPaused,
    error,
  }
}

// Voice option type for settings
export interface VoiceOption {
  id: string
  name: string
  lang: string
  accent: string
  description: string
}

// Get available browser voices with friendly names
export function getAvailableVoices(): VoiceOption[] {
  if (!('speechSynthesis' in window)) return []

  const voices = window.speechSynthesis.getVoices()
  const voiceOptions: VoiceOption[] = []

  // Map of preferred voices by accent with friendly descriptions
  // Supports both en-AU and en_AU formats
  const accentMap: Record<string, string> = {
    'en-AU': 'Australian',
    'en_AU': 'Australian',
    'en-GB': 'British',
    'en_GB': 'British',
    'en-US': 'American',
    'en_US': 'American',
    'en-IN': 'Indian',
    'en_IN': 'Indian',
    'en-IE': 'Irish',
    'en_IE': 'Irish',
    'en-ZA': 'South African',
    'en_ZA': 'South African',
    'en-NZ': 'New Zealand',
    'en_NZ': 'New Zealand',
    'en-CA': 'Canadian',
    'en_CA': 'Canadian',
  }

  // Process voices and create options
  for (const voice of voices) {
    // Only include English voices
    if (!voice.lang.startsWith('en')) continue

    // Normalize language code (handle both en-AU and en_AU formats)
    const langCode = voice.lang.substring(0, 5)
    const accent = accentMap[langCode] || 'American' // Default to American for generic 'en'

    // Extract just the voice name (remove language suffix if present)
    const voiceName = voice.name.replace(/\s*\(.*\)$/, '').trim()

    voiceOptions.push({
      id: voice.name, // Use full name as ID for matching
      name: voiceName,
      lang: voice.lang,
      accent: accent,
      description: `${accent} ${voice.localService ? '' : '(Online)'}`.trim(),
    })
  }

  // Sort: Australian first, then by accent, then by name
  voiceOptions.sort((a, b) => {
    const accentOrder = ['Australian', 'British', 'American', 'Canadian', 'Irish', 'Indian', 'New Zealand', 'South African']
    const aIndex = accentOrder.indexOf(a.accent)
    const bIndex = accentOrder.indexOf(b.accent)
    if (aIndex !== bIndex) {
      // Put unknown accents at the end
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    }
    return a.name.localeCompare(b.name)
  })

  return voiceOptions
}

// Browser-based TTS (free, works offline)
export function useBrowserTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([])
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Load voices when they become available
  useEffect(() => {
    const loadVoices = () => {
      const voices = getAvailableVoices()
      setAvailableVoices(voices)
    }

    if ('speechSynthesis' in window) {
      // Voices might already be loaded
      loadVoices()

      // Also listen for voiceschanged event (needed for some browsers)
      window.speechSynthesis.onvoiceschanged = loadVoices
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  const speak = useCallback((text: string, voiceId?: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.85 // Slightly slower for kids
      utterance.pitch = 1.1 // Slightly higher pitch

      // Find the selected voice
      const voices = window.speechSynthesis.getVoices()
      let selectedVoice: SpeechSynthesisVoice | undefined

      if (voiceId) {
        // Try to find exact match by name
        selectedVoice = voices.find(v => v.name === voiceId)

        // If not found, try partial match
        if (!selectedVoice) {
          selectedVoice = voices.find(v => v.name.includes(voiceId))
        }
      }

      // Fallback to any English voice
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith('en'))
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice
      }

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)

      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    }
  }, [])

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [])

  const pause = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.pause()
    }
  }, [])

  const resume = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume()
    }
  }, [])

  return { speak, stop, pause, resume, isSpeaking, availableVoices }
}
