import * as functions from 'firebase-functions/v1'
import { TextToSpeechClient } from '@google-cloud/text-to-speech'

const ttsClient = new TextToSpeechClient()

// Voice mapping: keep Polly-style human names as keys for frontend compatibility.
// Prefer broadly-available Neural2 voices for better reliability.
const VOICES: Record<string, { name: string; languageCode: string }> = {
  // Australian
  Olivia:  { name: 'en-AU-Neural2-A', languageCode: 'en-AU' },

  // British
  Amy:     { name: 'en-GB-Neural2-A', languageCode: 'en-GB' },
  Emma:    { name: 'en-GB-Neural2-F', languageCode: 'en-GB' },
  Brian:   { name: 'en-GB-Neural2-B', languageCode: 'en-GB' },
  Arthur:  { name: 'en-GB-Neural2-D', languageCode: 'en-GB' },

  // American
  Ivy:     { name: 'en-US-Neural2-F', languageCode: 'en-US' },
  Kevin:   { name: 'en-US-Neural2-I', languageCode: 'en-US' },
  Joanna:  { name: 'en-US-Neural2-C', languageCode: 'en-US' },
  Matthew: { name: 'en-US-Neural2-D', languageCode: 'en-US' },
  Ruth:    { name: 'en-US-Neural2-E', languageCode: 'en-US' },
  Salli:   { name: 'en-US-Neural2-F', languageCode: 'en-US' },
  Joey:    { name: 'en-US-Neural2-A', languageCode: 'en-US' },
  Kendra:  { name: 'en-US-Neural2-H', languageCode: 'en-US' },

  // Indian
  Kajal:   { name: 'en-IN-Neural2-A', languageCode: 'en-IN' },
}

const DEFAULT_VOICE = VOICES['Joanna']

type VoiceConfig = { name: string; languageCode: string }

async function synthesizeWithRetry(
  text: string,
  voicesToTry: VoiceConfig[],
): Promise<Uint8Array> {
  let lastError: unknown

  for (const voice of voicesToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const [response] = await ttsClient.synthesizeSpeech({
          input: { ssml: textToSsml(text) },
          voice: {
            name: voice.name,
            languageCode: voice.languageCode,
          },
          audioConfig: {
            audioEncoding: 'MP3' as const,
            sampleRateHertz: 24000,
            speakingRate: 0.88,
          },
        })

        if (!response.audioContent) {
          throw new Error('No audio content returned')
        }

        return response.audioContent as Uint8Array
      } catch (error) {
        lastError = error
        console.error(`[TTS] Voice ${voice.name} failed (attempt ${attempt}/2):`, error)
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 300))
        }
      }
    }
  }

  throw lastError ?? new Error('Failed to synthesize speech')
}

// Convert plain text to SSML with natural pauses
function textToSsml(text: string): string {
  // Escape XML special characters
  let ssml = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

  // Add longer pause for ellipsis
  ssml = ssml.replace(/\.{3}/g, '<break time="600ms"/>')

  // Add pause after sentence-ending punctuation (. ! ?)
  ssml = ssml.replace(/([.!?])\s+/g, '$1<break time="300ms"/> ')

  return `<speak>${ssml}</speak>`
}

// Firestore-triggered function: listens for new TTS requests
export const onTTSRequest = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .firestore.document('ttsRequests/{requestId}')
  .onCreate(async (snap) => {
    try {
      const data = snap.data()
      const { text, voiceId = 'Joanna' } = data

      if (!text) {
        await snap.ref.update({ status: 'error', error: 'text is required' })
        return
      }

      const voice = VOICES[voiceId] || DEFAULT_VOICE

      console.log(`[TTS] Synthesizing with voice=${voiceId} (${voice.name}), text length: ${text.length}`)

      try {
        const audioContent = await synthesizeWithRetry(text, [
          voice,
          DEFAULT_VOICE,
          { name: 'en-US-Neural2-C', languageCode: 'en-US' },
          { name: 'en-US-Standard-C', languageCode: 'en-US' },
        ])
        const base64Audio = Buffer.from(audioContent).toString('base64')
        console.log(`[TTS] Success! Audio size: ${audioContent.length} bytes`)

        await snap.ref.update({
          audioData: `data:audio/mpeg;base64,${base64Audio}`,
          status: 'complete',
        })
      } catch (error) {
        console.error('[TTS] Synthesis error:', error)
        await snap.ref.update({
          status: 'error',
          error: 'Failed to synthesize speech',
        })
      }
    } catch (outerError) {
      console.error('[TTS] Fatal error (likely Firestore write failed):', outerError)
      try {
        await snap.ref.update({ status: 'error', error: 'Internal error' })
      } catch { /* nothing more we can do */ }
    }
  })
