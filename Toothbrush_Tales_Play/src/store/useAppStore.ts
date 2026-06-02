import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Story } from '../hooks/useStoryGeneration'

export type PlaybackMode = 'audio' | 'text' | 'both'
export type AgeRange = '2-5' | '5-10' | '10-15'
export type VoiceMode = 'device' | 'cloud'
export type Entitlement = 'free' | 'premium'
export type PaywallReason =
  | 'daily_limit'
  | 'custom_theme'
  | 'multi_character'
  | 'cloud_voice'
  | 'history_limit'
  | 'manual'

export const HONEYMOON_DAYS = 7
export const FREE_DAILY_NEW_STORIES = 1
export const FREE_HISTORY_LIMIT = 3
export const PREMIUM_HISTORY_LIMIT = 50

// v1 ships free. Flip to true in v2 once Play Billing is wired.
// When false, selectors short-circuit to "always allow" and openPaywall is
// a no-op — the paywall UI stays in source but is inert.
export const PAYWALL_ENABLED = false

interface DailyUsage {
  date: string // YYYY-MM-DD in local time
  count: number
}

interface AppState {
  // Playback settings
  playbackMode: PlaybackMode
  voiceMode: VoiceMode
  voiceId: string
  deviceVoiceId: string
  autoPlay: boolean
  ageRange: AgeRange

  // Entitlement & usage
  entitlement: Entitlement
  installDate: number // epoch ms; set on first run
  dailyUsage: DailyUsage

  // Paywall UI state (not persisted)
  paywallOpen: boolean
  paywallReason: PaywallReason | null

  // Current story
  currentStory: Story | null

  // Story history (local cache)
  storyHistory: Story[]

  // Favorites
  favoriteIds: Set<string>

  // Actions
  setPlaybackMode: (mode: PlaybackMode) => void
  setVoiceMode: (mode: VoiceMode) => void
  setVoiceId: (voiceId: string) => void
  setDeviceVoiceId: (voiceId: string) => void
  setAutoPlay: (autoPlay: boolean) => void
  setAgeRange: (ageRange: AgeRange) => void
  setEntitlement: (entitlement: Entitlement) => void
  incrementDailyStoryCount: () => void
  openPaywall: (reason: PaywallReason) => void
  closePaywall: () => void
  setCurrentStory: (story: Story | null) => void
  addToHistory: (story: Story) => void
  toggleFavorite: (storyId: string) => void
  isFavorite: (storyId: string) => boolean
  clearHistory: () => void
}

function todayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ----- Selectors (pure functions on state) -----

export function isInHoneymoon(state: Pick<AppState, 'installDate'>): boolean {
  if (!PAYWALL_ENABLED) return false
  const elapsedMs = Date.now() - state.installDate
  return elapsedMs < HONEYMOON_DAYS * 24 * 60 * 60 * 1000
}

export function honeymoonDaysLeft(state: Pick<AppState, 'installDate'>): number {
  const elapsedMs = Date.now() - state.installDate
  const remainingMs = HONEYMOON_DAYS * 24 * 60 * 60 * 1000 - elapsedMs
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))
}

export function storiesUsedToday(state: Pick<AppState, 'dailyUsage'>): number {
  if (state.dailyUsage.date !== todayKey()) return 0
  return state.dailyUsage.count
}

export function canGenerateNewStory(
  state: Pick<AppState, 'entitlement' | 'installDate' | 'dailyUsage'>
): boolean {
  if (!PAYWALL_ENABLED) return true
  if (state.entitlement === 'premium') return true
  if (isInHoneymoon(state)) return true
  return storiesUsedToday(state) < FREE_DAILY_NEW_STORIES
}

export function getHistoryLimit(state: Pick<AppState, 'entitlement'>): number {
  if (!PAYWALL_ENABLED) return PREMIUM_HISTORY_LIMIT
  return state.entitlement === 'premium' ? PREMIUM_HISTORY_LIMIT : FREE_HISTORY_LIMIT
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Default settings
      playbackMode: 'both',
      voiceMode: 'device',
      voiceId: 'Joanna',
      deviceVoiceId: '',
      autoPlay: true,
      ageRange: '5-10',

      // Entitlement & usage — defaults assume a brand-new install
      entitlement: 'free',
      installDate: Date.now(),
      dailyUsage: { date: todayKey(), count: 0 },

      // Paywall UI state — never persisted across reloads
      paywallOpen: false,
      paywallReason: null,

      // Current story
      currentStory: null,

      // History (most recent first; capped per tier in addToHistory)
      storyHistory: [],

      // Favorites as a Set for O(1) lookup
      favoriteIds: new Set(),

      // Actions
      setPlaybackMode: (mode) => set({ playbackMode: mode }),

      setVoiceMode: (mode) => set({ voiceMode: mode }),

      setVoiceId: (voiceId) => set({ voiceId }),

      setDeviceVoiceId: (deviceVoiceId) => set({ deviceVoiceId }),

      setAutoPlay: (autoPlay) => set({ autoPlay }),

      setAgeRange: (ageRange) => set({ ageRange }),

      setEntitlement: (entitlement) => set({ entitlement }),

      incrementDailyStoryCount: () =>
        set((state) => {
          const today = todayKey()
          if (state.dailyUsage.date !== today) {
            return { dailyUsage: { date: today, count: 1 } }
          }
          return { dailyUsage: { date: today, count: state.dailyUsage.count + 1 } }
        }),

      openPaywall: (reason) => {
        if (!PAYWALL_ENABLED) return
        set({ paywallOpen: true, paywallReason: reason })
      },

      closePaywall: () => set({ paywallOpen: false, paywallReason: null }),

      setCurrentStory: (story) => set({ currentStory: story }),

      addToHistory: (story) =>
        set((state) => {
          const limit = getHistoryLimit(state)
          return {
            storyHistory: [
              story,
              ...state.storyHistory.filter((s) => s.id !== story.id),
            ].slice(0, limit),
          }
        }),

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
      // Don't persist paywall modal state — should always start closed on reload
      partialize: (state) => {
        const { paywallOpen: _paywallOpen, paywallReason: _paywallReason, ...rest } = state
        return rest as AppState
      },
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
