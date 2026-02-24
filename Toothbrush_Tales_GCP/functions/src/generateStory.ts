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
      `${name} couldn't believe it - today was the day to ${theme}! A magical wind swept through and everything started to shimmer. "This is amazing!" ${name} cheered, bouncing with excitement and flashing a sparkly smile.`,
      `But wait - a problem! A friendly talking squirrel appeared. "I can help," it squeaked, "if we stay brave and keep moving." ${name} nodded with a grin. "Let's do this!" they shouted together.`,
      `${name} and the squirrel traveled through magical clouds and past rainbow waterfalls. A silly obstacle appeared, but ${name} wasn't worried. With quick thinking, the problem was solved in a flash.`,
      `"You did it!" everyone cheered as ${name} finished ${theme}. Confetti rained down and the whole crowd celebrated. "Best adventure ever!" ${name} laughed.`
    ],
    conclusion: (name: string, theme: string) =>
      `Amazing! ${name} conquered ${theme}! What a fantastic finish.`
  },
  {
    intro: (name: string, theme: string) =>
      `Epic tale time! ${name} is about to ${theme}. Grab your toothbrush!`,
    segments: (name: string, theme: string) => [
      `${name} knew today was special. A golden ticket appeared. "Your adventure awaits," it read. ${name} was going to ${theme}! "Yes! Let's go!" ${name} pumped a fist in the air.`,
      `Following the map, ${name} found a secret garden connected to ${theme}. A grumpy gnome blocked the path. "Only kind and brave explorers may enter!" ${name} stood tall. The gnome nodded. "Impressive!"`,
      `Inside, ${name} faced three challenges, each trickier than the last. ${name} never gave up. "I can do anything!" ${name} declared, striking a superhero pose.`,
      `The final challenge was the biggest, but ${name} was ready. Fireworks flashed across the sky as ${name} solved it brilliantly! "You're a true hero!" the gnome cheered. ${name} took a bow, grinning ear to ear.`
    ],
    conclusion: (name: string, theme: string) =>
      `Incredible! ${name} mastered ${theme}! What a hero's ending.`
  },
  {
    intro: (name: string, theme: string) =>
      `Buckle up! ${name} is about to ${theme}. This is going to be wild!`,
    segments: (name: string, theme: string) => [
      `${name} had always dreamed about ${theme}, and today it was happening! A rocket skateboard appeared. "Cool!" ${name} hopped on, zooming forward with a huge grin.`,
      `The skateboard stopped at a bubbling brook. A wise owl perched nearby. "Answer my riddle to continue!" it hooted. ${name} thought hard. "Got it!" The owl nodded approvingly.`,
      `${name} soared through candy-colored skies. Then came a maze of mirrors with a hundred reflections smiling back. ${name} took a deep breath, trusted the clues, and found the right path.`,
      `${name} burst through the final mirror into a celebration parade. Everyone cheered because ${theme} was complete! Balloons floated everywhere as ${name} waved, feeling like the happiest kid ever.`
    ],
    conclusion: (name: string, theme: string) =>
      `${name} finished ${theme} in style! What an unforgettable adventure.`
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

const DEFAULT_BRUSHING_PROMPTS = [
  'Great start! Brush your bottom teeth in little circles.',
  "You're doing great! Now brush your top teeth.",
  'Nice brushing! Move over to the left side.',
  'Almost done! Finish up on the right side.'
]

function createDynamicFallbackStory(characterName: string, theme: string): StoryResult {
  const template = STORY_TEMPLATES[Math.floor(Math.random() * STORY_TEMPLATES.length)]
  const displayName = formatNames(characterName)

  return {
    id: crypto.randomUUID(),
    characterName,
    theme,
    intro: template.intro(displayName, theme),
    segments: template.segments(displayName, theme),
    brushingPrompts: DEFAULT_BRUSHING_PROMPTS,
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
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 2000,
      responseMimeType: 'application/json'
    },
  })
  return result.response.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function repairStoryJsonWithGemini(invalidPayload: string): Promise<string> {
  const repairSystemPrompt = `You repair malformed JSON.
Return ONLY valid JSON with exactly these keys:
{
  "intro": string,
  "segments": [string, string, string, string],
  "brushingPrompts": [string, string, string, string],
  "conclusion": string
}
Do not include markdown or any extra keys.`

  const repairUserPrompt = `Repair this malformed JSON and keep the story content as close as possible:
${invalidPayload}`

  const result = await geminiModel.generateContent({
    systemInstruction: { role: 'system', parts: [{ text: repairSystemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: repairUserPrompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 2000,
      responseMimeType: 'application/json'
    },
  })

  return result.response.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

function normalizeGeminiJsonPayload(textContent: string): string {
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

  return jsonString.trim()
}

function parseStoryJson(textContent: string): {
  intro?: unknown
  segments?: unknown
  brushingPrompts?: unknown
  conclusion?: unknown
} {
  const cleaned = normalizeGeminiJsonPayload(textContent)

  try {
    return JSON.parse(cleaned)
  } catch (firstError) {
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const extracted = cleaned.slice(firstBrace, lastBrace + 1)
      try {
        return JSON.parse(extracted)
      } catch {
        const withoutTrailingCommas = extracted.replace(/,\s*([}\]])/g, '$1')
        return JSON.parse(withoutTrailingCommas)
      }
    }

    throw firstError
  }
}

async function parseStoryJsonWithRepair(textContent: string): Promise<{
  intro?: unknown
  segments?: unknown
  brushingPrompts?: unknown
  conclusion?: unknown
}> {
  try {
    return parseStoryJson(textContent)
  } catch (parseError) {
    console.warn('[Story] Initial JSON parse failed, requesting Gemini JSON repair')
    const repairedText = await repairStoryJsonWithGemini(textContent)
    return parseStoryJson(repairedText)
  }
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

        const storyData = await parseStoryJsonWithRepair(textContent)
        console.log('[Story] Successfully parsed story JSON')

        // Ensure required story fields are always defined and in the expected shape.
        const intro = typeof storyData.intro === 'string' && storyData.intro.trim()
          ? storyData.intro.trim()
          : `Today ${formatNames(characterName)} begins an exciting ${theme} adventure.`
        const conclusion = typeof storyData.conclusion === 'string' && storyData.conclusion.trim()
          ? storyData.conclusion.trim()
          : `What a great adventure, ${formatNames(characterName)}!`

        const candidateSegments = Array.isArray(storyData.segments)
          ? storyData.segments.filter((segment: unknown): segment is string => typeof segment === 'string' && segment.trim().length > 0)
          : []

        const fallbackSegments = createDynamicFallbackStory(characterName, theme).segments
        const segments = Array.from({ length: 4 }, (_, i) => candidateSegments[i] || fallbackSegments[i])

        const candidatePrompts = Array.isArray(storyData.brushingPrompts)
          ? storyData.brushingPrompts.filter((prompt: unknown): prompt is string => typeof prompt === 'string' && prompt.trim().length > 0)
          : []
        const brushingPrompts = Array.from({ length: 4 }, (_, i) => candidatePrompts[i] || DEFAULT_BRUSHING_PROMPTS[i])

        await snap.ref.update({
          id: crypto.randomUUID(),
          intro,
          segments,
          brushingPrompts,
          conclusion,
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
