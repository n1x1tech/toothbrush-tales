import * as functions from 'firebase-functions/v1'
import { VertexAI } from '@google-cloud/vertexai'
import { buildStoryPrompts, STORY_PROMPT_VERSION } from './storyPrompts'

const vertexProject = process.env.VERTEX_PROJECT_ID || process.env.GCLOUD_PROJECT
if (!vertexProject) {
  throw new Error('Missing VERTEX_PROJECT_ID/GCLOUD_PROJECT for Vertex AI initialization')
}

const vertexLocation = process.env.VERTEX_LOCATION || 'us-central1'
const vertexAI = new VertexAI({ project: vertexProject, location: vertexLocation })
const geminiModel = vertexAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

// Dynamic fallback story templates that actually use the theme (~200 words each)
const STORY_TEMPLATES = [
  {
    intro: (name: string, theme: string) =>
      `Hold onto your toothbrush! ${name} is about to ${theme}. Let's go!`,
    segments: (name: string, theme: string) => [
      `${name} couldn't believe it - today was the day to ${theme}! WHOOOOSH! A magical wind swept through and everything started to shimmer. "This is amazing!" ${name} cheered, bouncing with excitement and flashing a sparkly smile.`,
      `But wait - a problem! A friendly talking squirrel appeared. CRACK! "I can help," it squeaked, "but only if your teeth are super sparkly!" ${name} grinned wide, showing off those clean chompers. "Let's do this!" they shouted together.`,
      `${name} and the squirrel zoomed through magical clouds and past rainbow waterfalls! SPARKLE SPARKLE! A silly obstacle appeared, but ${name} wasn't worried. With a bright smile and quick thinking, the problem was solved in a flash!`,
      `"You did it!" everyone cheered as ${name} finished ${theme}. HOORAY! Confetti rained down and ${name}'s teeth sparkled brighter than ever. "Best adventure ever!" ${name} laughed. It all started with great brushing!`
    ],
    conclusion: (name: string, theme: string) =>
      `Amazing! ${name} conquered ${theme}! Your teeth are sparkling like stars!`
  },
  {
    intro: (name: string, theme: string) =>
      `Epic tale time! ${name} is about to ${theme}. Grab your toothbrush!`,
    segments: (name: string, theme: string) => [
      `${name} knew today was special. FLASH! A golden ticket appeared. "Your adventure awaits," it read. ${name} was going to ${theme}! "Yes! Let's go!" ${name} pumped a fist in the air.`,
      `Following the map, ${name} found a secret garden connected to ${theme}. A grumpy gnome blocked the path. "Only the brightest smiles may enter!" PING! ${name}'s teeth twinkled. The gnome's jaw dropped. "Impressive!"`,
      `Inside, ${name} faced three challenges. SWOOSH! ZOOM! SPLASH! Each one trickier than the last, but ${name} never gave up. "I can do anything!" ${name} declared, striking a superhero pose with a gleaming grin.`,
      `The final challenge was the biggest, but ${name} was ready. KABOOM! Fireworks exploded as ${name} solved it brilliantly! "You're a true hero!" the gnome cheered. ${name} took a bow, grinning ear to ear.`
    ],
    conclusion: (name: string, theme: string) =>
      `Incredible! ${name} mastered ${theme}! Those sparkling teeth saved the day!`
  },
  {
    intro: (name: string, theme: string) =>
      `Buckle up! ${name} is about to ${theme}. This is going to be wild!`,
    segments: (name: string, theme: string) => [
      `${name} had always dreamed about ${theme}, and today it was happening! VROOM! A rocket skateboard appeared. "Cool!" ${name} hopped on, zooming forward with wind whooshing past and a huge grin.`,
      `The skateboard stopped at a bubbling brook. A wise owl perched nearby. "Answer my riddle to continue!" it hooted. HOOT HOOT! ${name} thought hard, teeth gleaming. "Got it!" The owl nodded approvingly.`,
      `${name} soared through candy-colored skies! WHOOOOSH! Then came a maze of mirrors with a hundred reflections smiling back. "My sparkly teeth will light the way!" And they did! SHIMMER SHIMMER!`,
      `${name} burst through the final mirror into a celebration parade! HOORAY! Everyone cheered because ${theme} was complete! Balloons floated everywhere as ${name} waved, feeling like the happiest kid ever.`
    ],
    conclusion: (name: string, theme: string) =>
      `${name} finished ${theme} in style! Super-clean teeth were the secret weapon!`
  }
]

// Format multiple names naturally for story text (e.g., "Arlo, Luna and Max")
function formatNames(characterName: string): string {
  const names = characterName
    .split(/,\s*|\s+and\s+|\s+&\s+/)
    .map(n => n.trim())
    .filter(n => n.length > 0)
  if (names.length <= 1) return characterName
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

interface StoryResult {
  id: string
  characterName: string
  theme: string
  intro: string
  segments: string[]
  brushingPrompts: string[]
  conclusion: string
  audioUrl: string | null
  isFavorite: boolean
  isFallback: boolean
}

function createDynamicFallbackStory(characterName: string, theme: string): StoryResult {
  const template = STORY_TEMPLATES[Math.floor(Math.random() * STORY_TEMPLATES.length)]
  const displayName = formatNames(characterName)

  return {
    id: crypto.randomUUID(),
    characterName,
    theme,
    intro: template.intro(displayName, theme),
    segments: template.segments(displayName, theme),
    brushingPrompts: [
      'Now brush your bottom teeth nice and clean!',
      'Great job! Now brush your top teeth!',
      "You're doing amazing! Brush the left side!",
      'Almost done! Brush the right side!'
    ],
    conclusion: template.conclusion(displayName, theme),
    audioUrl: null,
    isFavorite: false,
    isFallback: true,
  }
}

// Call Vertex AI Gemini 2.0 Flash
async function generateStoryWithGemini(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const result = await geminiModel.generateContent({
    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 2000 },
  })
  return result.response.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// Helper function to call Vertex AI with retry logic
async function invokeVertexWithRetry(
  systemPrompt: string,
  userPrompt: string,
  maxRetries: number = 2
): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`[Story] Gemini attempt ${attempt}/${maxRetries + 1}`)
      return await generateStoryWithGemini(systemPrompt, userPrompt)
    } catch (error) {
      lastError = error as Error
      console.error(`[Story] Gemini attempt ${attempt} failed:`, error)

      if (attempt <= maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000
        console.log(`[Story] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('All Gemini retry attempts failed')
}

// Firestore-triggered function: listens for new story requests
export const onStoryRequest = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .firestore.document('storyRequests/{requestId}')
  .onCreate(async (snap) => {
    try {
      const data = snap.data()
      const { characterName, theme } = data

      if (!characterName || !theme) {
        await snap.ref.update({ status: 'error', error: 'characterName and theme are required' })
        return
      }

      const { systemPrompt, userPrompt } = buildStoryPrompts({ characterName, theme })

      console.log(`[Story] Generating story for character="${characterName}", theme="${theme}", promptVersion="${STORY_PROMPT_VERSION}"`)

      try {
        const textContent = await invokeVertexWithRetry(systemPrompt, userPrompt, 2)
        console.log(`[Story] Gemini response received, length: ${textContent.length}`)

        // Parse the JSON from the response (handle potential markdown code blocks)
        let jsonString = textContent.trim()
        if (jsonString.startsWith('```json')) {
          jsonString = jsonString.slice(7)
        }
        if (jsonString.startsWith('```')) {
          jsonString = jsonString.slice(3)
        }
        if (jsonString.endsWith('```')) {
          jsonString = jsonString.slice(0, -3)
        }

        const storyData = JSON.parse(jsonString.trim())
        console.log('[Story] Successfully parsed story JSON')

        const defaultBrushingPrompts = [
          'Now brush your bottom teeth nice and clean!',
          'Great job! Now brush your top teeth!',
          "You're doing amazing! Brush the left side!",
          'Almost done! Brush the right side!'
        ]

        // Ensure segments has exactly 4 story items (Gemini sometimes merges brushing prompts in)
        const segments = Array.isArray(storyData.segments)
          ? storyData.segments.slice(0, 4)
          : storyData.segments

        await snap.ref.update({
          id: crypto.randomUUID(),
          intro: storyData.intro,
          segments,
          brushingPrompts: storyData.brushingPrompts || defaultBrushingPrompts,
          conclusion: storyData.conclusion,
          audioUrl: null,
          isFavorite: false,
          isFallback: false,
          status: 'complete',
        })
      } catch (error) {
        console.error('[Story] Error generating story from Gemini:', error)
        console.log(`[Story] Using dynamic fallback for character="${characterName}", theme="${theme}"`)

        const fallback = createDynamicFallbackStory(characterName, theme)
        await snap.ref.update({
          ...fallback,
          status: 'complete',
        })
      }
    } catch (outerError) {
      console.error('[Story] Fatal error (likely Firestore write failed):', outerError)
      try {
        await snap.ref.update({ status: 'error', error: 'Internal error' })
      } catch { /* nothing more we can do */ }
    }
  })
