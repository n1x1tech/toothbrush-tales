import { PollyClient, SynthesizeSpeechCommand, VoiceId, Engine } from '@aws-sdk/client-polly';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const pollyClient = new PollyClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// Kid-friendly neural voices with multiple accents
const VOICES: Record<string, { id: VoiceId; engine: Engine; accent: string }> = {
  // Australian English
  Olivia: { id: VoiceId.Olivia, engine: Engine.NEURAL, accent: 'Australian' },  // Female, Australian - natural and warm

  // British English
  Amy: { id: VoiceId.Amy, engine: Engine.NEURAL, accent: 'British' },           // Female, British - clear and friendly
  Emma: { id: VoiceId.Emma, engine: Engine.NEURAL, accent: 'British' },         // Female, British - warm
  Brian: { id: VoiceId.Brian, engine: Engine.NEURAL, accent: 'British' },       // Male, British - gentle
  Arthur: { id: VoiceId.Arthur, engine: Engine.NEURAL, accent: 'British' },     // Male, British - warm

  // American English
  Joanna: { id: VoiceId.Joanna, engine: Engine.NEURAL, accent: 'American' },    // Female, US - warm and friendly
  Matthew: { id: VoiceId.Matthew, engine: Engine.NEURAL, accent: 'American' },  // Male, US - gentle
  Ivy: { id: VoiceId.Ivy, engine: Engine.NEURAL, accent: 'American' },          // Child-like, US - perfect for kids
  Kendra: { id: VoiceId.Kendra, engine: Engine.NEURAL, accent: 'American' },    // Female, US - clear
  Ruth: { id: VoiceId.Ruth, engine: Engine.NEURAL, accent: 'American' },        // Female, US - expressive
  Kevin: { id: VoiceId.Kevin, engine: Engine.NEURAL, accent: 'American' },      // Male child, US - great for kids
  Salli: { id: VoiceId.Salli, engine: Engine.NEURAL, accent: 'American' },      // Female, US - friendly
  Joey: { id: VoiceId.Joey, engine: Engine.NEURAL, accent: 'American' },        // Male, US - casual

  // Indian English
  Kajal: { id: VoiceId.Kajal, engine: Engine.NEURAL, accent: 'Indian' },        // Female, Indian English
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

  // Wrap text in SSML to slow down speech for young listeners
  const ssmlText = `<speak>
    <prosody rate="slow" pitch="+5%">
      ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
    </prosody>
  </speak>`;

  try {
    const command = new SynthesizeSpeechCommand({
      Text: ssmlText,
      TextType: 'ssml',
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

    // Generate unique filename
    const timestamp = Date.now();
    const audioKey = `audio/${userId}/${timestamp}.mp3`;

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
