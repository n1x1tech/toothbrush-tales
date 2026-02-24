import { useState, useCallback } from 'react'
import type { Schema } from '../../amplify/data/resource'
import { trackTelemetryEvent } from '../lib/telemetry'
import { getAmplifyDataClient } from '../services/amplifyClient'

// Story type for frontend use
export interface Story {
  id: string
  characterName: string
  theme: string
  intro: string
  segments: string[]
  brushingPrompts: string[]
  conclusion: string
  audioUrl?: string | null
  isFavorite: boolean
  isFallback?: boolean // Flag to indicate this is a fallback story
}

const STORY_FIRST_TIMEOUT_MS = 45000  // 45s for first attempt (cold-start tolerance)
const STORY_RETRY_TIMEOUT_MS = 30000  // 30s for automatic retry

// Format multiple names naturally (e.g., "Arlo, Luna and Max")
function formatNames(input: string): string {
  const names = input
    .split(/,\s*|\s+and\s+|\s+&\s+/)
    .map(n => n.trim())
    .filter(n => n.length > 0)
  if (names.length <= 1) return input
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// Create a theme-aware fallback story for when API is unavailable
const createFallbackStory = (characterName: string, theme: string): Story => {
  const name = formatNames(characterName)
  return {
    id: crypto.randomUUID(),
    characterName,
    theme,
    intro: `Get ready for adventure! ${name} is about to ${theme}! Grab your toothbrush and let's make some magic happen!`,
    segments: [
      `${name} couldn't believe today was finally the day to ${theme}! With a sparkly toothbrush in hand, ${name} was ready for anything. The adventure was about to begin, and ${name} could feel the excitement bubbling up inside.`,
      `As ${name} continued the ${theme} journey, a friendly helper appeared. "I'll help you!" it said with a grin. Together they faced the first challenge. ${name}'s bright smile lit up the way. "We can do this!" ${name} cheered.`,
      `The ${theme} adventure was getting more exciting by the minute. ${name} had to be brave and clever. With quick thinking and those super-sparkly teeth shining bright, ${name} found the perfect solution. "Almost there!" ${name} shouted happily.`,
      `${name} did it! The ${theme} adventure was a complete success. Everyone cheered and celebrated. ${name}'s teeth sparkled brighter than ever before. "That was the best adventure ever!" ${name} laughed, doing a happy victory dance.`
    ],
    brushingPrompts: [
      "Great start! Now brush your bottom teeth in gentle circles.",
      "You're doing awesome! Let's brush your top teeth next.",
      "Nice work so far. Now brush the left side.",
      "Almost there! Finish strong by brushing the right side."
    ],
    conclusion: `What an amazing adventure! ${name} conquered the ${theme} challenge! Your teeth are super clean and sparkly! You're a champion!`,
    audioUrl: null,
    isFavorite: false,
    isFallback: true,
  }
}

export function useStoryGeneration() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const toNonEmptyString = (value: unknown, fallback: string): string => {
    if (typeof value !== 'string') return fallback
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : fallback
  }

  const toStringArray = (value: unknown, fallback: string[], targetLength: number): string[] => {
    const list = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
      : []

    if (list.length === 0) return fallback
    if (list.length >= targetLength) return list.slice(0, targetLength)

    const filled = [...list]
    while (filled.length < targetLength) {
      filled.push(fallback[filled.length] || fallback[fallback.length - 1] || '')
    }
    return filled
  }

  const generateStory = useCallback(async (characterName: string, theme: string): Promise<Story> => {
    console.log(`[StoryGen] Generating story for character="${characterName}", theme="${theme}"`)
    trackTelemetryEvent('story_generate_start', { characterNameLength: characterName.length, themeLength: theme.length })
    setIsGenerating(true)
    setError(null)

    // Helper to attempt one API call with a given timeout
    const tryOnce = async (timeoutMs: number): Promise<Story | null> => {
      try {
        const client = await getAmplifyDataClient<Schema>()

        const result = await Promise.race([
          client.queries.generateStory({ characterName, theme }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Story generation timed out')), timeoutMs)
          }),
        ])

        if (result.errors || !result.data) {
          console.error(`[StoryGen] API errors:`, result.errors)
          return null
        }

        const storyData = result.data
        console.log(`[StoryGen] Story received: intro="${storyData.intro?.substring(0, 50)}..."`)

        const fallback = createFallbackStory(characterName, theme)
        return {
          id: storyData.id || crypto.randomUUID(),
          characterName: toNonEmptyString(storyData.characterName, characterName),
          theme: toNonEmptyString(storyData.theme, theme),
          intro: toNonEmptyString(storyData.intro, fallback.intro),
          segments: toStringArray(storyData.segments, fallback.segments, 4),
          brushingPrompts: toStringArray(storyData.brushingPrompts, fallback.brushingPrompts, 4),
          conclusion: toNonEmptyString(storyData.conclusion, fallback.conclusion),
          audioUrl: typeof storyData.audioUrl === 'string' ? storyData.audioUrl : null,
          isFavorite: storyData.isFavorite ?? false,
          isFallback: false,
        }
      } catch (err) {
        console.warn(`[StoryGen] Attempt failed (${timeoutMs}ms timeout):`, err)
        return null
      }
    }

    try {
      // First attempt with longer timeout to survive cold starts
      const firstAttempt = await tryOnce(STORY_FIRST_TIMEOUT_MS)
      if (firstAttempt) {
        trackTelemetryEvent('story_generate_success', { isFallback: false, attempt: 1 })
        return firstAttempt
      }

      // Retry once automatically so the user doesn't need to tap again
      console.warn('[StoryGen] Retrying story generation after initial timeout/error')
      const secondAttempt = await tryOnce(STORY_RETRY_TIMEOUT_MS)
      if (secondAttempt) {
        trackTelemetryEvent('story_generate_success', { isFallback: false, attempt: 2 })
        return secondAttempt
      }

      // Both attempts failed – fall back to a template story
      const err = new Error('Story generation timed out')
      setError(err)
      trackTelemetryEvent('story_generate_fallback', { reason: 'timeout_both_attempts', isFallback: true })
      return createFallbackStory(characterName, theme)
    } catch (err) {
      console.warn('[StoryGen] Unexpected error, using fallback story:', err)
      setError(err instanceof Error ? err : new Error('Story generation unavailable'))
      trackTelemetryEvent('story_generate_fallback', {
        reason: err instanceof Error ? err.message : 'unknown_error',
        isFallback: true,
      })
      return createFallbackStory(characterName, theme)
    } finally {
      setIsGenerating(false)
    }
  }, [])

  return {
    generateStory,
    isGenerating,
    error,
  }
}
