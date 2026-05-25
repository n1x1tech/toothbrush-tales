# Toothbrush Tales - GCP/Firebase Build Guide

A step-by-step guide to rebuilding Toothbrush Tales on Google Cloud Platform, mirroring the existing AWS Amplify architecture. Use this to compare developer experience, feature parity, and cost between AWS and GCP.

---

## Table of Contents

1. [Service Mapping (AWS vs GCP)](#1-service-mapping-aws-vs-gcp)
2. [Prerequisites & Project Setup](#2-prerequisites--project-setup)
3. [Authentication (Firebase Auth)](#3-authentication-firebase-auth)
4. [Database (Cloud Firestore)](#4-database-cloud-firestore)
5. [Cloud Functions (Story Generation + TTS)](#5-cloud-functions-story-generation--tts)
6. [Storage (Cloud Storage)](#6-storage-cloud-storage)
7. [Frontend Integration](#7-frontend-integration)
8. [PWA & Hosting (Firebase Hosting)](#8-pwa--hosting-firebase-hosting)
9. [Cost Comparison](#9-cost-comparison)
10. [Key Differences & Gotchas](#10-key-differences--gotchas)
11. [Migration Checklist](#11-migration-checklist)

---

## 1. Service Mapping (AWS vs GCP)

| Function | AWS (Current) | GCP (Target) | Notes |
|----------|--------------|--------------|-------|
| **Full-stack framework** | AWS Amplify Gen2 | Firebase | Closest equivalent; CLI-driven, integrated services |
| **Authentication** | Cognito User Pools + Identity Pool | Firebase Authentication | Built-in anonymous auth replaces Cognito guest access |
| **API layer** | AppSync (GraphQL) | Cloud Functions (callable) | Firebase callable functions replace GraphQL; alternatively use Cloud Run + REST |
| **Database** | DynamoDB | Cloud Firestore | Document DB; real-time sync built-in |
| **Object storage** | S3 | Cloud Storage for Firebase | Equivalent bucket storage with security rules |
| **Serverless compute** | Lambda (Node.js) | Cloud Functions for Firebase (Node.js) | Same runtime, similar cold-start behaviour |
| **AI story generation** | Bedrock (Claude 3 Haiku) | Vertex AI (Claude 3 Haiku) | Anthropic models available on Vertex AI |
| **Text-to-speech** | Amazon Polly | Google Cloud Text-to-Speech | Different voice names; equivalent quality (Neural/WaveNet) |
| **IaC / CLI** | Amplify CLI (`ampx`) | Firebase CLI (`firebase`) | Similar deploy workflow |
| **Hosting** | Amplify Hosting (static) | Firebase Hosting | Global CDN, SSL, custom domains |
| **CI/CD** | Amplify builds on push | Cloud Build / Firebase Hosting GitHub integration | Auto-deploy on push to main |

---

## 2. Prerequisites & Project Setup

### Install tools

```bash
# Firebase CLI
npm install -g firebase-tools

# Google Cloud SDK (for Vertex AI and advanced GCP services)
# Download from: https://cloud.google.com/sdk/docs/install

# Authenticate
firebase login
gcloud auth login
```

### Create GCP project

```bash
# Create project (or use Firebase console: https://console.firebase.google.com)
gcloud projects create toothbrush-tales-gcp --name="Toothbrush Tales GCP"
gcloud config set project toothbrush-tales-gcp

# Enable required APIs
gcloud services enable \
  cloudfunctions.googleapis.com \
  firestore.googleapis.com \
  texttospeech.googleapis.com \
  aiplatform.googleapis.com \
  storage.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com
```

### Initialise Firebase

```bash
mkdir toothbrush-tales-gcp && cd toothbrush-tales-gcp

firebase init
# Select:
#   - Firestore
#   - Functions (TypeScript)
#   - Hosting
#   - Storage
#   - Emulators (for local dev)

# Choose region: us-central1 (or us-east1 to match current AWS)
```

### Project structure (target)

```
toothbrush-tales-gcp/
├── firebase.json              # Firebase project config
├── firestore.rules            # Firestore security rules
├── firestore.indexes.json     # Firestore indexes
├── storage.rules              # Cloud Storage security rules
├── functions/                 # Cloud Functions (backend)
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts           # Function exports
│   │   ├── generateStory.ts   # Vertex AI story generation
│   │   └── synthesizeSpeech.ts # Google Cloud TTS
├── src/                       # React frontend (copy from AWS version)
│   ├── main.tsx               # Firebase init (replaces Amplify init)
│   ├── App.tsx                # Router (unchanged)
│   ├── lib/
│   │   └── firebase.ts        # Firebase client config
│   ├── hooks/
│   │   ├── useStoryGeneration.ts  # Updated to call Firebase functions
│   │   └── useTextToSpeech.ts     # Updated to call Firebase functions
│   ├── store/
│   │   └── useAppStore.ts     # Zustand store (unchanged)
│   ├── pages/                 # All pages (minimal changes)
│   └── components/            # All components (unchanged)
├── public/                    # Static assets
├── vite.config.ts             # Vite + PWA config (minor cache rule updates)
└── package.json               # Frontend dependencies
```

---

## 3. Authentication (Firebase Auth)

The current app uses Cognito with **guest (unauthenticated) access** as the primary mode. Firebase Auth supports this natively via anonymous authentication.

### Firebase Auth setup

```typescript
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'your-api-key',
  authDomain: 'toothbrush-tales-gcp.firebaseapp.com',
  projectId: 'toothbrush-tales-gcp',
  storageBucket: 'toothbrush-tales-gcp.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, 'us-central1')
export const storage = getStorage(app)

// Auto sign-in anonymously (equivalent to Cognito guest access)
export async function ensureAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        await signInAnonymously(auth)
      }
      resolve(auth.currentUser)
    })
  })
}
```

### Enable in Firebase Console

1. Go to **Firebase Console > Authentication > Sign-in method**
2. Enable **Anonymous** sign-in
3. (Optional) Enable **Email/Password** if you want registered accounts later

### Key difference from Cognito

| Feature | Cognito | Firebase Auth |
|---------|---------|---------------|
| Guest access | Identity Pool `unauthenticated` role | `signInAnonymously()` - simpler |
| Email sign-up | User Pool with verification | Built-in, fewer config options |
| Token format | JWT (Cognito tokens) | JWT (Firebase ID tokens) |
| Linking accounts | Manual via Cognito API | `linkWithCredential()` built-in |
| Pricing | Free tier: 50k MAU | Free tier: unlimited anonymous, 50k phone |

---

## 4. Database (Cloud Firestore)

Replaces DynamoDB. Firestore is a document database with real-time sync (a feature DynamoDB doesn't have natively).

### Schema mapping

The current app has 3 DynamoDB models. Here's the Firestore equivalent:

```
// Firestore collections

users/{uid}/characters/{characterId}
  ├── name: string
  ├── isDefault: boolean
  ├── usageCount: number
  ├── createdAt: timestamp
  └── updatedAt: timestamp

users/{uid}/stories/{storyId}
  ├── characterName: string
  ├── theme: string
  ├── intro: string
  ├── segments: string[]           // array of 4 strings
  ├── brushingPrompts: string[]    // array of 4 strings
  ├── conclusion: string
  ├── audioUrl: string | null
  ├── isFavorite: boolean
  ├── isFallback: boolean
  ├── playbackCount: number
  ├── createdAt: timestamp
  └── updatedAt: timestamp

users/{uid}/settings/{settingsId}
  ├── voiceId: string
  ├── playbackMode: 'audio' | 'text' | 'both'
  ├── autoPlay: boolean
  └── defaultCharacterName: string | null
```

### Security rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Public read for shared stories (if needed later)
    match /publicStories/{storyId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

### Key difference from DynamoDB

| Feature | DynamoDB | Firestore |
|---------|----------|-----------|
| Query model | Primary key + sort key, GSIs | Collection queries with compound indexes |
| Real-time sync | Streams (complex setup) | Built-in `onSnapshot()` listeners |
| Pricing model | Read/write capacity units (or on-demand) | Per-read/write/delete operation |
| Offline support | Manual (Amplify DataStore) | Built-in with `enablePersistence()` |
| Max document size | 400 KB | 1 MB |

**Note**: The current app stores history in Zustand/localStorage (not DynamoDB). If you want to keep that pattern, Firestore is only needed for server-side story caching and shared data. The Zustand store can remain unchanged.

---

## 5. Cloud Functions (Story Generation + TTS)

### 5a. Story Generation (Vertex AI + Claude)

Replaces the Bedrock Lambda. Claude models are available on Vertex AI via Google's partnership with Anthropic.

#### Enable Vertex AI Claude access

```bash
# Enable the Vertex AI API (already done above)
gcloud services enable aiplatform.googleapis.com

# Claude models on Vertex AI require requesting access:
# Go to: https://console.cloud.google.com/vertex-ai/publishers/anthropic/model-garden
# Click "Enable" for Claude 3 Haiku
# Region: us-east5 (check current availability - Claude on Vertex AI
#         is available in specific regions, commonly us-east5, europe-west1)
```

#### Cloud Function implementation

```typescript
// functions/src/generateStory.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk'

// Vertex AI region where Claude is available
const CLAUDE_REGION = 'us-east5'

const client = new AnthropicVertex({
  region: CLAUDE_REGION,
  projectId: process.env.GCLOUD_PROJECT,
})

interface StoryRequest {
  characterName: string
  theme: string
}

export const generateStory = onCall(
  {
    timeoutSeconds: 60,
    memory: '512MiB',
    region: 'us-central1',
  },
  async (request) => {
    const { characterName, theme } = request.data as StoryRequest

    if (!characterName || !theme) {
      throw new HttpsError('invalid-argument', 'characterName and theme are required')
    }

    // Name parsing for multiple characters (same logic as AWS version)
    const nameList = characterName
      .split(/,\s*|\s+and\s+|\s+&\s+/)
      .map((n: string) => n.trim())
      .filter((n: string) => n.length > 0)
    const isMultipleCharacters = nameList.length > 1

    const characterGuidance = isMultipleCharacters
      ? `MULTIPLE CHARACTERS: The story stars ${nameList.length} characters: ${nameList.join(', ')}. EVERY character must appear by name in EVERY segment.`
      : `Use the character's name frequently (at least 2-3 times per segment).`

    // System + user prompts (same as AWS version - copy from generateStory.ts)
    const systemPrompt = `You are an award-winning children's storyteller...` // (copy full prompt)
    const userPrompt = `Create a toothbrushing adventure story about...`     // (copy full prompt)

    try {
      const response = await client.messages.create({
        model: 'claude-3-haiku@20240307',  // Vertex AI model ID format
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.9,
      })

      const textContent = response.content[0].type === 'text'
        ? response.content[0].text
        : ''

      // Parse JSON (same cleanup logic as AWS version)
      let jsonString = textContent.trim()
      if (jsonString.startsWith('```json')) jsonString = jsonString.slice(7)
      if (jsonString.startsWith('```')) jsonString = jsonString.slice(3)
      if (jsonString.endsWith('```')) jsonString = jsonString.slice(0, -3)

      const storyData = JSON.parse(jsonString.trim())

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
        isFallback: false,
      }
    } catch (error) {
      console.error('[Story] Vertex AI error:', error)
      // Return fallback story (same templates as AWS version)
      return createDynamicFallbackStory(characterName, theme)
    }
  }
)
```

#### Dependencies for functions

```json
// functions/package.json
{
  "dependencies": {
    "@anthropic-ai/vertex-sdk": "^0.4.0",
    "@google-cloud/text-to-speech": "^5.0.0",
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0"
  }
}
```

### 5b. Text-to-Speech (Google Cloud TTS)

Replaces Amazon Polly. Google Cloud TTS offers Neural2 and WaveNet voices (equivalent quality to Polly Neural/Generative).

#### Voice mapping (Polly to Google Cloud TTS)

| Polly Voice | Accent | Google Equivalent | Google Voice Name | Engine |
|------------|--------|-------------------|-------------------|--------|
| Olivia | Australian | en-AU Neural2 | en-AU-Neural2-A (female) | Neural2 |
| Amy | British | en-GB Neural2 | en-GB-Neural2-A (female) | Neural2 |
| Emma | British | en-GB Neural2 | en-GB-Neural2-F (female) | Neural2 |
| Brian | British | en-GB Neural2 | en-GB-Neural2-B (male) | Neural2 |
| Arthur | British | en-GB Neural2 | en-GB-Neural2-D (male) | Neural2 |
| Ivy | American (child) | en-US Studio | en-US-Studio-Q (child-like) | Studio |
| Kevin | American (boy) | en-US Neural2 | en-US-Neural2-I (male) | Neural2 |
| Joanna | American | en-US Neural2 | en-US-Neural2-C (female) | Neural2 |
| Matthew | American | en-US Neural2 | en-US-Neural2-D (male) | Neural2 |
| Ruth | American | en-US Neural2 | en-US-Neural2-E (female) | Neural2 |
| Salli | American | en-US Neural2 | en-US-Neural2-F (female) | Neural2 |
| Joey | American | en-US Neural2 | en-US-Neural2-A (male) | Neural2 |
| Kendra | American | en-US Neural2 | en-US-Neural2-H (female) | Neural2 |
| Kajal | Indian | en-IN Neural2 | en-IN-Neural2-A (female) | Neural2 |

#### Cloud Function implementation

```typescript
// functions/src/synthesizeSpeech.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech'

const ttsClient = new TextToSpeechClient()

const VOICES: Record<string, { name: string; languageCode: string }> = {
  Olivia:  { name: 'en-AU-Neural2-A', languageCode: 'en-AU' },
  Amy:     { name: 'en-GB-Neural2-A', languageCode: 'en-GB' },
  Emma:    { name: 'en-GB-Neural2-F', languageCode: 'en-GB' },
  Brian:   { name: 'en-GB-Neural2-B', languageCode: 'en-GB' },
  Arthur:  { name: 'en-GB-Neural2-D', languageCode: 'en-GB' },
  Ivy:     { name: 'en-US-Studio-Q',  languageCode: 'en-US' },
  Kevin:   { name: 'en-US-Neural2-I', languageCode: 'en-US' },
  Joanna:  { name: 'en-US-Neural2-C', languageCode: 'en-US' },
  Matthew: { name: 'en-US-Neural2-D', languageCode: 'en-US' },
  Ruth:    { name: 'en-US-Neural2-E', languageCode: 'en-US' },
  Salli:   { name: 'en-US-Neural2-F', languageCode: 'en-US' },
  Joey:    { name: 'en-US-Neural2-A', languageCode: 'en-US' },
  Kendra:  { name: 'en-US-Neural2-H', languageCode: 'en-US' },
  Kajal:   { name: 'en-IN-Neural2-A', languageCode: 'en-IN' },
}

const DEFAULT_VOICE = VOICES['Joanna']

export const synthesizeSpeech = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1',
  },
  async (request) => {
    const { text, voiceId = 'Joanna' } = request.data as {
      text: string
      voiceId?: string
    }

    if (!text) {
      throw new HttpsError('invalid-argument', 'text is required')
    }

    const voice = VOICES[voiceId] || DEFAULT_VOICE

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
          speakingRate: 1.0,  // SSML handles rate, keep this at 1.0
        },
      })

      if (!response.audioContent) {
        throw new Error('No audio content returned')
      }

      // Convert to base64 data URL (same format as Polly version)
      const base64Audio = Buffer.from(response.audioContent as Uint8Array).toString('base64')
      return `data:audio/mpeg;base64,${base64Audio}`
    } catch (error) {
      console.error('[TTS] Synthesis error:', error)

      // Fallback to default voice
      if (voiceId !== 'Joanna') {
        console.log('[TTS] Retrying with default voice')
        const [fallbackResponse] = await ttsClient.synthesizeSpeech({
          input: { text },
          voice: { name: DEFAULT_VOICE.name, languageCode: DEFAULT_VOICE.languageCode },
          audioConfig: { audioEncoding: 'MP3' as const, sampleRateHertz: 22050 },
        })

        if (fallbackResponse.audioContent) {
          const base64Audio = Buffer.from(fallbackResponse.audioContent as Uint8Array).toString('base64')
          return `data:audio/mpeg;base64,${base64Audio}`
        }
      }

      throw new HttpsError('internal', 'Failed to synthesize speech')
    }
  }
)
```

#### Export functions

```typescript
// functions/src/index.ts
export { generateStory } from './generateStory'
export { synthesizeSpeech } from './synthesizeSpeech'
```

---

## 6. Storage (Cloud Storage)

Replaces S3. Used for audio file caching (optional, since TTS currently returns inline base64).

### Storage rules

```javascript
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // User-specific audio files
    match /audio/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Public audio assets
    match /public/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

**Note**: The current AWS version returns TTS audio as inline base64 data URLs, so Cloud Storage is only needed if you decide to cache audio files server-side for repeat playback. The same pattern works on GCP.

---

## 7. Frontend Integration

The React frontend needs minimal changes. The main differences are replacing the Amplify client calls with Firebase callable functions.

### Updated dependencies

```json
// package.json - replace AWS SDK with Firebase
{
  "dependencies": {
    "firebase": "^10.12.0",
    "react": "^19.2.3",
    "react-dom": "^19.2.3",
    "react-router-dom": "^7.12.0",
    "zustand": "^5.0.9"
  }
}
```

**Removed** (AWS-specific):
- `aws-amplify`
- `@aws-amplify/ui-react`
- `@aws-sdk/client-bedrock-runtime`
- `@aws-sdk/client-polly`
- `@aws-sdk/client-s3`

### Updated main.tsx

```typescript
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ensureAuth } from './lib/firebase'
import './index.css'

// Ensure anonymous auth before rendering
ensureAuth().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
```

### Updated useStoryGeneration hook

```typescript
// src/hooks/useStoryGeneration.ts
import { useState, useCallback } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'

// ... (Story interface and formatNames - unchanged) ...

export function useStoryGeneration() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const generateStory = useCallback(async (characterName: string, theme: string): Promise<Story> => {
    setIsGenerating(true)
    setError(null)

    try {
      const generateStoryFn = httpsCallable(functions, 'generateStory')
      const result = await generateStoryFn({ characterName, theme })
      return result.data as Story
    } catch (err) {
      console.warn('[StoryGen] API unavailable, using fallback story:', err)
      setError(err instanceof Error ? err : new Error('Story generation unavailable'))
      return createFallbackStory(characterName, theme)
    } finally {
      setIsGenerating(false)
    }
  }, [])

  return { generateStory, isGenerating, error }
}
```

### Updated TTS calls in StoryPage

```typescript
// In StoryPage.tsx, replace the synthesize function:
import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'

const synthesize = useCallback(async (text: string, voiceIdToUse: string): Promise<string | null> => {
  setIsSynthesizing(true)
  setTtsError(null)
  try {
    const synthesizeSpeechFn = httpsCallable(functions, 'synthesizeSpeech')
    const result = await synthesizeSpeechFn({ text, voiceId: voiceIdToUse })
    return result.data as string  // base64 data URL
  } catch (error) {
    console.error('[TTS] Synthesis error:', error)
    setTtsError('Voice narration unavailable')
    return null
  } finally {
    setIsSynthesizing(false)
  }
}, [])
```

### What stays unchanged

These files need **zero changes** for the GCP version:

- `src/App.tsx` (router)
- `src/store/useAppStore.ts` (Zustand store, uses localStorage)
- `src/components/*` (all UI components)
- `src/pages/HistoryPage.tsx`
- `src/pages/SettingsPage.tsx` (update voice names in display only)
- All CSS modules and global styles
- `src/index.css` (theme variables)

---

## 8. PWA & Hosting (Firebase Hosting)

### Firebase Hosting setup

```json
// firebase.json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|svg|png|webp|woff2)",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
        ]
      }
    ]
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

### Vite config changes

```typescript
// vite.config.ts - update cache strategy for Firebase instead of AWS
// Change the runtime caching pattern from amazonaws.com to cloudfunctions.net

runtimeCaching: [
  {
    // Cache Firebase Cloud Functions responses - EXCLUDE callable functions
    // (same rationale as AWS: story/TTS must not be cached)
    urlPattern: /^https:\/\/.*\.cloudfunctions\.net\/.*/i,
    handler: 'NetworkOnly',  // Never cache function responses
  },
  {
    // Google Fonts (unchanged)
    urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
    handler: 'CacheFirst',
    options: { cacheName: 'google-fonts-stylesheets', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
  },
  {
    urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
    handler: 'CacheFirst',
    options: { cacheName: 'google-fonts-webfonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
  },
]
```

### Deploy

```bash
# Build frontend
npm run build

# Deploy everything (hosting + functions + firestore rules + storage rules)
firebase deploy

# Or deploy individually
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

---

## 9. Cost Comparison

### Estimated monthly cost for light usage (~100 stories/month, ~500 TTS calls/month)

| Service | AWS Cost | GCP Cost | Notes |
|---------|----------|----------|-------|
| **AI (story gen)** | Bedrock Claude 3 Haiku: ~$0.50 | Vertex AI Claude 3 Haiku: ~$0.50 | Same model, same pricing (~$0.25/M input, $1.25/M output) |
| **TTS** | Polly Neural: ~$2.00 | Cloud TTS Neural2: ~$2.00 | Both ~$16/M characters for neural voices |
| **Serverless compute** | Lambda: Free tier (1M req/mo) | Cloud Functions: Free tier (2M inv/mo) | GCP free tier is more generous |
| **Database** | DynamoDB on-demand: ~$0.10 | Firestore: ~$0.05 | Minimal at this scale; both effectively free |
| **Storage** | S3: ~$0.02 | Cloud Storage: ~$0.02 | Negligible for audio files |
| **Auth** | Cognito: Free (< 50k MAU) | Firebase Auth: Free (anonymous unlimited) | Firebase is cheaper at scale for anonymous |
| **Hosting** | Amplify: Free tier (5 GB) | Firebase Hosting: Free tier (10 GB) | Firebase free tier is larger |
| **Bandwidth** | CloudFront: ~$0.10 | Firebase CDN: included in hosting | Firebase includes CDN bandwidth in free tier |
| **Total estimate** | **~$2.70/month** | **~$2.55/month** | Roughly equivalent at low volume |

### Free tier comparison

| Resource | AWS Free Tier | GCP Free Tier |
|----------|---------------|---------------|
| Serverless invocations | 1M/month (Lambda) | 2M/month (Cloud Functions) |
| Compute time | 400,000 GB-seconds | 400,000 GB-seconds |
| Database reads | 25 GB storage, 25 WCU/RCU | 50k reads/day, 20k writes/day |
| Storage | 5 GB (S3) | 5 GB (Cloud Storage) |
| Auth users | 50,000 MAU (Cognito) | Unlimited anonymous (Firebase) |
| Hosting bandwidth | 15 GB/month | 10 GB/month (360 MB/day) |
| TTS characters | 1M/month for 12 months (Polly) | 0-4M/month free (Standard), WaveNet 0-1M free |
| AI/LLM | No free tier (Bedrock) | No free tier (Vertex AI) |

### Cost at scale (~10,000 stories/month)

| Service | AWS | GCP |
|---------|-----|-----|
| AI generation | ~$50 | ~$50 |
| TTS | ~$200 | ~$180 |
| Compute | ~$5 | ~$3 |
| Database | ~$2 | ~$3 |
| **Total** | **~$257** | **~$236** |

**Verdict**: Costs are very similar. GCP has a slight edge on compute free tiers and TTS pricing. AWS has a slight edge on database pricing. The AI model costs are identical since both use Claude 3 Haiku from Anthropic.

---

## 10. Key Differences & Gotchas

### Developer experience

| Aspect | AWS Amplify | Firebase |
|--------|-------------|----------|
| **Setup complexity** | Moderate - Amplify Gen2 CLI + CDK | Lower - Firebase CLI is simpler |
| **Local development** | `ampx sandbox` (deploys real AWS resources) | `firebase emulators:start` (fully local) |
| **Type safety** | Strong - Amplify generates TypeScript schema types | Moderate - Firebase callable types are manual |
| **GraphQL** | Built-in (AppSync) | Not built-in - use REST/callable or add Apollo |
| **Deploy speed** | 30-90 seconds (CloudFormation) | 15-30 seconds (direct deploy) |
| **Console/Dashboard** | AWS Console (complex, powerful) | Firebase Console (simpler, less control) |
| **IaC** | CDK (TypeScript) | Firebase config files + optional Terraform |

### Technical gotchas

1. **Vertex AI Claude region availability**: Claude models on Vertex AI are only available in specific regions (e.g., `us-east5`, `europe-west1`). Your Cloud Function can be in `us-central1` but must call Vertex AI in a supported region. Check [current availability](https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude).

2. **Cloud Functions cold starts**: Firebase Cloud Functions (2nd gen) have similar cold-start times to Lambda (~1-3s). Consider setting `minInstances: 1` for the story generation function to keep it warm (adds ~$5/month).

3. **Callable function response size**: Firebase callable functions have a max response size of ~10 MB (vs AppSync 1 MB). The base64 TTS audio is typically 50-200 KB, so this is not an issue, but worth knowing.

4. **No built-in GraphQL**: Firebase does not have a built-in GraphQL API. The callable functions pattern (RPC-style) is simpler and works well for this app since there are only 2 queries. If you want GraphQL, you'd need to add Apollo Server on Cloud Run.

5. **Google Cloud TTS voice names**: Google uses code-based names (`en-US-Neural2-C`) instead of human names (`Joanna`). You'll need to maintain the mapping table and update the Settings page display names.

6. **SSML differences**: Google Cloud TTS SSML is mostly compatible with Polly SSML, but some tags differ. Test the `<prosody>` tag behaviour with each voice.

7. **Firestore vs DynamoDB query patterns**: Firestore requires indexes for compound queries. DynamoDB uses partition/sort keys. If you add complex queries later (e.g., "all stories with theme X"), you'll need to create Firestore indexes.

8. **Firebase Emulators**: Firebase offers a full local emulator suite (auth, firestore, functions, storage, hosting) that runs entirely offline. This is significantly better than Amplify's sandbox which deploys real AWS resources. Great for development and testing.

---

## 11. Migration Checklist

### Phase 1: Project Setup
- [ ] Create GCP project and Firebase project
- [ ] Enable required APIs (Vertex AI, Cloud TTS, Firestore, Cloud Functions)
- [ ] Install Firebase CLI and authenticate
- [ ] Run `firebase init` (Firestore, Functions, Hosting, Storage, Emulators)
- [ ] Request Vertex AI Claude model access

### Phase 2: Backend (Cloud Functions)
- [ ] Create `functions/src/generateStory.ts` with Vertex AI integration
- [ ] Create `functions/src/synthesizeSpeech.ts` with Google Cloud TTS
- [ ] Copy fallback story templates from AWS version
- [ ] Copy name parsing logic (`formatNames`)
- [ ] Export both functions from `functions/src/index.ts`
- [ ] Test with Firebase Emulators locally
- [ ] Deploy functions: `firebase deploy --only functions`

### Phase 3: Database & Storage
- [ ] Write Firestore security rules
- [ ] Write Cloud Storage security rules
- [ ] Deploy rules: `firebase deploy --only firestore:rules,storage:rules`

### Phase 4: Frontend
- [ ] Copy `src/` directory from AWS version
- [ ] Create `src/lib/firebase.ts` (Firebase config + anonymous auth)
- [ ] Update `src/main.tsx` (replace Amplify init with Firebase init)
- [ ] Update `src/hooks/useStoryGeneration.ts` (use `httpsCallable`)
- [ ] Update `src/pages/StoryPage.tsx` synthesize function (use `httpsCallable`)
- [ ] Update `src/pages/SettingsPage.tsx` (update voice display names, keep original IDs)
- [ ] Update `package.json` (replace AWS deps with Firebase)
- [ ] Update `vite.config.ts` (PWA cache rules for Firebase domains)
- [ ] Remove `amplify/` directory and `amplify_outputs.json`
- [ ] Test locally with `firebase emulators:start` + `npm run dev`

### Phase 5: Hosting & Deploy
- [ ] Configure `firebase.json` for hosting
- [ ] Build frontend: `npm run build`
- [ ] Deploy everything: `firebase deploy`
- [ ] Test end-to-end on deployed URL
- [ ] Set up custom domain (optional)

### Phase 6: Compare & Evaluate
- [ ] Compare setup time (AWS vs GCP)
- [ ] Compare deploy speed
- [ ] Compare local development experience (sandbox vs emulators)
- [ ] Compare TTS voice quality (Polly vs Google Cloud TTS)
- [ ] Compare AI story quality (same model, different API wrapper)
- [ ] Compare cold-start latency
- [ ] Monitor costs for 1 month
- [ ] Document findings

---

## Quick Start (TL;DR)

```bash
# 1. Create project
gcloud projects create toothbrush-tales-gcp
firebase init  # select Firestore, Functions, Hosting, Storage

# 2. Enable APIs
gcloud services enable aiplatform.googleapis.com texttospeech.googleapis.com

# 3. Write functions (see Section 5)
cd functions && npm install && cd ..

# 4. Copy frontend from AWS version, update 3 files:
#    - src/lib/firebase.ts (new)
#    - src/main.tsx (replace Amplify with Firebase)
#    - src/hooks/useStoryGeneration.ts (httpsCallable instead of Amplify client)

# 5. Deploy
npm run build && firebase deploy

# 6. Test
firebase open hosting:site
```
