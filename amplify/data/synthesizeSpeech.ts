import { PollyClient, SynthesizeSpeechCommand, VoiceId, Engine } from '@aws-sdk/client-polly';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const pollyClient = new PollyClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// Kid-friendly voices with correct engines for each voice
// Note: Some voices require 'generative' engine, others 'neural', some only 'standard'
const VOICES: Record<string, { id: VoiceId; engine: Engine; accent: string }> = {
  // Australian English - Olivia requires generative engine
  Olivia: { id: VoiceId.Olivia, engine: Engine.GENERATIVE, accent: 'Australian' },

  // British English
  Amy: { id: VoiceId.Amy, engine: Engine.NEURAL, accent: 'British' },
  Emma: { id: VoiceId.Emma, engine: Engine.NEURAL, accent: 'British' },
  Brian: { id: VoiceId.Brian, engine: Engine.NEURAL, accent: 'British' },
  Arthur: { id: VoiceId.Arthur, engine: Engine.NEURAL, accent: 'British' },

  // American English
  Joanna: { id: VoiceId.Joanna, engine: Engine.NEURAL, accent: 'American' },
  Matthew: { id: VoiceId.Matthew, engine: Engine.NEURAL, accent: 'American' },
  Ivy: { id: VoiceId.Ivy, engine: Engine.NEURAL, accent: 'American' },
  Kendra: { id: VoiceId.Kendra, engine: Engine.NEURAL, accent: 'American' },
  Ruth: { id: VoiceId.Ruth, engine: Engine.GENERATIVE, accent: 'American' },    // Ruth requires generative
  Kevin: { id: VoiceId.Kevin, engine: Engine.NEURAL, accent: 'American' },
  Salli: { id: VoiceId.Salli, engine: Engine.NEURAL, accent: 'American' },
  Joey: { id: VoiceId.Joey, engine: Engine.NEURAL, accent: 'American' },

  // Indian English
  Kajal: { id: VoiceId.Kajal, engine: Engine.NEURAL, accent: 'Indian' },
};

type SynthesizeSpeechArgs = {
  text: string;
  voiceId?: string;
};

type SynthesizeSpeechContext = {
  identity?: {
    sub?: string;
  };
};

export const handler = async (
  event: { arguments: SynthesizeSpeechArgs },
  context?: SynthesizeSpeechContext
): Promise<string> => {
  const { text, voiceId = 'Joanna' } = event.arguments;
  const userId = context?.identity?.sub || 'anonymous';

  // Get voice configuration or default to Joanna
  const voice = VOICES[voiceId] || VOICES['Joanna'];

  // Generative engine doesn't support SSML, so use plain text for those voices
  const isGenerative = voice.engine === Engine.GENERATIVE;

  // For neural/standard, use SSML to slow down speech for young listeners
  // For generative, use plain text (it already sounds natural)
  const speechText = isGenerative
    ? text
    : `<speak><prosody rate="slow" pitch="+5%">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</prosody></speak>`;

  try {
    const command = new SynthesizeSpeechCommand({
      Text: speechText,
      TextType: isGenerative ? 'text' : 'ssml',
      OutputFormat: 'mp3',
      VoiceId: voice.id,
      Engine: voice.engine,
      SampleRate: '22050', // Good quality for speech
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

    // Generate unique filename - save to public path for browser access
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const audioKey = `public/audio/${timestamp}-${randomId}.mp3`;

    // Get bucket name from environment
    const bucketName = process.env.STORAGE_BUCKET_NAME;

    if (!bucketName) {
      throw new Error('Storage bucket not configured');
    }

    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: audioKey,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
      CacheControl: 'max-age=86400', // Cache for 1 day
    }));

    // Return the S3 URL
    return `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${audioKey}`;
  } catch (error) {
    console.error('Error synthesizing speech:', error);
    throw new Error(`Failed to synthesize speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
