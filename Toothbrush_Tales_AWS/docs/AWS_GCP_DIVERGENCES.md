# AWS vs GCP Divergences

This file tracks intentional behavior differences between `Toothbrush_Tales_AWS` and `Toothbrush_Tales_GCP`.

## Active Divergences

1. Backend invocation model
- AWS: direct Amplify custom queries (`generateStory`, `synthesizeSpeech`).
- GCP: Firestore-triggered request documents (`pending -> complete|error`).
- Reason: provider-specific architecture.

2. Telemetry persistence
- AWS: local telemetry in `localStorage` (`src/lib/telemetry.ts`).
- GCP: Firestore per-user telemetry collection.
- Reason: keep AWS parity without introducing Firebase dependency.

3. LLM provider
- AWS: Bedrock Claude Sonnet 3.7 (`anthropic.claude-3-7-sonnet-20250219-v1:0`).
- GCP: Gemini flow in Firebase functions.
- Reason: cloud-native model strategy per provider.

4. TTS provider
- AWS: Amazon Polly.
- GCP: Google Cloud TTS.
- Reason: cloud-native service usage and IAM model.

## Parity Guarantees

Despite provider differences, the app targets parity for:
- Story flow phases (`waiting -> intro -> brushing -> complete`).
- Timeout/fallback behavior for story/TTS requests.
- Session controls (pause/resume/stop/complete).
- Telemetry event names used by dashboard (`session_start`, `session_pause`, `session_resume`, `session_stop`, `session_complete`).
