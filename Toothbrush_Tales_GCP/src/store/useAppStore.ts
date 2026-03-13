import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Story } from '../hooks/useStoryGeneration'

export type PlaybackMode = 'audio' | 'text' | 'both'
export type AgeRange = '2-5' | '5-10' | '10-15'

interface AppState {
  // Playback settings
  playbackMode: PlaybackMode
  voiceId: string
  autoPlay: boolean
  ageRange: AgeRange

  // Current story
  currentStory: Story | null

  // Story history (local cache)
  storyHistory: Story[]

  // Favorites
  favoriteIds: Set<string>

  // Actions
  setPlaybackMode: (mode: PlaybackMode) => void
  setVoiceId: (voiceId: string) => void
  setAutoPlay: (autoPlay: boolean) => void
  setAgeRange: (ageRange: AgeRange) => void
  setCurrentStory: (story: Story | null) => void
  addToHistory: (story: Story) => void
  toggleFavorite: (storyId: string) => void
  isFavorite: (storyId: string) => boolean
  clearHistory: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Default settings
      playbackMode: 'both',
      voiceId: 'Joanna', // Maps to en-US-Journey-F on Google Cloud TTS (natural voice)
      autoPlay: true,
      ageRange: '5-10',

      // Current story
      currentStory: null,

      // History (most recent first, max 50)
      storyHistory: [],

      // Favorites as a Set for O(1) lookup
      favoriteIds: new Set(),

      // Actions
      setPlaybackMode: (mode) => set({ playbackMode: mode }),

      setVoiceId: (voiceId) => set({ voiceId }),

      setAutoPlay: (autoPlay) => set({ autoPlay }),

      setAgeRange: (ageRange) => set({ ageRange }),

      setCurrentStory: (story) => set({ currentStory: story }),

      addToHistory: (story) =>
        set((state) => ({
          storyHistory: [
            story,
            ...state.storyHistory.filter((s) => s.id !== story.id),
          ].slice(0, 50),
        })),

      toggleFavorite: (storyId) =>
        set((state) => {
          const newFavorites = new Set(state.favoriteIds)
          if (newFavorites.has(storyId)) {
            newFavorites.delete(storyId)
          } else {
            newFavorites.add(storyId)
          }
          return { favoriteIds: newFavorites }
        }),

      isFavorite: (storyId) => get().favoriteIds.has(storyId),

      clearHistory: () => set({ storyHistory: [], favoriteIds: new Set() }),
    }),
    {
      name: 'toothbrush-tales-storage',
      // Custom serialization for Set
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const parsed = JSON.parse(str)
          // Convert favoriteIds array back to Set
          if (parsed.state?.favoriteIds) {
            parsed.state.favoriteIds = new Set(parsed.state.favoriteIds)
          }
          return parsed
        },
        setItem: (name, value) => {
          // Convert Set to array for JSON serialization
          const toStore = {
            ...value,
            state: {
              ...value.state,
              favoriteIds: Array.from(value.state.favoriteIds || []),
            },
          }
          localStorage.setItem(name, JSON.stringify(toStore))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)
