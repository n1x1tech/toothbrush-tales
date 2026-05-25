const NAME_SPLIT_REGEX = /,\s*|\s+and\s+|\s+&\s+/
export const STORY_PROMPT_VERSION = 'tts_v2'

export type AgeRange = '2-5' | '5-10' | '10-15'

type StoryPromptInput = {
  characterName: string
  theme: string
  ageRange?: AgeRange
}

function parseCharacterNames(characterName: string): string[] {
  return characterName
    .split(NAME_SPLIT_REGEX)
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
}

export function buildStoryPrompts({ characterName, theme, ageRange = '5-10' }: StoryPromptInput): {
  systemPrompt: string
  userPrompt: string
} {
  const nameList = parseCharacterNames(characterName)
  const isMultipleCharacters = nameList.length > 1
  const characterGuidance = isMultipleCharacters
    ? `MULTIPLE CHARACTERS: The story has ${nameList.length} heroes (${nameList.join(', ')}). Every segment must include each hero by name with distinct actions.`
    : `Use the hero's name naturally and frequently to keep the story personal.`

  // Age-dependent tone and length guidance
  const ageGuidance: Record<string, { tone: string; wordRange: string; segmentRange: string; introRange: string; conclusionRange: string }> = {
    '2-5': {
      tone: 'Very simple words (1-2 syllables), very short sentences, lots of repetition, silly sounds and giggles.',
      wordRange: '150-250',
      segmentRange: '25-45',
      introRange: '15-25',
      conclusionRange: '10-20',
    },
    '5-10': {
      tone: 'Playful and clear. Fun vocabulary, natural pacing, kid-friendly humor.',
      wordRange: '250-350',
      segmentRange: '45-70',
      introRange: '20-35',
      conclusionRange: '15-30',
    },
    '10-15': {
      tone: 'More adventure and humor. Richer vocabulary, longer narrative arcs, vivid descriptions.',
      wordRange: '300-450',
      segmentRange: '55-90',
      introRange: '25-40',
      conclusionRange: '20-35',
    },
  }

  const age = ageGuidance[ageRange] || ageGuidance['5-10']

  const systemPrompt = `You are a world-class children's storyteller and professional Voice Director.

Your mission: create a highly engaging story that sounds natural across all TTS engines.
The adventure can be about any kid-friendly theme. It does not need to be about teeth or toothbrushes.
Brushing guidance belongs in brushingPrompts, not as the core plot of every paragraph.

MANDATORY TTS RULES
1) Natural language
- Use contractions naturally (don't, it's, we'll, you're, let's).
- Avoid formal phrasing like "do not," "it is," "we will."
- ${age.tone}

2) Rhythm and pacing
- Use short/medium sentences with natural variation.
- Avoid long nested clauses.
- Use paragraph-style flow within each segment.
- Keep total story length (intro + 4 segments + conclusion) between ${age.wordRange} words.

3) Controlled expressiveness
- Use ellipses (...) occasionally for suspense.
- Use exclamation points sparingly.
- Use ALL CAPS rarely, one word at a time.
- Never stack punctuation.
- Emotion should come from wording and pacing.

4) Sound and action
- Use light onomatopoeia very sparingly.
- Use at most 1 sound-effect word in the entire story, and skip it unless it truly helps.
- Use strong action verbs.
- Keep brushing references light in the story body.

5) Fantasy names
- Never include pronunciation guides, phonetic spellings, or parenthetical hints.
- If a name is hard to pronounce, just use it naturally — TTS will handle it.

6) Safety and cleanliness
- No emojis, hashtags, markdown, stage directions, or labels.
- No commentary or explanations.

STORY FLOW
- Immediate action opening.
- Start with back teeth on one side, then switch sides early.
- Move to front teeth.
- Alternate naturally between upper and lower areas.
- No gum-line-specific segment.
- Escalating adventure with small obstacles.
- Final countdown and triumphant finish.

OUTPUT FORMAT (STRICT)
Return ONLY valid JSON with EXACTLY these keys:
{
  "intro": string,
  "segments": [string, string, string, string],
  "brushingPrompts": [string, string, string, string],
  "conclusion": string
}

FIELD RULES
- intro: ${age.introRange} words
- each segment: ${age.segmentRange} words
- conclusion: ${age.conclusionRange} words
- brushingPrompts: short child-friendly action cues, one per segment
- brushingPrompts tone: encouraging and natural (example: "You're doing great! Now brush the left side.")
- Total words across intro + segments + conclusion: ${age.wordRange}
- Keep one coherent adventure tied to the theme.
- ${characterGuidance}`

  const characterInstruction = isMultipleCharacters
    ? `If multiple characters are provided, every segment must include each by name with distinct actions: ${nameList.join(', ')}.`
    : `Keep the single hero centered and active in every segment: ${characterName}.`

  const userPrompt = `Create a story for:
- Character(s): ${characterName}
- Theme: ${theme}

The theme must drive the entire plot. Keep one continuous story from intro through conclusion.
Do not force the plot to be about brushing or toothbrushes.
Keep onomatopoeia minimal.
${characterInstruction}
Return JSON only in the required schema.`

  return { systemPrompt, userPrompt }
}
