import * as functions from 'firebase-functions/v1'
import { TextToSpeechClient } from '@google-cloud/text-to-speech'

const ttsClient = new TextToSpeechClient()

// Voice mapping: keep Polly-style human names as keys for frontend compatibility
// Journey voices are Google's most natural, conversational voices
// Studio voices are premium quality; Neural2 as fallback options
const VOICES: Record<string, { name: string; languageCode: string }> = {
  // Australian
  Olivia:  { name: 'en-AU-Journey-D', languageCode: 'en-AU' },

  // British
  Amy:     { name: 'en-GB-Journey-D', languageCode: 'en-GB' },
  Emma:    { name: 'en-GB-Journey-F', languageCode: 'en-GB' },
  Brian:   { name: 'en-GB-Neural2-B', languageCode: 'en-GB' },
  Arthur:  { name: 'en-GB-Neural2-D', languageCode: 'en-GB' },

  // American
  Ivy:     { name: 'en-US-Studio-Q',  languageCode: 'en-US' },
  Kevin:   { name: 'en-US-Journey-D', languageCode: 'en-US' },
  Joanna:  { name: 'en-US-Journey-F', languageCode: 'en-US' },
  Matthew: { name: 'en-US-Journey-O', languageCode: 'en-US' },
  Ruth:    { name: 'en-US-Neural2-E', languageCode: 'en-US' },
  Salli:   { name: 'en-US-Neural2-F', languageCode: 'en-US' },
  Joey:    { name: 'en-US-Neural2-A', languageCode: 'en-US' },
  Kendra:  { name: 'en-US-Neural2-H', languageCode: 'en-US' },

  // Indian
  Kajal:   { name: 'en-IN-Neural2-A', languageCode: 'en-IN' },
}

const DEFAULT_VOICE = VOICES['Joanna']

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
        const [response] = await ttsClient.synthesizeSpeech({
          input: {
            text,
          },
          voice: {
            name: voice.name,
            languageCode: voice.languageCode,
          },
          audioConfig: {
            audioEncoding: 'MP3' as const,
            sampleRateHertz: 24000,
            speakingRate: 1.05,
          },
        })

        if (!response.audioContent) {
          throw new Error('No audio content returned')
        }

        const base64Audio = Buffer.from(response.audioContent as Uint8Array).toString('base64')
        console.log(`[TTS] Success! Audio size: ${(response.audioContent as Uint8Array).length} bytes`)

        await snap.ref.update({
          audioData: `data:audio/mpeg;base64,${base64Audio}`,
          status: 'complete',
        })
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
              await snap.ref.update({
                audioData: `data:audio/mpeg;base64,${base64Audio}`,
                status: 'complete',
              })
              return
            }
          } catch (fallbackError) {
            console.error('[TTS] Fallback voice also failed:', fallbackError)
          }
        }

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
