# Compliance Matrix

Legend: Pass / Partial / Fail / N-A

## AGENTS.md Session Enforcement Checklist

| Item | Status | Evidence | Gap Closure |
|---|---|---|---|
| Define scope + acceptance criteria + edge states | Pass | `docs/PROJECT_PDR.md` | Added explicit scope/acceptance/edge-state sections |
| Explicit loading/empty/error/timeout/success UX states | Pass | `src/pages/HomePage.tsx`, `src/pages/StoryPage.tsx`, `src/pages/TelemetryPage.tsx` | Added loading info banner, timeout fallbacks, empty telemetry state |
| Mobile-first + touch targets >=44 + WCAG AA | Partial | `src/components/story/PlaybackControls.module.css`, `src/components/layout/Header.module.css`, `src/index.css` | Touch targets and focus-visible improved; full contrast audit still manual |
| Respect reduced motion | Pass | `src/index.css` + component-level media queries | Added global and component `prefers-reduced-motion` handling |
| GCP flow: Firestore pending->complete|error | N-A | AWS codebase scope | Documented divergence |
| Cloud Function outer try/catch terminal status | N-A | AWS Lambda handlers | AWS handlers use structured try/catch and fallback/throw behavior |
| Validate/default AI outputs before Firestore writes | N-A | AWS scope | Equivalent output validation implemented in AWS story handler |
| Retries/timeouts for external calls + fallbacks | Pass | `amplify/data/generateStory.ts`, `amplify/data/synthesizeSpeech.ts`, `src/hooks/useStoryGeneration.ts`, `src/pages/SettingsPage.tsx` | Added retries/timeouts and safe fallbacks |
| Structured contextual logs | Pass | `[Story]` and `[Polly]` logs in AWS handlers | Maintained contextual logging |
| No secrets committed | Pass | repo scan + IAM architecture | Regex scan found no plaintext keys |
| Least privilege IAM assumptions | Pass | `amplify/backend.ts` model allowlist | Scoped Bedrock permissions retained |
| AWS vs GCP parity + intentional divergence notes | Pass | `docs/AWS_GCP_DIVERGENCES.md` | Added divergence tracking file |
| Run validation commands before handoff | Pass | `npm.cmd run build`, `npx.cmd tsc -p amplify/tsconfig.json --noEmit` | Frontend and Amplify TS validated |
| Keep commits scoped + PR verification steps | Partial | process-level | Documented in matrix/PDR; commit/PR workflow not executed in this chat |

## rules.md (Universal)

| Rule Area | Status | Evidence |
|---|---|---|
| PDR clarity and structure | Pass | `docs/PROJECT_PDR.md` |
| UX states + accessibility + motion guidance | Partial | Implemented states and reduced motion; full keyboard/contrast walkthrough still pending manual run |
| Functional requirement metadata (purpose/interaction/system/acceptance) | Pass | `docs/PROJECT_PDR.md` |
| Telemetry events per feature | Pass | telemetry events in code + `docs/PROJECT_PDR.md` |
| Data/state validation and caching notes | Pass | validation in story/TTS + caching notes in `docs/PROJECT_PDR.md` |
| Performance budgets in CI | Pass | initial chunk now 235.72 kB (below 250 kB target) after lazy loading/deferred Amplify |
| Edge case inventory | Pass | `docs/PROJECT_PDR.md` edge/failure section |
| Risks/assumptions with mitigations | Pass | `docs/PROJECT_PDR.md`, `docs/AWS_GCP_DIVERGENCES.md` |
| Phased roadmap with exit criteria | Pass | phases + criteria documented in current session artifacts |

## rules-AWS+GCP.md (AWS Baseline)

| Rule Area | Status | Evidence |
|---|---|---|
| IaC-first/no console drift | Pass | Amplify backend as code under `amplify/` |
| Observability baseline | Pass | structured logs + telemetry dashboard + CloudWatch alarms in `amplify/backend.ts` + `docs/OBSERVABILITY_RUNBOOK.md` |
| Retry policies | Pass | Polly and Bedrock retry/timeout logic |
| Edge failure handling | Pass | app-level and backend-level timeout/fallback coverage |

## rules-toothbrush-tales.md (Product PDR)

| Functional Area | Status | Evidence |
|---|---|---|
| FR-02 Timer accuracy + pause/resume | Pass | monotonic timer in `src/components/timer/BrushTimer.tsx` + pause controls |
| Background >5s auto-pause policy | Pass | visibility pause logic in `src/pages/StoryPage.tsx` |
| FR-04 Sounds/voice cues with fallback | Pass | Story/TTS timeout+error handling |
| FR-05 Completion and results behavior | Pass | complete phase + telemetry + replay |
| Reduce motion mode | Pass | global/component motion disable rules |
| Keyboard/touch/accessibility | Partial | labels/focus/touch targets improved; full WCAG verification remains manual |
| Performance budget enforcement | Pass | main entry chunk reduced below 250k threshold |

## Remaining Gaps

1. Manual WCAG AA verification pass
- Requires browser-based contrast + keyboard-only audit execution.

2. PR process-only checklist items
- Commit scoping/PR evidence are repository workflow tasks outside this interactive session.
