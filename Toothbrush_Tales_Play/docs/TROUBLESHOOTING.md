# Troubleshooting Guide

This guide focuses on the most common production issues in `Toothbrush_Tales_GCP`.

## 1. App Shows Fallback Story Banner

Symptom:
- Story page shows fallback message.
- Story is generic/default rather than custom theme output.

What it means:
- Frontend did not receive a successful custom story in time.
- Request either timed out, errored, or function returned fallback content.

Check logs:

```bash
firebase functions:log --project <firebase-project-id> --only onStoryRequest -n 150
```

Look for:
- `[Story] Successfully parsed story JSON` (good sign)
- `[Story] Using dynamic fallback ...` (fallback path taken)
- `[Story] Error generating story from Gemini ...` (root error before fallback)

Common causes:
1. Vertex/Gemini returned malformed JSON.
2. Vertex API transient failure or quota/rate issue.
3. Function timeout or cold start delay causing client timeout.

Firestore request verification:
1. Find the request doc under `storyRequests`.
2. Confirm terminal state:
   - `status: complete` with `isFallback: false` for custom story success.
   - `status: complete` with `isFallback: true` means server fallback.
   - `status: error` indicates terminal failure.

## 2. Story Requests Never Complete

Symptom:
- Frontend spinner runs then fallback appears.
- No function logs for recent request.

Checks:
1. Confirm Firestore request docs are being created (`storyRequests/*`).
2. Confirm Firebase Auth is active (anonymous auth expected).
3. Verify Firestore rules permit authenticated `create/read` on `storyRequests`.
4. Confirm function is deployed in expected region (`us-central1`).

Useful commands:

```bash
firebase deploy --project <firebase-project-id> --only functions:onStoryRequest
firebase functions:log --project <firebase-project-id> --only onStoryRequest -n 100
```

## 3. Firebase CLI Auth Errors

Symptom:
- `Authentication Error: Your credentials are no longer valid`.

Fix:

```bash
firebase login --reauth
```

Then rerun the command.

## 4. Deploy Fails With Generic "An unexpected error has occurred"

On restricted Windows shells, this can happen due to local permission/spawn issues.

Checks:
1. Inspect local `firebase-debug.log` in repo root.
2. Look for `EPERM`, `spawn`, or configstore write errors.
3. Rerun deploy from a shell with sufficient permissions.

## 5. Vertex/Gemini Quality or Reliability Regression

Symptoms:
- Frequent fallback usage.
- Story shape valid but weak content quality.

Actions:
1. Review `functions/src/storyPrompts.ts` prompt constraints.
2. Review `functions/src/generateStory.ts` for JSON handling, retries, and fallback logic.
3. Deploy only story function after changes:

```bash
cd functions && npm run build
cd ..
firebase deploy --project <firebase-project-id> --only functions:onStoryRequest
```

## 6. TTS Failures

Symptom:
- Story text works but audio fails/intermittent.

Checks:
1. Tail `onTTSRequest` logs:

```bash
firebase functions:log --project <firebase-project-id> --only onTTSRequest -n 150
```

2. Verify terminal status in `ttsRequests`.
3. Confirm fallback voice logic still present in `functions/src/synthesizeSpeech.ts`.

## 7. Minimum Handoff Verification

Before merging or deploying:

```bash
npm run build
cd functions && npm run build
```

After deploy:
1. Generate one custom story and confirm no fallback banner.
2. Verify logs for latest request show successful completion.
