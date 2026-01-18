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
}

// Create a fallback story for when API is unavailable
const createFallbackStory = (characterName: string, theme: string): Story => ({
  id: crypto.randomUUID(),
  characterName,
  theme,
  intro: `This story is about ${characterName} ${theme}. Get ready to brush, here we go!`,
  segments: [
    `Once upon a time, ${characterName} woke up feeling super excited! Today was the day for a big adventure. WHOOOOSH! ${characterName} jumped out of bed and did a silly dance, wiggling and giggling all around the room!`,
    `${characterName} found a magical toothbrush that could talk! "Hello friend!" said the toothbrush with a sparkly grin. "Let's make your teeth sparkle like stars in the night sky!" And they zoomed off together. ZOOM ZOOM!`,
    `Along the way, ${characterName} met a friendly dragon who absolutely LOVED clean teeth! The dragon showed them how to brush in circles. "Round and round, up and down!" they sang together happily. SPLISH SPLASH went the bubbles!`,
    `Finally, ${characterName} reached the end of their amazing adventure with the shiniest, cleanest teeth in all the land! The magical toothbrush did a happy wiggle dance. "You did it!" cheered everyone. HOORAY!`
  ],
  brushingPrompts: [
    "Now brush your bottom teeth!",
    "Time to brush the top teeth!",
    "Brush the teeth on your left side!",
    "Brush the teeth on your right side!"
  ],
  conclusion: "Hooray! Your teeth are super clean and sparkly! Great job brushing! You're a toothbrushing champion! Give yourself a big high five!",
  audioUrl: null,
  isFavorite: false,
})

export function useStoryGeneration() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const generateStory = useCallback(async (characterName: string, theme: string): Promise<Story> => {
    setIsGenerating(true)
    setError(null)

    try {
      // Try to use the Amplify API
      const client = generateClient<Schema>()

      const result = await client.queries.generateStory({
        characterName,
        theme,
      })

      if (result.errors || !result.data) {
        throw new Error(result.errors?.[0]?.message || 'Failed to generate story')
      }

      const storyData = result.data

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
      }
    } catch (err) {
      console.warn('API unavailable, using fallback story:', err)
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
