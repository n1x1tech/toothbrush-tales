import { PollyClient, SynthesizeSpeechCommand, VoiceId, Engine } from '@aws-sdk/client-polly';

const pollyClient = new PollyClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Kid-friendly voices with correct engines for each voice
const VOICES: Record<string, { id: VoiceId; engine: Engine }> = {
  // Australian English - Olivia requires generative engine
  Olivia: { id: VoiceId.Olivia, engine: Engine.GENERATIVE },

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
  Ruth: { id: VoiceId.Ruth, engine: Engine.GENERATIVE },
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

export const handler = async (
  event: { arguments: SynthesizeSpeechArgs }
): Promise<string> => {
  const { text, voiceId = 'Joanna' } = event.arguments;

  // Get voice configuration or default to Joanna
  const voice = VOICES[voiceId] || VOICES['Joanna'];

  // Generative engine doesn't support SSML
  const isGenerative = voice.engine === Engine.GENERATIVE;

  // Neural voices only support rate and volume in prosody (NOT pitch)
  // Generative voices don't support SSML at all
  const speechText = isGenerative
    ? text
    : `<speak><prosody rate="slow">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</prosody></speak>`;

  try {
    const command = new SynthesizeSpeechCommand({
      Text: speechText,
      TextType: isGenerative ? 'text' : 'ssml',
      OutputFormat: 'mp3',
      VoiceId: voice.id,
      Engine: voice.engine,
      SampleRate: '22050',
    });

    const response = await pollyClient.send(command);

    if (!response.AudioStream) {
      throw new Error('No audio stream returned from Polly');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const reader = response.AudioStream as AsyncIterable<Uint8Array>;

    for await (const chunk of reader) {
      chunks.push(chunk);
    }

    const audioBuffer = Buffer.concat(chunks);

    // Return as base64 data URL - no S3 needed!
    const base64Audio = audioBuffer.toString('base64');
    return `data:audio/mpeg;base64,${base64Audio}`;
  } catch (error) {
    console.error('Error synthesizing speech:', error);
    throw new Error(`Failed to synthesize speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
