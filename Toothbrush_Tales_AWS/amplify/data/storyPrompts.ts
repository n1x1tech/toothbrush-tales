const NAME_SPLIT_REGEX = /,\s*|\s+and\s+|\s+&\s+/;
export const STORY_PROMPT_VERSION = 'tts_v1';

type StoryPromptInput = {
  characterName: string;
  theme: string;
};

function parseCharacterNames(characterName: string): string[] {
  return characterName
    .split(NAME_SPLIT_REGEX)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

export function buildStoryPrompts({ characterName, theme }: StoryPromptInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const nameList = parseCharacterNames(characterName);
  const isMultipleCharacters = nameList.length > 1;
  const characterGuidance = isMultipleCharacters
    ? `MULTIPLE CHARACTERS: The story has ${nameList.length} heroes (${nameList.join(', ')}). Every segment must include each hero by name with distinct actions.`
    : `Use the hero's name naturally and frequently to keep the story personal.`;

  const systemPrompt = `You are a world-class children's storyteller and professional Voice Director.

Your mission: create a highly engaging toothbrushing adventure that sounds natural across all TTS engines.

MANDATORY TTS RULES
1) Natural language
- Use contractions naturally (don't, it's, we'll, you're, let's).
- Avoid formal phrasing like "do not," "it is," "we will."
- Tone for ages 5-10, playful and clear.

2) Rhythm and pacing
- Use short/medium sentences with natural variation.
- Avoid long nested clauses.
- Use paragraph-style flow within each segment.
- Keep total story length (intro + 4 segments + conclusion) between 250 and 350 words.

3) Controlled expressiveness
- Use ellipses (...) occasionally for suspense.
- Use exclamation points sparingly.
- Use ALL CAPS rarely, one word at a time.
- Never stack punctuation.
- Emotion should come from wording and pacing.

4) Sound and action
- Use light onomatopoeia in moderation.
- Limit to 1-2 sound effects per segment.
- Use strong action verbs.
- Include clear brushing movement cues throughout the story arc.

5) Fantasy names
- If a fantasy name appears, add phonetic spelling once only:
  Example: Zarlock (ZAR-lock)

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
- intro: 20-35 words
- each segment: 45-70 words
- conclusion: 15-30 words
- brushingPrompts: short child-friendly action cues, one per segment
- Total words across intro + segments + conclusion: 250-350
- Keep one coherent adventure tied to the theme.
- ${characterGuidance}`;

  const characterInstruction = isMultipleCharacters
    ? `If multiple characters are provided, every segment must include each by name with distinct actions: ${nameList.join(', ')}.`
    : `Keep the single hero centered and active in every segment: ${characterName}.`;

  const userPrompt = `Create a toothbrushing adventure story for:
- Character(s): ${characterName}
- Theme: ${theme}

The theme must drive the entire plot. Keep one continuous story from intro through conclusion.
${characterInstruction}
Return JSON only in the required schema.`;

  return { systemPrompt, userPrompt };
}
