# Toothbrush Tales (GCP/Firebase)

AI-powered toothbrushing stories for kids, built with React + Firebase + Google Cloud.

## Project Structure

- `src/`: React + TypeScript frontend (Vite)
- `functions/src/`: Firebase Cloud Functions for story generation and TTS
- `public/`: static assets + PWA icons
- `firebase.json`, `firestore.rules`, `storage.rules`: Firebase config and security rules

## Architecture (Request Pattern)

The app uses Firestore-triggered background jobs:

1. Frontend writes `storyRequests/{id}` with `status: "pending"`.
2. `onStoryRequest` generates story content with Vertex AI and updates doc to:
   - `status: "complete"` (story fields present), or
   - `status: "error"` (terminal error message).
3. Frontend listens to that request doc and renders the result.

TTS uses the same pattern with `ttsRequests/{id}` and `onTTSRequest`.

## Prerequisites

- Node.js 20+ recommended
- Firebase CLI (`firebase-tools`)
- A Firebase project with Firestore, Storage, Functions, and Vertex AI APIs enabled

## Environment Setup

Copy `.env.example` to `.env` and fill in your Firebase Web config:

```bash
cp .env.example .env
```

Required frontend vars are documented in `.env.example`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_FUNCTIONS_REGION` (default `us-central1`)

Backend story generation reads GCP project context from Cloud Functions runtime (`GCLOUD_PROJECT` / optional `VERTEX_PROJECT_ID` and `VERTEX_LOCATION`).

## Local Development

From this directory:

```bash
npm run dev
```

Functions build:

```bash
cd functions && npm run build
```

Run Firebase emulators:

```bash
firebase emulators:start
```

## Validation Before Handoff

Run both builds:

```bash
npm run build
cd functions && npm run build
```

## Deploy

Deploy hosting + functions:

```bash
firebase deploy --project <firebase-project-id> --only hosting,functions
```

Deploy only story function:

```bash
firebase deploy --project <firebase-project-id> --only functions:onStoryRequest
```

## Operations

- Story function logs:
  - `firebase functions:log --project <firebase-project-id> --only onStoryRequest -n 100`
- TTS function logs:
  - `firebase functions:log --project <firebase-project-id> --only onTTSRequest -n 100`

For common issues (fallback stories, auth errors, deploy problems), see `docs/TROUBLESHOOTING.md`.

## Notes

- Frontend intentionally falls back to a built-in story if generation errors or times out.
- Keep Cloud Function handlers writing terminal request state (`complete` or `error`) on every path.
- Never commit secrets to git; use Firebase/GCP config and secret management.
