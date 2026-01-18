import { PollyClient, SynthesizeSpeechCommand, VoiceId, Engine } from '@aws-sdk/client-polly';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const pollyClient = new PollyClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// Kid-friendly neural voices
const VOICES: Record<string, { id: VoiceId; engine: Engine }> = {
  Joanna: { id: VoiceId.Joanna, engine: Engine.NEURAL },    // Female, US English - warm and friendly
  Matthew: { id: VoiceId.Matthew, engine: Engine.NEURAL },  // Male, US English - gentle
  Ivy: { id: VoiceId.Ivy, engine: Engine.NEURAL },          // Child-like, US English - perfect for kids
  Kendra: { id: VoiceId.Kendra, engine: Engine.NEURAL },    // Female, US English - clear
  Ruth: { id: VoiceId.Ruth, engine: Engine.NEURAL },        // Female, US English - expressive
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
