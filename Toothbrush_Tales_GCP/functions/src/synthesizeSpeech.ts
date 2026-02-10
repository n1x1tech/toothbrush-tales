import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { TextToSpeechClient } from '@google-cloud/text-to-speech'

const ttsClient = new TextToSpeechClient()

// Voice mapping: keep Polly-style human names as keys for frontend compatibility
const VOICES: Record<string, { name: string; languageCode: string }> = {
  // Australian
  Olivia:  { name: 'en-AU-Neural2-A', languageCode: 'en-AU' },

  // British
  Amy:     { name: 'en-GB-Neural2-A', languageCode: 'en-GB' },
  Emma:    { name: 'en-GB-Neural2-F', languageCode: 'en-GB' },
  Brian:   { name: 'en-GB-Neural2-B', languageCode: 'en-GB' },
  Arthur:  { name: 'en-GB-Neural2-D', languageCode: 'en-GB' },

  // American
  Ivy:     { name: 'en-US-Studio-Q',  languageCode: 'en-US' },
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

interface SynthesizeRequest {
  text: string
  voiceId?: string
}

export const synthesizeSpeech = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1',
  },
  async (request) => {
    const { text, voiceId = 'Joanna' } = request.data as SynthesizeRequest

    if (!text) {
      throw new HttpsError('invalid-argument', 'text is required')
    }

    const voice = VOICES[voiceId] || DEFAULT_VOICE

    console.log(`[TTS] Synthesizing with voice=${voiceId} (${voice.name}), text length: ${text.length}`)

    try {
      const [response] = await ttsClient.synthesizeSpeech({
        input: {
          // Use SSML for rate control (equivalent to Polly's <prosody rate="slow">)
          ssml: `<speak><prosody rate="slow">${text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</prosody></speak>`,
        },
        voice: {
          name: voice.name,
          languageCode: voice.languageCode,
        },
        audioConfig: {
          audioEncoding: 'MP3' as const,
          sampleRateHertz: 22050,
          speakingRate: 1.0, // SSML handles rate, keep this at 1.0
        },
      })

      if (!response.audioContent) {
        throw new Error('No audio content returned')
      }

      // Convert to base64 data URL (same format as Polly version)
      const base64Audio = Buffer.from(response.audioContent as Uint8Array).toString('base64')
      console.log(`[TTS] Success! Audio size: ${(response.audioContent as Uint8Array).length} bytes`)
      return `data:audio/mpeg;base64,${base64Audio}`
    } catch (error) {
      console.error('[TTS] Synthesis error:', error)

      // Fallback to default voice if a non-default voice failed
      if (voiceId !== 'Joanna') {
        console.log('[TTS] Retrying with default voice (Joanna)')
        try {
          const [fallbackResponse] = await ttsClient.synthesizeSpeech({
            input: { text },
            voice: { name: DEFAULT_VOICE.name, languageCode: DEFAULT_VOICE.languageCode },
            audioConfig: { audioEncoding: 'MP3' as const, sampleRateHertz: 22050 },
          })

          if (fallbackResponse.audioContent) {
            const base64Audio = Buffer.from(fallbackResponse.audioContent as Uint8Array).toString('base64')
            return `data:audio/mpeg;base64,${base64Audio}`
          }
        } catch (fallbackError) {
          console.error('[TTS] Fallback voice also failed:', fallbackError)
        }
      }

      throw new HttpsError('internal', 'Failed to synthesize speech')
    }
  }
)
