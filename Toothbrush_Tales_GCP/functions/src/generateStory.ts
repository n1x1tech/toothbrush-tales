import * as functions from 'firebase-functions/v1'
import { VertexAI } from '@google-cloud/vertexai'

const vertexAI = new VertexAI({ project: 'toothbrush-tales', location: 'us-central1' })
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

      // Detect if multiple names are provided
      const nameList = characterName
        .split(/,\s*|\s+and\s+|\s+&\s+/)
        .map((n: string) => n.trim())
        .filter((n: string) => n.length > 0)
      const isMultipleCharacters = nameList.length > 1
      const characterGuidance = isMultipleCharacters
        ? `MULTIPLE CHARACTERS: The story stars ${nameList.length} characters: ${nameList.join(', ')}. EVERY character must appear by name in EVERY segment. Give each character distinct actions and dialogue. They work as a team. Use each character's name at least once per segment.`
        : `Use the character's name frequently (at least 2-3 times per segment).`

      const systemPrompt = `You are an award-winning children's storyteller creating engaging 2-minute adventure stories for 6-10 year olds. Your stories are designed to be read aloud during toothbrushing time.

CRITICAL STORY REQUIREMENTS:
1. Create ONE coherent story with a clear narrative arc (beginning \u2192 problem/adventure \u2192 resolution \u2192 celebration)
2. The ENTIRE story must be driven by the specific theme/scenario provided - it's not just background, it IS the plot
3. The SAME characters, setting, and adventure must continue throughout ALL segments
4. Each segment must END with a mini-cliffhanger or transition that connects to the next segment
5. ${characterGuidance}
6. Total story should take exactly 2 minutes when read at a child-friendly pace

WRITING STYLE:
- Write for 6-10 year olds: use engaging vocabulary, some mild suspense, and clever humor
- Include 2-3 sound effects per segment (WHOOOOSH! SPLISH SPLASH! CRASH! ZOOM! POP! SPARKLE!)
- Add humor, unexpected twists, and exciting moments appropriate for elementary school kids
- Use varied sentence structure - mix short punchy sentences with longer descriptive ones
- Include dialogue that sounds natural for the characters
- Reference teeth/brushing naturally 1-2 times per segment (sparkly teeth, bright smile, clean and shiny)
- Make it feel like a real adventure with stakes and challenges

STORY STRUCTURE:
- Intro (5 seconds, ~15 words): Short exciting hook that introduces ${isMultipleCharacters ? 'all characters by name' : 'the character'} and the adventure
- Segment 1 (25 seconds, ~40-50 words): Set the scene directly in the theme's world/scenario
- Segment 2 (25 seconds, ~40-50 words): The adventure deepens, introduce a challenge
- Segment 3 (25 seconds, ~40-50 words): Climax - the most exciting moment
- Segment 4 (25 seconds, ~40-50 words): Resolution - how the adventure concludes
- Conclusion (5 seconds, ~15 words): Celebrate success, connect to clean teeth

CRITICAL LENGTH CONSTRAINT:
- The TOTAL story (intro + all 4 segments + conclusion) must be under 210 words
- Keep it punchy and fast-paced - every word counts
- Do NOT pad segments with filler or repetition`

      const characterDescription = isMultipleCharacters
        ? `${nameList.join(', ')} who are`
        : `"${characterName}" who is`
      const nameInstruction = isMultipleCharacters
        ? `Mention EACH character (${nameList.join(', ')}) by name in every segment - give them each distinct actions`
        : `Mention ${characterName} by name 2-3 times per segment`

      const userPrompt = `Create a toothbrushing adventure story about ${characterDescription} ${theme}.

THE THEME "${theme}" IS THE PLOT: This isn't just a detail - the ENTIRE story must be about ${characterName} experiencing this specific scenario. Every segment should advance this particular adventure, not a generic one.

IMPORTANT: Write a SINGLE CONTINUOUS STORY where each segment flows into the next. The story should feel like one complete adventure about "${theme}", not four separate mini-stories or a generic adventure.

Respond with ONLY valid JSON (no other text, no markdown code blocks):
{
  "intro": "A short exciting hook (10-15 words) about ${characterName} starting their ${theme} adventure",
  "segments": [
    "First paragraph (40-50 words) - ${characterName} begins the ${theme} adventure",
    "Second paragraph (40-50 words) - the ${theme} adventure continues with a challenge",
    "Third paragraph (40-50 words) - the exciting climax of the ${theme} adventure",
    "Fourth paragraph (40-50 words) - ${characterName} succeeds in the ${theme} adventure"
  ],
  "brushingPrompts": [
    "Now brush your bottom teeth nice and clean!",
    "Great job! Now brush your top teeth!",
    "You're doing amazing! Brush the left side!",
    "Almost done! Brush the right side!"
  ],
  "conclusion": "A short celebratory ending (10-15 words) connecting ${theme} success to sparkling teeth"
}

CRITICAL RULES:
- EVERY segment must directly involve the "${theme}" scenario - this is the heart of the story
- Each segment must contain ONLY the story text - NO labels like "Segment 1", NO word counts, NO formatting instructions
- Each segment MUST be 40-50 words of pure story (NOT more!)
- The TOTAL story must be under 210 words including intro and conclusion
- Story must be COHERENT - same characters, same "${theme}" adventure throughout all 4 segments
- Include fun sound effects in EVERY segment (WHOOSH! SPLASH! ZOOM! CRASH! SPARKLE!)
- ${nameInstruction}
- Write for 6-10 year olds: clever, exciting, with some suspense and humor
- NO truly scary content, but mild suspense and challenges are good
- The intro should be exciting and mention putting the toothbrush in their mouth
- The conclusion should celebrate both the ${theme} adventure ending AND their clean sparkly teeth`

      console.log(`[Story] Generating story for character="${characterName}", theme="${theme}"`)

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
