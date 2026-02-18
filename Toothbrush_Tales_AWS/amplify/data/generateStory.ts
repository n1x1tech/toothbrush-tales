import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Schema } from './resource';
import { buildStoryPrompts, STORY_PROMPT_VERSION } from './storyPrompts';

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

function toNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function toStringArray(value: unknown, fallback: string[], targetLength: number): string[] {
  const parsed = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
    : [];

  if (parsed.length === 0) return fallback;
  if (parsed.length >= targetLength) return parsed.slice(0, targetLength);

  const padded = [...parsed];
  while (padded.length < targetLength) {
    padded.push(fallback[padded.length] || fallback[fallback.length - 1] || '');
  }
  return padded;
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
  const { systemPrompt, userPrompt } = buildStoryPrompts({ characterName, theme });

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

  console.log(`[Story] Generating story for character="${characterName}", theme="${theme}", promptVersion="${STORY_PROMPT_VERSION}"`);

  try {
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-7-sonnet-20250219-v1:0',
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

    const fallbackStory = createDynamicFallbackStory(characterName, theme);
    const fallbackSegments = fallbackStory.segments.map(segment => segment || '');
    const fallbackPrompts = fallbackStory.brushingPrompts.map(prompt => prompt || '');
    const intro = toNonEmptyString(storyData?.intro, fallbackStory.intro);
    const segments = toStringArray(storyData?.segments, fallbackSegments, 4);
    const brushingPrompts = toStringArray(storyData?.brushingPrompts, fallbackPrompts, 4);
    const conclusion = toNonEmptyString(storyData?.conclusion, fallbackStory.conclusion);

    // Return the story in the expected format
    return {
      id: crypto.randomUUID(),
      characterName,
      theme,
      intro,
      segments,
      brushingPrompts,
      conclusion,
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

