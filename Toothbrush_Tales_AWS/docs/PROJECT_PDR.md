# Toothbrush Tales AWS PDR

## 1. Scope
- Maintain AWS feature parity with GCP user-facing behavior while keeping AWS-native backend.
- In scope: story generation flow, TTS flow, telemetry dashboard, settings and history UX.
- Out of scope: Firebase infrastructure migration, multi-device cloud sync, rewards system.

## 2. Acceptance Criteria
- Story generation supports loading, timeout fallback, and error recovery.
- TTS supports loading, timeout, playback error fallback.
- Session flow supports start/pause/resume/stop/complete and records telemetry events.
- Backgrounding app for >5s during brushing auto-pauses session.
- Telemetry dashboard shows event counts, ratios, and funnel metrics.

## 3. Edge/Failure States
- Network/API timeout: fallback story or voice error banner.
- Null/invalid AI payload: defaults applied before frontend/backend output use.
- Audio playback failure: non-blocking error banner + text flow continues.
- Empty telemetry: explicit empty-state message.

## 4. Telemetry Events
- `story_generate_start`
- `story_generate_success`
- `story_generate_fallback`
- `session_start`
- `session_pause`
- `session_resume`
- `session_stop`
- `session_complete`

## 5. Performance Notes
- Timer uses monotonic clock + `requestAnimationFrame` path.
- Current build size is above strict 250KB goal; optimization backlog remains open.

## 6. Security/Secrets
- No API secrets in frontend source.
- AWS IAM-managed backend access for Bedrock/Polly.

## 7. Risks & Mitigations
- Risk: provider drift between AWS and GCP.
- Mitigation: tracked divergences in `docs/AWS_GCP_DIVERGENCES.md`.
- Risk: browser background throttling impacting sessions.
- Mitigation: explicit auto-pause policy after 5s hidden.

## 8. Caching Strategy
- Local state in Zustand persistence for story history/favorites.
- Telemetry cached in localStorage (latest 1000 events).
- Story and TTS network calls are on-demand with timeout and fallback handling.

