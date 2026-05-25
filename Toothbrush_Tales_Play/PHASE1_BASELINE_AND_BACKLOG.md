# Phase 1 Baseline And Prioritized Backlog

## Scope
This baseline focuses on the active GCP app (`Toothbrush_Tales_GCP`) and applies the Skills/PDR priorities: reliability first, explicit failure states, measurable outcomes, and AWS/GCP comparison readiness.

## Baseline Snapshot (Current State)
1. Timer implementation uses `setInterval(1000)` in `src/components/timer/BrushTimer.tsx:67` (no monotonic drift correction).
2. Pause/resume controls do not pause the brushing timer yet; `BrushTimer` is always passed `isPaused={false}` in `src/pages/StoryPage.tsx:611`.
3. Firestore-triggered request pattern is in place for story and TTS (`pending -> complete|error`) in:
   - `src/hooks/useStoryGeneration.ts:75`
   - `src/pages/StoryPage.tsx:102`
   - `functions/src/generateStory.ts:277`
   - `functions/src/synthesizeSpeech.ts:126`
4. TTS reliability has retries/fallback voices on backend (`functions/src/synthesizeSpeech.ts`) and client timeouts in Story/Settings pages.
5. Analytics instrumentation is not implemented yet (no `firebase/analytics` usage; only `measurementId` in `src/lib/firebase.ts:14`).
6. Automated tests are not present (build/type-check scripts only in `package.json` and `functions/package.json`).

## KPI Targets (From PDR)
1. Timer drift: `<250ms` over a 2-minute session.
2. App interactive load: `<2.5s` on mid-tier mobile.
3. Crash-free sessions: `>99.5%`.
4. TTS success rate: `>=99%` for available network sessions.
5. Core flow coverage: target `>=70%` of critical paths.

## Prioritized Backlog
## P0 (Do First)
1. Timer accuracy hardening: migrate countdown to `performance.now()` delta model with drift correction.
2. Session integrity: wire pause/resume/stop to timer state (not audio-only controls).
3. Event schema + instrumentation: add `session_start`, `pause`, `resume`, `complete`, `stop`, `tts_request`, `tts_success`, `tts_error`, `story_fallback`.
4. Structured function logs: include `requestId`, duration, voice/model, retry count, and terminal status.

## P1 (Next)
1. Add offline/timeout UX states for story/TTS with clear recovery actions.
2. Add emulator integration checks for story + TTS request lifecycle.
3. Add timer unit tests for drift, segment boundaries, and background resume behavior.
4. Accessibility pass: focus order, labels for controls, reduced-motion verification.

## P2 (Comparison + Optimization)
1. Add AWS vs GCP parity checklist (same KPIs, same event names, same test scenarios).
2. Build lightweight performance regression gate in CI (build + timing smoke checks).
3. Add alert thresholds for TTS error rate and function latency spikes.

## Execution Order
1. Implement P0.1 and P0.2 together (timer/state model refactor).
2. Add instrumentation (P0.3, P0.4), then capture the first real KPI baseline report.
3. Move to P1 testing and UX hardening once baseline data is flowing.
