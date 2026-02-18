# Repository Guidelines

## Project Structure & Module Organization
This repository contains two app variants:
- `Toothbrush_Tales_GCP/`: active Firebase + GCP implementation (primary codebase).
- `Toothbrush_Tales_AWS/`: legacy AWS version kept for reference/migration context.

In `Toothbrush_Tales_GCP/`:
- `src/`: React + TypeScript frontend (`components/`, `pages/`, `hooks/`, `store/`, `lib/`).
- `functions/src/`: Firebase Cloud Functions (story generation + TTS).
- `public/`: static assets and PWA icons.
- `scripts/`: utility scripts (for example icon generation).
- Firebase config files live at project root (`firebase.json`, `firestore.rules`, `storage.rules`).

## Session Enforcement Checklist
Apply this checklist on every task in this repo.

- [ ] Define scope and acceptance criteria before coding; include failure/edge states.
- [ ] Keep critical UX explicit: loading, empty, error, timeout, and success states.
- [ ] Maintain mobile-first usability (touch targets >= 44px) and WCAG AA contrast.
- [ ] Respect reduced-motion settings; disable non-essential animation when requested.
- [ ] For GCP backend flows, prefer Firestore-triggered request docs: `pending -> complete|error`.
- [ ] Wrap Cloud Function handlers in outer `try/catch` and always write terminal status.
- [ ] Validate and default AI/service outputs before Firestore writes (never write `undefined`).
- [ ] Use retries/timeouts for external calls (Gemini/TTS) and add reliable fallbacks.
- [ ] Keep logs structured and contextual (for example `[Story]`, `[TTS]`), with actionable errors.
- [ ] Do not commit secrets; use Firebase/GCP config and secret management patterns.
- [ ] Preserve least-privilege assumptions for IAM/service accounts when changing infra.
- [ ] For AWS vs GCP comparisons, keep behavior parity and note intentional divergences.
- [ ] Run required validation commands before handoff (`npm run build`, `cd functions && npm run build`).
- [ ] Keep commits scoped to one concern and document verification steps in PRs.

## Build, Test, and Development Commands
Run commands from `Toothbrush_Tales_GCP/` unless noted.

- `npm run dev`: start Vite dev server for frontend.
- `npm run build`: type-check and build frontend (`tsc -b && vite build`).
- `npm run preview`: serve built frontend locally.
- `cd functions && npm run build`: compile Cloud Functions TypeScript.
- `cd functions && npm run serve`: run Functions emulator.
- `firebase emulators:start`: run local Firebase emulators (from GCP root).

## Coding Style & Naming Conventions
- Language: TypeScript for frontend and functions.
- Indentation: 2 spaces; prefer semicolon-free style matching existing files.
- React components/pages: `PascalCase` filenames (`StoryPage.tsx`, `BrushTimer.tsx`).
- Hooks: `use*` naming (`useStoryGeneration.ts`, `useTextToSpeech.ts`).
- CSS Modules: colocated `*.module.css` per component/page.
- Keep functions small and explicit; log failures with context (for example `[TTS] ...`).

## Testing Guidelines
There is currently no formal unit test suite. Validate changes with:
- `npm run build` (frontend type/build check).
- `cd functions && npm run build` (functions type check).
- Manual end-to-end checks in emulators for story generation and TTS flows.

When adding tests, prefer colocated `*.test.ts` / `*.test.tsx` and keep scope focused on hooks, stores, and utility logic.

## Commit & Pull Request Guidelines
- Use concise, imperative commit messages (current history style: `Fix ...`, `Improve ...`, `Switch ...`).
- Keep commits scoped to one concern (for example TTS reliability only).
- PRs should include:
  - clear summary of behavior change,
  - affected paths (e.g., `functions/src/synthesizeSpeech.ts`),
  - validation steps run,
  - screenshots/video for UI-impacting changes.
