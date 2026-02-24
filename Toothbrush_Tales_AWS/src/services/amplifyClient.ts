import outputs from '../../amplify_outputs.json'

let isAmplifyConfigured = false

async function ensureAmplifyConfigured() {
  if (isAmplifyConfigured) return

  const { Amplify } = await import('aws-amplify')

  if (outputs && Object.keys(outputs).length > 1) {
    Amplify.configure(outputs)
    console.log('[Amplify] Configured successfully')
  } else {
    console.log('[Amplify] Outputs not configured - run `npx ampx sandbox`')
  }

  isAmplifyConfigured = true
}

export async function getAmplifyDataClient<T extends Record<any, any>>() {
  await ensureAmplifyConfigured()
  const { generateClient } = await import('aws-amplify/data')
  return generateClient<T>()
}
