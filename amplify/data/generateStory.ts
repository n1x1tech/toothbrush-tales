import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { Schema } from './resource';

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

type GenerateStoryArgs = {
  characterName: string;
  theme: string;
};

export const handler = async (event: { arguments: GenerateStoryArgs }): Promise<Schema['Story']['type']> => {
  const { characterName, theme } = event.arguments;

  const systemPrompt = `You are an award-winning children's storyteller creating engaging 2-minute bedtime-style stories for 4-6 year olds. Your stories are designed to be read aloud during toothbrushing time.

CRITICAL STORY REQUIREMENTS:
1. Create ONE coherent story with a clear narrative arc (beginning → problem/adventure → resolution → celebration)
2. The SAME characters and setting must continue throughout ALL segments
3. Each segment must END with a mini-cliffhanger or transition that connects to the next segment
4. Use the character's name frequently (at least 2-3 times per segment)
5. Total story should take exactly 2 minutes when read at a child-friendly pace

WRITING STYLE:
- Use simple, vivid vocabulary a 4-year-old understands
- Include 2-3 sound effects per segment (WHOOOOSH! SPLISH SPLASH! BOING! ZOOM! POP! SPARKLE!)
- Add silly moments, funny sounds, and unexpected surprises
- Use short sentences mixed with slightly longer ones
- Include dialogue with simple words
- Reference teeth/brushing naturally 1-2 times per segment (sparkly teeth, bright smile, clean and shiny)
- Make it feel magical and adventurous

STORY STRUCTURE:
- Intro (8-10 seconds): Exciting hook that introduces character and adventure
- Segment 1 (30 seconds, ~70 words): Set the scene, introduce the adventure's beginning
- Segment 2 (30 seconds, ~70 words): The adventure continues, meet a friend or face a challenge
- Segment 3 (30 seconds, ~70 words): Climax - the most exciting part!
- Segment 4 (30 seconds, ~70 words): Resolution - how it all works out wonderfully
- Conclusion (10 seconds): Celebrate success, connect to clean teeth achievement`;

  const userPrompt = `Create a toothbrushing adventure story about "${characterName}" who is ${theme}.

IMPORTANT: Write a SINGLE CONTINUOUS STORY where each segment flows into the next. The story should feel like one complete adventure, not four separate mini-stories.

Respond with ONLY valid JSON (no other text, no markdown code blocks):
{
  "intro": "An exciting 1-2 sentence hook introducing the adventure",
  "segments": [
    "First story paragraph (60-80 words) - ONLY story text, no labels or word counts",
    "Second story paragraph (60-80 words) - continues the same adventure",
    "Third story paragraph (60-80 words) - the exciting climax",
    "Fourth story paragraph (60-80 words) - happy resolution"
  ],
  "brushingPrompts": [
    "Now brush your bottom teeth nice and clean!",
    "Great job! Now brush your top teeth!",
    "You're doing amazing! Brush the left side!",
    "Almost done! Brush the right side!"
  ],
  "conclusion": "A celebratory ending (1-2 sentences)"
}

CRITICAL RULES:
- Each segment must contain ONLY the story text - NO labels like "Segment 1", NO word counts, NO formatting instructions
- Each segment MUST be 60-80 words of pure story
- Story must be COHERENT - same characters, same adventure throughout all 4 segments
- Include fun sound effects in EVERY segment (WHOOSH! SPLASH! ZOOM! POP! SPARKLE!)
- Mention ${characterName} by name 2-3 times per segment
- Keep it silly, fun, and magical for 4-year-olds
- NO scary content - only happy, exciting adventures
- The intro should be exciting and mention putting the toothbrush in their mouth
- The conclusion should celebrate both the story ending AND their clean sparkly teeth`;

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
    temperature: 0.85,
  };

  try {
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Extract the text content from Claude's response
    const textContent = responseBody.content[0].text;

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
    console.error('Error generating story:', error);

    // Return a fallback story if Bedrock fails
    return {
      id: crypto.randomUUID(),
      characterName,
      theme,
      intro: `Get ready for an amazing adventure! This is the story of ${characterName} who is ${theme}. Put your toothbrush in your mouth, and let's go!`,
      segments: [
        `Once upon a time, ${characterName} discovered something magical in the bathroom - a toothbrush that could fly! "WHOOOOSH!" it said, zooming around ${characterName}'s head. "Want to go on an adventure?" it asked with a sparkly grin. ${characterName} nodded excitedly. "Hold on tight!" said the toothbrush, and suddenly they were lifting off the ground, flying right out the window!`,
        `${characterName} and the flying toothbrush soared over a beautiful rainbow valley! "WHEEEEE!" shouted ${characterName}. Down below, they spotted a friendly cloud named Fluffy. "Hello ${characterName}!" Fluffy giggled. "Your teeth look so sparkly and clean!" BOING BOING! ${characterName} bounced on Fluffy's soft cloudiness. "Let's find the Crystal Castle!" said the toothbrush, pointing ahead.`,
        `There it was - the magnificent Crystal Castle made entirely of sparkling teeth! "WOW!" gasped ${characterName}. The castle gates opened with a magical DING DONG! Inside, the Tooth Fairy Queen waved her wand. "Welcome, ${characterName}!" she cheered. "You've found my secret castle!" SPARKLE SPARKLE went her crown. She handed ${characterName} a special golden star. "This is for being such a great brusher!"`,
        `${characterName} flew back home with the golden star glowing brightly. "What an adventure!" ${characterName} laughed. The magic toothbrush did a happy dance - WIGGLE WIGGLE SPIN! "You know why we had so much fun?" asked the toothbrush. "Because you brush your teeth so well!" ${characterName}'s smile was the brightest, sparkliest smile in the whole world! HOORAY!`
      ],
      brushingPrompts: [
        "Now brush your bottom teeth nice and clean!",
        "Great job! Now brush your top teeth!",
        "You're doing amazing! Brush the left side!",
        "Almost done! Brush the right side!"
      ],
      conclusion: `HOORAY! ${characterName} did it, and so did you! Your teeth are sparkling clean and super shiny! You're a brushing superstar! Give yourself a big high five!`,
      audioUrl: null,
      isFavorite: false,
      playbackCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
};
