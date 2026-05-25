# Contributing

This project uses the GCP/Firebase implementation in `Toothbrush_Tales_GCP` as the active codebase.

## Scope Before Code

Before implementing changes:

1. Define scope and acceptance criteria.
2. List expected edge/failure states:
   - loading
   - empty
   - error
   - timeout
   - success

## Engineering Standards

1. Keep mobile-first UX (touch targets >= 44px, WCAG AA contrast).
2. Respect reduced-motion preferences for non-essential animation.
3. For backend flows, prefer Firestore request docs with terminal status:
   - `pending -> complete|error`
4. Wrap Cloud Function handlers with outer `try/catch`.
5. Always write a terminal state (`complete` or `error`) to the request doc.
6. Validate and default external AI/service outputs before Firestore writes.
7. Use retries/timeouts for Gemini/TTS calls with reliable fallbacks.
8. Keep logs structured and contextual (for example `[Story]`, `[TTS]`).
9. Do not commit secrets; use Firebase/GCP config and secret management.
10. Preserve least-privilege assumptions when changing IAM/infra.

## Build And Validation

Run both checks before handoff:

```bash
npm run build
cd functions && npm run build
```

Recommended manual checks:

1. Generate a custom story end-to-end.
2. Verify fallback behavior on forced failure/timeout.
3. Verify TTS request flow and playback behavior.

## Commit Guidelines

1. Keep commits scoped to one concern.
2. Use concise, imperative commit messages (for example `Fix ...`, `Improve ...`).
3. Avoid mixing docs, UI, and backend behavior changes in one commit unless tightly coupled.

## Pull Request Checklist

Include:

1. Clear summary of behavior change.
2. Affected paths (for example `functions/src/generateStory.ts`).
3. Validation commands run and outcomes.
4. Screenshots/video for UI-impacting changes.
5. Notes on AWS vs GCP parity if behavior diverges intentionally.
