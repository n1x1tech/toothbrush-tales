import { PollyClient, SynthesizeSpeechCommand, VoiceId, Engine } from '@aws-sdk/client-polly';

const pollyClient = new PollyClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Kid-friendly voices with correct engines for each voice
// Neural voices are more widely available across regions than Generative voices
const VOICES: Record<string, { id: VoiceId; engine: Engine; fallbackEngine?: Engine }> = {
  // Australian English - Olivia uses generative but has neural fallback
  // Generative has limited regional availability, so try neural first in some regions
  Olivia: { id: VoiceId.Olivia, engine: Engine.GENERATIVE, fallbackEngine: Engine.NEURAL },

  // British English
  Amy: { id: VoiceId.Amy, engine: Engine.NEURAL },
  Emma: { id: VoiceId.Emma, engine: Engine.NEURAL },
  Brian: { id: VoiceId.Brian, engine: Engine.NEURAL },
  Arthur: { id: VoiceId.Arthur, engine: Engine.NEURAL },

  // American English
  Joanna: { id: VoiceId.Joanna, engine: Engine.NEURAL },
  Matthew: { id: VoiceId.Matthew, engine: Engine.NEURAL },
  Ivy: { id: VoiceId.Ivy, engine: Engine.NEURAL },
  Kendra: { id: VoiceId.Kendra, engine: Engine.NEURAL },
  Ruth: { id: VoiceId.Ruth, engine: Engine.GENERATIVE, fallbackEngine: Engine.NEURAL },
  Kevin: { id: VoiceId.Kevin, engine: Engine.NEURAL },
  Salli: { id: VoiceId.Salli, engine: Engine.NEURAL },
  Joey: { id: VoiceId.Joey, engine: Engine.NEURAL },

  // Indian English
  Kajal: { id: VoiceId.Kajal, engine: Engine.NEURAL },
};

type SynthesizeSpeechArgs = {
  text: string;
  voiceId?: string;
};

const POLLY_TIMEOUT_MS = 12000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, context: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${context} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

// Helper function to synthesize speech with a specific engine
async function synthesizeWithEngine(
  text: string,
  voiceIdEnum: VoiceId,
  engine: Engine
): Promise<Buffer> {
  const isGenerative = engine === Engine.GENERATIVE;

  // Neural voices support SSML with rate/volume prosody
  // Generative voices don't support SSML at all
  const speechText = isGenerative
    ? text
    : `<speak><prosody rate="slow">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</prosody></speak>`;

  console.log(`[Polly] Synthesizing with voice=${voiceIdEnum}, engine=${engine}`);

  const command = new SynthesizeSpeechCommand({
    Text: speechText,
    TextType: isGenerative ? 'text' : 'ssml',
    OutputFormat: 'mp3',
    VoiceId: voiceIdEnum,
    Engine: engine,
    SampleRate: '22050',
  });

  const response = await withTimeout(
    pollyClient.send(command),
    POLLY_TIMEOUT_MS,
    `[Polly] SynthesizeSpeech voice=${voiceIdEnum} engine=${engine}`
  );

  if (!response.AudioStream) {
    throw new Error('No audio stream returned from Polly');
  }

  // Use the SDK's built-in method to convert stream to byte array
  // This is more reliable than manual iteration across different Node.js versions
  const audioBytes = await response.AudioStream.transformToByteArray();
  return Buffer.from(audioBytes);
}

async function synthesizeWithRetry(
  text: string,
  voiceIdEnum: VoiceId,
  engine: Engine,
  maxRetries: number = 2
): Promise<Buffer> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`[Polly] Attempt ${attempt}/${maxRetries + 1} voice=${voiceIdEnum} engine=${engine}`);
      return await synthesizeWithEngine(text, voiceIdEnum, engine);
    } catch (error) {
      lastError = error as Error;
      console.error(`[Polly] Attempt ${attempt} failed voice=${voiceIdEnum} engine=${engine}:`, error);
      if (attempt <= maxRetries) {
        const delayMs = Math.pow(2, attempt - 1) * 500;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('Polly synthesis failed after retries');
}

export const handler = async (
  event: { arguments: SynthesizeSpeechArgs }
): Promise<string> => {
  const { text, voiceId = 'Joanna' } = event.arguments;

  const safeText = (text || '').trim();
  if (!safeText) {
    throw new Error('Text is required for speech synthesis');
  }

  console.log(`[Polly] Request received for voice: ${voiceId}, text length: ${safeText.length}`);

  // Get voice configuration or default to Joanna (neural, widely available)
  const voice = VOICES[voiceId] || VOICES['Joanna'];

  try {
    let audioBuffer: Buffer;

    try {
      // Try with primary engine first
      audioBuffer = await synthesizeWithRetry(safeText, voice.id, voice.engine, 2);
    } catch (primaryError) {
      console.error(`[Polly] Primary engine failed:`, primaryError);

      // If there's a fallback engine and primary failed, try fallback
      if (voice.fallbackEngine) {
        console.log(`[Polly] Trying fallback engine: ${voice.fallbackEngine}`);
        try {
          audioBuffer = await synthesizeWithRetry(safeText, voice.id, voice.fallbackEngine, 1);
        } catch (fallbackError) {
          console.error(`[Polly] Fallback engine also failed:`, fallbackError);
          // If voice-specific fallback fails, try Joanna as ultimate fallback
          console.log(`[Polly] Trying Joanna as ultimate fallback`);
          audioBuffer = await synthesizeWithRetry(safeText, VoiceId.Joanna, Engine.NEURAL, 1);
        }
      } else {
        // No fallback engine, try Joanna as ultimate fallback
        console.log(`[Polly] Trying Joanna as ultimate fallback`);
        audioBuffer = await synthesizeWithRetry(safeText, VoiceId.Joanna, Engine.NEURAL, 1);
      }
    }

    // Return as base64 data URL
    const base64Audio = audioBuffer.toString('base64');
    console.log(`[Polly] Success! Audio size: ${audioBuffer.length} bytes`);
    return `data:audio/mpeg;base64,${base64Audio}`;
  } catch (error) {
    console.error('[Polly] All synthesis attempts failed:', error);
    throw new Error(`Failed to synthesize speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
