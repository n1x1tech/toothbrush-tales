import { useState, useCallback } from 'react'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'

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

// Create a theme-aware fallback story for when API is unavailable
const createFallbackStory = (characterName: string, theme: string): Story => ({
  id: crypto.randomUUID(),
  characterName,
  theme,
  intro: `Get ready for adventure! ${characterName} is about to ${theme}! Grab your toothbrush and let's make some magic happen!`,
  segments: [
    `${characterName} couldn't believe today was finally the day to ${theme}! WHOOOOSH! With a sparkly toothbrush in hand, ${characterName} was ready for anything. The adventure was about to begin, and ${characterName} could feel the excitement bubbling up inside!`,
    `As ${characterName} continued the ${theme} journey, a friendly helper appeared! "I'll help you!" it said with a grin. ZOOM ZOOM! Together they faced the first challenge. ${characterName}'s bright smile lit up the way. "We can do this!" ${characterName} cheered.`,
    `The ${theme} adventure was getting more exciting by the minute! ${characterName} had to be brave and clever. SPLISH SPLASH! With quick thinking and those super-sparkly teeth shining bright, ${characterName} found the perfect solution. "Almost there!" ${characterName} shouted happily.`,
    `${characterName} did it! The ${theme} adventure was a complete success! HOORAY! Everyone cheered and celebrated. ${characterName}'s teeth sparkled brighter than ever before. "That was the best adventure ever!" ${characterName} laughed, doing a happy victory dance.`
  ],
  brushingPrompts: [
    "Now brush your bottom teeth!",
    "Time to brush the top teeth!",
    "Brush the teeth on your left side!",
    "Brush the teeth on your right side!"
  ],
  conclusion: `What an amazing adventure! ${characterName} conquered the ${theme} challenge! Your teeth are super clean and sparkly! You're a champion!`,
  audioUrl: null,
  isFavorite: false,
  isFallback: true, // Mark as fallback so UI can indicate this
})

export function useStoryGeneration() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const generateStory = useCallback(async (characterName: string, theme: string): Promise<Story> => {
    console.log(`[StoryGen] Generating story for character="${characterName}", theme="${theme}"`)
    setIsGenerating(true)
    setError(null)

    try {
      // Try to use the Amplify API
      const client = generateClient<Schema>()

      const result = await client.queries.generateStory({
        characterName,
        theme,
      })

      console.log(`[StoryGen] API response:`, { hasErrors: !!result.errors, hasData: !!result.data })

      if (result.errors || !result.data) {
        console.error(`[StoryGen] API errors:`, result.errors)
        throw new Error(result.errors?.[0]?.message || 'Failed to generate story')
      }

      const storyData = result.data
      console.log(`[StoryGen] Story received: intro="${storyData.intro?.substring(0, 50)}..."`)

      return {
        id: storyData.id || crypto.randomUUID(),
        characterName: storyData.characterName,
        theme: storyData.theme,
        intro: storyData.intro,
        segments: storyData.segments as string[],
        brushingPrompts: storyData.brushingPrompts as string[],
        conclusion: storyData.conclusion,
        audioUrl: storyData.audioUrl,
        isFavorite: storyData.isFavorite ?? false,
        isFallback: false,
      }
    } catch (err) {
      console.warn('[StoryGen] API unavailable, using fallback story:', err)
      // Return a fallback story if API fails
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
