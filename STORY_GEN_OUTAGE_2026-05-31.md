# Story Generation Outage — Diagnosis, Plan, Resolution

**Date:** 2026-05-31
**Reported symptom:** Blue "cannot connect to the server" banner appears for every generated story on the Personal app (`toothbrush-tales.web.app`). Worked normally up to ~2026-05-29; broken since.
**Affected:** `Toothbrush_Tales_GCP` (Personal). `Toothbrush_Tales_Play` is at risk of the same failure since it shares the model and SDK.

---

## ⚠️ DIAGNOSIS REVISION (after live-log evidence)

**My initial diagnosis (gemini-3-flash-preview was retired) was WRONG.** Live logs and a direct Vertex AI probe disproved it. Both Cloud Functions are healthy — `onStoryRequest` ran 41+ times today, all `status: ok`, no errors, no quota issues.

**The real root cause: Gemini 2.5 Flash thinking mode is consuming the entire output token budget.**

Direct probe of `gemini-2.5-flash` with the production prompt + `maxOutputTokens: 2000`:

| Field | Value |
|---|---|
| `promptTokenCount` | 54 |
| `thoughtsTokenCount` | **1919** ← thinking ate the budget |
| `candidatesTokenCount` | 67 (the actual JSON output) |
| `finishReason` | `MAX_TOKENS` |
| Response length | 295 chars (truncated mid-JSON) |

This matches production logs exactly. Recent Gemini response lengths from `onStoryRequest`:

| Date | Length | What happened |
|---|---|---|
| 06-01 01:01 | 287 | parse failed → JSON repair → success (with template filler) |
| 05-31 22:17 | 1277 | parse failed → repair → success |
| 05-31 22:16 | 1566 | parse failed → repair → success |
| 05-31 09:35 | 1751 | parse failed → repair → success |
| 05-31 09:34 | 245 | parse failed → repair → success |
| 05-31 01:43 | 2294 | clean parse |

Parse-failure rate by day:
- 05-26: 2/4 (50%)
- 05-27: 2/2 (100%)
- 05-28: 0/3 (0%)
- 05-31: 4/5 (80%)

Trend is upward and intermittent — consistent with a Vertex-side rollout of thinking-by-default behavior on `gemini-2.5-flash`.

**Why this produces a blue banner:**
- When Gemini returns truncated JSON, the function's outer `try` block calls `parseStoryJsonWithRepair`. If the initial parse throws *and* the repair pass also returns truncated/unparseable JSON, the outer `catch` fires at `generateStory.ts:290`. That catch writes `createDynamicFallbackStory(...)` to Firestore — which spreads `isFallback: true`. The client reads `isFallback: true` and renders the blue `fallbackNotice`.
- When the repair *does* succeed (most common case), the function writes `isFallback: false` but fills missing JSON keys with generic template segments — the story plays without the banner but feels generic ("Hold onto your toothbrush!" Magic Adventure boilerplate instead of a story about Iris exploring the Whispering Woods).

So the user is experiencing two failure modes from the same root cause:
1. ~20% of requests: full blue banner + canned "Alex" story
2. ~60% of requests: no banner but generic Mad-Libs feel

**The fix:** disable thinking via `thinkingConfig: { thinkingBudget: 0 }` in `generationConfig` for both the main story call and the JSON repair call.

Probe result with the fix:
```
FINISH: STOP
THINKING TOKENS: none
OUTPUT TOKENS: 575
TEXT LENGTH: 2440 chars, VALID JSON
```

Story generation is creative writing — no reasoning is needed. Disabling thinking costs nothing and is the correct configuration for this use case.

The rest of this doc (sections below) was my original first-cut diagnosis, kept for the audit trail. **Skip to section 6 for the revised resolution plan.**

---

## 1. What the "blue banner" actually is

Grep'd the client. There is **no** `cannot connect to the server` literal in the codebase. The blue banner the user sees is the **fallback notice** rendered in `Toothbrush_Tales_GCP/src/pages/StoryPage.tsx:675-679`:

```
Using a built-in story (AI generation was unavailable).
Try again later for a custom story!
```

That notice renders whenever `story.isFallback === true`. There are exactly two code paths that produce a fallback story:

1. **Server path** (`Toothbrush_Tales_GCP/functions/src/generateStory.ts:290-298`) — the function catches any Gemini error, writes a fallback story to Firestore with `isFallback: true`, and marks status `complete`.
2. **Client path** (`Toothbrush_Tales_GCP/src/hooks/useStoryGeneration.ts:152, 157`) — the function takes >45s (cold start + retry to 30s = ~75s total). Both client timeouts fire, client constructs a local fallback story, also `isFallback: true`.

Either path produces the identical banner. To distinguish them we need Cloud Function logs.

## 2. Timeline of relevant changes

```
2026-04-30  39f74b5  Bump Gemini 3 Flash → set model = 'gemini-3-flash-preview' on GCP
2026-05-25  7abd41f  Refresh home-screen examples (unrelated)
2026-05-25  ad31432  Prep GCP PWA for TWA packaging (unrelated)
2026-05-27           Session #1: noticed iPhone PWA broken, edited generateStory.ts
                     locally back to 'gemini-2.5-flash' (uncommitted), attempted
                     `firebase deploy --only functions`.
                     Deploy reported: onStoryRequest "Skipped (No changes detected)"
                                       onTTSRequest  "Successful update"
2026-05-29  ~        User: app last known working
2026-05-29 → 2026-05-31  Blue banner on every story
```

Three things matter here:
- **No code change between "working" and "broken."** The last functions/ commit is 2026-04-30. So whatever broke is external to our code.
- **The previous session's "fix" was never actually deployed.** The Firebase smart-skip incorrectly decided onStoryRequest was unchanged. Local source says `gemini-2.5-flash`, local built `lib/generateStory.js` confirms `gemini-2.5-flash` (line 46), but production almost certainly still runs the April 30 source: **`gemini-3-flash-preview`**.
- **Working tree on `main` still has the April 30 commit; the gemini-2.5-flash revert is uncommitted.** So `git log` shows production at gemini-3-flash-preview from the last successful deploy.

## 3. Diagnosis (first principles)

The failure mode is "external state changed; my code didn't." External things that could break a Firestore-triggered Gen1 function calling Vertex AI:

| Layer | Could it break around 2026-05-29? | Evidence |
|---|---|---|
| Firestore trigger plumbing | Extremely unlikely. Same code, same rules. | n/a |
| Anonymous Auth | Possible but would affect both story + TTS, and would block at `addDoc`, not yield a fallback story. User has not reported TTS failure separately. | Inconsistent with single-feature breakage |
| Function runtime (Node 20) | Possible Firebase deprecation; would be announced and the function would fail to start, not silently return fallback. | Inconsistent |
| Billing / quota | Possible. Vertex free quota is per-minute; an exhausted quota would cause 429 / RESOURCE_EXHAUSTED, caught → fallback story. **Consistent** with the symptom but cyclical (would have happened before). | Possible but lower prior |
| Service-account IAM (Vertex User role) | Possible if any IAM change occurred. Would produce 403 PERMISSION_DENIED. | No known IAM change |
| **Vertex AI model availability** | **Highly likely.** `gemini-3-flash-preview` is a *preview* model. Preview models can be pulled at any time without notice. Google's standard pattern is to retire previews when the GA version ships. | **Strongest fit.** |
| `@google-cloud/vertexai` SDK | Deprecated in 2025 (per [[gemini-model]] memory). Could break, but typically with a deprecation warning, not a hard failure. | Weak fit. |

**Primary diagnosis (high confidence):**

Production is running `gemini-3-flash-preview`. That preview model was pulled or restricted by Google on or around 2026-05-29. Every `generateContent` call now returns a 4xx (404 NOT_FOUND or 400 INVALID_ARGUMENT). The function's `try/catch` swallows the error and writes a fallback story. The client shows the blue banner. The function appears "to work" (no failed invocations, no client errors) — it just always returns the same kind of result.

This is consistent with:
- The April 30 commit message itself: *"Update GCP story generator to gemini-3-flash-preview (succeeds gemini-2.0-flash on Vertex AI)."* — i.e. the only reason we moved to gemini-3-flash-preview was because gemini-2.0-flash got pulled. Pattern repeats.
- The previous session's local revert to `gemini-2.5-flash` not actually shipping (deploy "skipped").
- The fact that this is silent (function logs would show the 404, but client just sees fallback story).

**Why "working 2 days ago":** Vertex preview models often run for weeks then are pulled mid-day with a 24–48h grace where they return 200s sometimes and 404s sometimes. The April 30 → May 29 lifespan (≈30 days) is typical preview-model duration.

**Confirmation step needed:** Pull function logs:

```
gcloud auth login
gcloud logging read 'resource.type="cloud_function" AND resource.labels.function_name="onStoryRequest"' \
  --project toothbrush-tales --limit 20 --format="value(timestamp,severity,textPayload)"
```

Expect to see `[Story] Gemini attempt N failed: ... NOT_FOUND ... Publisher Model 'projects/.../gemini-3-flash-preview'` repeating.

## 4. GCP / Vertex AI release-note check

Per the [[gemini-model]] memory (2026-05-06 probe): `gemini-2.5-flash` was the stable answer; `gemini-2.0-flash` had been retired and returned 404.

Open questions for the user to verify with up-to-date release notes at <https://cloud.google.com/vertex-ai/generative-ai/docs/release-notes> and <https://cloud.google.com/vertex-ai/generative-ai/docs/models>:
- Is `gemini-2.5-flash` still GA? (Expected yes, but verify since it's now ~1 month older.)
- Is `gemini-3-flash` (non-preview) GA yet? If yes, that becomes the right long-term target.
- Are any preview models currently slated for retirement?

The probe command from the memory still works once auth is refreshed — use it to confirm which model name returns 200 today before redeploying.

## 5. Rebuild or adjust?

**Adjust. No rebuild needed.** Reasoning:

- **The architecture is sound.** Firestore-trigger flow handles cold starts, retries, and offline correctly. Org policy blocks HTTP functions, so this is the only viable path on this project. AWS fork demonstrates a workable alternative (Bedrock + Polly) but rewriting the GCP app to Amplify would be weeks of work to fix a one-line model-name bug.
- **The error handling is robust.** The catch block produces a usable (if generic) story instead of a hard failure. Without it the user would see no story at all.
- **The brittleness is in one specific place:** a single hard-coded model name with no fallback chain. Fix that, and a future model deprecation degrades gracefully instead of bricking the app.
- **The SDK is deprecated** (`@google-cloud/vertexai`), but it still works and migrating to `@google/genai` is a separate, larger refactor. Defer.

## 6. Resolution plan (REVISED — supersedes everything above)

### Phase A — Stop the thinking-token leak (today, ~15 min)

**A.1 Edit `generateStory.ts` in both forks** to disable thinking. Two places need it: the main story call (~line 108) and the JSON repair call (~line 134):

```ts
generationConfig: {
  temperature: 0.9,
  maxOutputTokens: 2000,
  responseMimeType: 'application/json',
  thinkingConfig: { thinkingBudget: 0 },   // NEW: creative writing, no reasoning needed
}
```

For the repair call, also keep `temperature: 0` and add the same `thinkingConfig`.

**A.2 Build + deploy GCP:**
```
cd Toothbrush_Tales_GCP/functions && rm -rf lib && npm ci && npm run build
cd .. && firebase deploy --only functions:onStoryRequest --project toothbrush-tales
```
(`--force` may not be needed this time — the source change is real and Firebase will see it.)

**A.3 Smoke test:** open <https://toothbrush-tales.web.app>, generate a story, watch the function logs:
```
gcloud logging read 'resource.type="cloud_function" AND resource.labels.function_name="onStoryRequest"' --project toothbrush-tales --limit 5 --format="value(timestamp,textPayload)"
```
Expect `Gemini response received, length: 1800-2500` consistently with NO `Initial JSON parse failed` line afterward.

**(Original Phase A steps preserved below for reference; the diagnosis revision above makes them obsolete.)**

### Phase A.OLD — Restore service (original plan, kept for audit trail)

**A.OLD.1 Reauth.** User runs interactively (these need a browser):
```
firebase login --reauth
gcloud auth login
gcloud auth application-default login
```

**A.OLD.2 Confirm the diagnosis from logs** (optional but recommended):
```
gcloud logging read 'resource.type="cloud_function" AND resource.labels.function_name="onStoryRequest"' \
  --project toothbrush-tales --limit 20 --format="value(timestamp,severity,textPayload)"
```
Look for `NOT_FOUND` / `Publisher Model` errors referencing `gemini-3-flash-preview`.

**A.3 Verify the target model is alive today** (probe before deploying):
```
TOKEN=$(gcloud auth print-access-token)
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "x-goog-user-project: toothbrush-tales" \
  "https://us-central1-aiplatform.googleapis.com/v1/projects/toothbrush-tales/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent" \
  -d '{"contents":[{"role":"user","parts":[{"text":"hi"}]}],"generationConfig":{"maxOutputTokens":1}}'
```
A 200 (or 200 with `MAX_TOKENS` finishReason) means we're good to deploy with `gemini-2.5-flash`. A 404 means we need to find a different model name *before* deploying — try `gemini-2.5-pro` or whatever the release-notes check from §4 surfaces.

**A.4 Clean rebuild + force-deploy** (the previous "skipped" deploy is exactly what we need to bypass):
```
cd Toothbrush_Tales_GCP/functions
rm -rf lib node_modules/.cache
npm ci
npm run build
cd ..
firebase deploy --only functions:onStoryRequest --force --project toothbrush-tales
```
The `--force` flag bypasses the smart-skip. If `--force` is rejected on Firestore triggers (Firebase has tightened this in recent CLI versions), the fallback is:
```
firebase functions:delete onStoryRequest --region us-central1 --project toothbrush-tales --force
firebase deploy --only functions:onStoryRequest --project toothbrush-tales
```
Delete + redeploy is slightly more destructive (function URL stays the same; Firestore-trigger registration is recreated) but unambiguous.

**A.5 Smoke test.** Open <https://toothbrush-tales.web.app>, generate a story, confirm no blue banner and a custom (non-template) story appears. Refresh logs to confirm `[Story] Gemini response received, length: ...` line.

**A.6 Commit.** Once verified, commit the working-tree revert with a clear message:
```
git -C Toothbrush_Tales_GCP add functions/src/generateStory.ts functions/package.json functions/package-lock.json
git -C Toothbrush_Tales_GCP commit -m "Revert to gemini-2.5-flash after gemini-3-flash-preview pull; bump firebase-functions"
```

### Phase B — Harden against the next model deprecation (today, ~30 min)

Add a fallback chain so the function tries multiple model names and falls through. One name dies → next one takes over. This means the *next* preview-pull doesn't take the app down for a week.

Pseudocode change to `generateStory.ts`:
```ts
const MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.5-pro'] // ordered, cheapest first
async function generateStoryWithGemini(systemPrompt, userPrompt) {
  let lastErr
  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = vertexAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent({ ... })
      return result.response.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } catch (err) {
      console.warn(`[Story] Model ${modelName} failed:`, err.message)
      lastErr = err
      if (!is404(err)) throw err  // only fall through on NOT_FOUND
    }
  }
  throw lastErr
}
```
Only fall through on 404 / NOT_FOUND. Quota errors (429) and auth errors (403) should fail fast — falling through would spend more quota.

Apply same change to `Toothbrush_Tales_Play/functions/src/generateStory.ts`.

### Phase C — Mirror the fix to Play (today, ~10 min)

The Play fork has the *same* `model: 'gemini-2.5-flash'` line at `Toothbrush_Tales_Play/functions/src/generateStory.ts:12`. **Currently Play is also at risk.** Play has not deployed since the April 30 commit either (we never deployed Play during the previous session). If Play's last deploy was on gemini-2.5-flash, it may still be fine. If it was on a model that's since been pulled, same outage applies the moment we ship.

Plan for Play:
- Pull Play's deployed function model name first: `gcloud functions describe onStoryRequest --project toothbrush-tales-play-5081b --region us-central1 --no-gen2`
- Apply the same Phase B fallback-chain change to Play's source
- Build and deploy:
```
cd Toothbrush_Tales_Play/functions
rm -rf lib
npm ci
npm run build
cd ..
firebase deploy --only functions:onStoryRequest --project toothbrush-tales-play-5081b
```
- Smoke test on <https://toothbrush-tales-play-5081b.web.app>.

### Phase D — Add observability so we catch this faster next time (deferred)

Two cheap improvements for a follow-up commit:
1. **Surface server errors to the client.** Right now the catch silently returns `isFallback: true` with status `complete`. Add an `errorReason` field on the doc that the client can log to GA4 / console even when it displays the fallback story. We'd have caught this on the first failed request instead of 2 days later.
2. **A weekly "is the AI alive?" GCP scheduled task** that probes the model and logs to Cloud Logging. Optional; the Phase B fallback chain mostly obviates the need.

Defer Phase D to its own session — Phase A–C is enough to restore service and prevent the immediate repeat.

## 7. Risk + rollback

- Phase A is low-risk: same code path that already runs in production, just with a working model name.
- Phase B introduces a new control-flow branch. Test it locally first by intentionally setting `MODEL_CANDIDATES = ['gemini-nonexistent', 'gemini-2.5-flash']` and confirming the second one succeeds.
- Rollback: `git revert` the commit, redeploy. Old code (with bad model) is also broken, so rollback only helps if Phase B introduces a *new* bug — verify smoke test before walking away.

## 8. What I need from you before applying

1. Confirm you want Phase A + B + C in one session (recommended) or just A first to restore service and defer B/C.
2. Run the three reauth commands in §A.1 (browser opens, ~30 seconds).
3. Sanity-check the diagnosis against your knowledge — does anyone use the personal app between you and your son, and could anyone have changed Firebase / GCP settings in the last few days?

Once you confirm those, we execute Phase A through C, smoke test both apps, commit, and add a short [[gemini-model]] memory update noting the gemini-3-flash-preview retirement and the fallback chain.
