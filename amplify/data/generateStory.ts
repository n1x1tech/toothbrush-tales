import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Schema } from './resource';

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

type GenerateStoryArgs = {
  characterName: string;
  theme: string;
};

// Dynamic fallback story templates that actually use the theme
const STORY_TEMPLATES = [
  {
    intro: (name: string, theme: string) =>
      `Hold onto your toothbrush because ${name} is about to have an incredible adventure! This is the story of ${name} who is ${theme}. Ready? Let's go!`,
    segments: (name: string, theme: string) => [
      `${name} couldn't believe it - today was finally the day to ${theme}! With a toothbrush in hand and a sparkly smile, ${name} was ready for anything. WHOOOOSH! A magical wind swept through, and suddenly everything around ${name} started to shimmer and glow. "This is going to be amazing!" ${name} cheered, bouncing with excitement.`,
      `But wait - there was a problem! To truly ${theme}, ${name} needed to solve a tricky puzzle first. CRACK! A friendly talking squirrel appeared. "I can help," it squeaked, "but only if your teeth are super sparkly!" ${name} grinned wide, showing off those clean chompers. "Let's do this!" they shouted together.`,
      `${name} and the squirrel zoomed through magical clouds, past rainbow waterfalls, and over mountains made of marshmallows - all while continuing to ${theme}! SPARKLE SPARKLE! Everything was going perfectly until - oh no! - a silly obstacle appeared. But ${name} wasn't worried. With a bright smile and quick thinking, the problem was solved in a flash!`,
      `"You did it!" everyone cheered as ${name} finished the adventure of ${theme}. HOORAY! Confetti rained down, and ${name}'s teeth sparkled brighter than ever. The squirrel did a happy dance. "That was the best adventure ever," ${name} laughed. And it all started with a great brushing session!`
    ],
    conclusion: (name: string, theme: string) =>
      `What an adventure! ${name} conquered ${theme} with flying colors! Your teeth are sparkling like stars - you're officially an adventure champion!`
  },
  {
    intro: (name: string, theme: string) =>
      `Get ready for an epic tale! ${name} is about to discover what happens when ${theme} becomes the adventure of a lifetime! Grab your toothbrush and let's go!`,
    segments: (name: string, theme: string) => [
      `${name} woke up with a feeling that today would be special. And ${name} was right! The moment ${name} started thinking about ${theme}, something magical happened. FLASH! A golden ticket appeared out of thin air. "Your adventure awaits," it read. ${name} pumped a fist in the air. "Yes! Let's go!"`,
      `Following the golden ticket's map, ${name} discovered a secret garden where everything was connected to ${theme}. But a grumpy garden gnome blocked the path. "Only those with the brightest smiles may enter!" he declared. PING! ${name}'s teeth twinkled in the sunlight. The gnome's jaw dropped. "Wow, those are some impressive teeth!"`,
      `Inside the garden, ${name} had to complete three challenges - all related to ${theme}. SWOOSH! ZOOM! SPLASH! Each one was trickier than the last, but ${name} never gave up. With every challenge conquered, ${name}'s confidence grew stronger. "I can do anything!" ${name} declared, striking a superhero pose.`,
      `The final challenge was the biggest yet, but ${name} was ready. Using everything learned during the ${theme} adventure, ${name} solved it brilliantly! KABOOM! Fireworks exploded in celebration. "You're a true hero!" the gnome cheered, no longer grumpy at all. ${name} took a bow, grinning from ear to ear.`
    ],
    conclusion: (name: string, theme: string) =>
      `Incredible! ${name} mastered the ${theme} challenge like a true champion! Those sparkling teeth helped save the day. You're amazing!`
  },
  {
    intro: (name: string, theme: string) =>
      `Buckle up for adventure! When ${name} decided to ${theme}, nobody expected what would happen next! This is going to be wild!`,
    segments: (name: string, theme: string) => [
      `${name} had always dreamed about ${theme}, and today that dream was coming true! VROOM! A rocket-powered skateboard appeared at ${name}'s feet. "Cool!" ${name} exclaimed, hopping on. The skateboard zoomed forward, taking ${name} on the first leg of this epic ${theme} journey. Wind whooshed past as ${name} laughed with joy.`,
      `Suddenly, the skateboard stopped at a bubbling brook. A wise old owl perched on a branch nearby. "To continue your journey of ${theme}, you must answer my riddle," the owl hooted. HOOT HOOT! ${name} thought hard, teeth gleaming in concentration. "I've got it!" ${name} shouted, and the owl nodded approvingly.`,
      `With the riddle solved, ${name} soared through candy-colored skies, getting closer and closer to completing ${theme}. WHOOOOSH! But then came the twistiest twist - a maze of mirrors! ${name} could see a hundred reflections, all smiling back. "My sparkly teeth will light the way!" And they did! SHIMMER SHIMMER!`,
      `${name} burst through the final mirror and landed in a celebration parade! Everyone was cheering because ${name} had done it - ${theme} was complete! HOORAY! Balloons floated everywhere, and a marching band played a victory song. ${name} waved to the crowd, feeling like the happiest kid in the universe.`
    ],
    conclusion: (name: string, theme: string) =>
      `AMAZING! ${name} finished the ${theme} adventure in spectacular style! Those super-clean teeth were the secret weapon all along. You're a superstar!`
  }
];

// Format multiple names naturally for story text (e.g., "Arlo, Luna and Max")
function formatNames(characterName: string): string {
  const names = characterName
    .split(/,\s*|\s+and\s+|\s+&\s+/)
    .map(n => n.trim())
    .filter(n => n.length > 0);
  if (names.length <= 1) return characterName;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function createDynamicFallbackStory(characterName: string, theme: string): Schema['Story']['type'] {
  // Pick a random template for variety
  const template = STORY_TEMPLATES[Math.floor(Math.random() * STORY_TEMPLATES.length)];
  const displayName = formatNames(characterName);

  return {
    id: crypto.randomUUID(),
    characterName,
    theme,
    intro: template.intro(displayName, theme),
    segments: template.segments(displayName, theme),
    brushingPrompts: [
      "Now brush your bottom teeth nice and clean!",
      "Great job! Now brush your top teeth!",
      "You're doing amazing! Brush the left side!",
      "Almost done! Brush the right side!"
    ],
    conclusion: template.conclusion(displayName, theme),
    audioUrl: null,
    isFavorite: false,
    playbackCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Helper function to call Bedrock with retry logic
async function invokeBedrockWithRetry(
  command: InvokeModelCommand,
  maxRetries: number = 2
): Promise<{ content: Array<{ text: string }> }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`[Story] Bedrock attempt ${attempt}/${maxRetries + 1}`);
      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody;
    } catch (error) {
      lastError = error as Error;
      console.error(`[Story] Bedrock attempt ${attempt} failed:`, error);

      // Don't retry on the last attempt
      if (attempt <= maxRetries) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[Story] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('All Bedrock retry attempts failed');
}

export const handler = async (event: { arguments: GenerateStoryArgs }): Promise<Schema['Story']['type']> => {
  const { characterName, theme } = event.arguments;

  // Detect if multiple names are provided
  const nameList = characterName
    .split(/,\s*|\s+and\s+|\s+&\s+/)
    .map(n => n.trim())
    .filter(n => n.length > 0);
  const isMultipleCharacters = nameList.length > 1;
  const characterGuidance = isMultipleCharacters
    ? `MULTIPLE CHARACTERS: The story stars ${nameList.length} characters: ${nameList.join(', ')}. EVERY character must appear by name in EVERY segment. Give each character distinct actions and dialogue. They work as a team. Use each character's name at least once per segment.`
    : `Use the character's name frequently (at least 2-3 times per segment).`;

  const systemPrompt = `You are an award-winning children's storyteller creating engaging 2-minute adventure stories for 6-10 year olds. Your stories are designed to be read aloud during toothbrushing time.

CRITICAL STORY REQUIREMENTS:
1. Create ONE coherent story with a clear narrative arc (beginning → problem/adventure → resolution → celebration)
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
- Intro (8-10 seconds): Exciting hook that introduces ${isMultipleCharacters ? 'all characters by name' : 'the character'} and the specific adventure theme
- Segment 1 (30 seconds, ~70 words): Set the scene directly in the theme's world/scenario
- Segment 2 (30 seconds, ~70 words): The theme-specific adventure deepens, introduce a challenge related to the theme
- Segment 3 (30 seconds, ~70 words): Climax - the most exciting moment tied directly to the theme
- Segment 4 (30 seconds, ~70 words): Resolution - how the theme-specific adventure concludes
- Conclusion (10 seconds): Celebrate success, connect to clean teeth achievement`;

  const characterDescription = isMultipleCharacters
    ? `${nameList.join(', ')} who are`
    : `"${characterName}" who is`;
  const nameInstruction = isMultipleCharacters
    ? `Mention EACH character (${nameList.join(', ')}) by name in every segment - give them each distinct actions`
    : `Mention ${characterName} by name 2-3 times per segment`;

  const userPrompt = `Create a toothbrushing adventure story about ${characterDescription} ${theme}.

THE THEME "${theme}" IS THE PLOT: This isn't just a detail - the ENTIRE story must be about ${characterName} experiencing this specific scenario. Every segment should advance this particular adventure, not a generic one.

IMPORTANT: Write a SINGLE CONTINUOUS STORY where each segment flows into the next. The story should feel like one complete adventure about "${theme}", not four separate mini-stories or a generic adventure.

Respond with ONLY valid JSON (no other text, no markdown code blocks):
{
  "intro": "An exciting 1-2 sentence hook about ${characterName} starting their ${theme} adventure",
  "segments": [
    "First paragraph (60-80 words) - ${characterName} begins the ${theme} adventure",
    "Second paragraph (60-80 words) - the ${theme} adventure continues with a challenge",
    "Third paragraph (60-80 words) - the exciting climax of the ${theme} adventure",
    "Fourth paragraph (60-80 words) - ${characterName} succeeds in the ${theme} adventure"
  ],
  "brushingPrompts": [
    "Now brush your bottom teeth nice and clean!",
    "Great job! Now brush your top teeth!",
    "You're doing amazing! Brush the left side!",
    "Almost done! Brush the right side!"
  ],
  "conclusion": "A celebratory ending connecting the ${theme} success to sparkling teeth (1-2 sentences)"
}

CRITICAL RULES:
- EVERY segment must directly involve the "${theme}" scenario - this is the heart of the story
- Each segment must contain ONLY the story text - NO labels like "Segment 1", NO word counts, NO formatting instructions
- Each segment MUST be 60-80 words of pure story
- Story must be COHERENT - same characters, same "${theme}" adventure throughout all 4 segments
- Include fun sound effects in EVERY segment (WHOOSH! SPLASH! ZOOM! CRASH! SPARKLE!)
- ${nameInstruction}
- Write for 6-10 year olds: clever, exciting, with some suspense and humor
- NO truly scary content, but mild suspense and challenges are good
- The intro should be exciting and mention putting the toothbrush in their mouth
- The conclusion should celebrate both the ${theme} adventure ending AND their clean sparkly teeth`;

  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature: 0.9, // Higher temperature for more creative, varied stories
  };

  console.log(`[Story] Generating story for character="${characterName}", theme="${theme}"`);

  try {
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    // Use retry logic for resilient Bedrock calls
    const responseBody = await invokeBedrockWithRetry(command, 2);

    // Extract the text content from Claude's response
    const textContent = responseBody.content[0].text;
    console.log(`[Story] Bedrock response received, length: ${textContent.length}`);

    // Parse the JSON from the response (handle potential markdown code blocks)
    let jsonString = textContent.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.slice(7);
    }
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.slice(3);
    }
    if (jsonString.endsWith('```')) {
      jsonString = jsonString.slice(0, -3);
    }

    const storyData = JSON.parse(jsonString.trim());
    console.log(`[Story] Successfully parsed story JSON`);

    // Return the story in the expected format
    return {
      id: crypto.randomUUID(),
      characterName,
      theme,
      intro: storyData.intro,
      segments: storyData.segments,
      brushingPrompts: storyData.brushingPrompts,
      conclusion: storyData.conclusion,
      audioUrl: null,
      isFavorite: false,
      playbackCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Story] Error generating story from Bedrock:', error);
    console.log(`[Story] Using dynamic fallback for character="${characterName}", theme="${theme}"`);

    // Return a dynamic fallback story that actually uses the theme
    return createDynamicFallbackStory(characterName, theme);
  }
};
