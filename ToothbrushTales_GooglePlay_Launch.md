Readiness assessment

  Already in place ✅
  - PWA manifest live at https://toothbrush-tales.web.app/manifest.webmanifest with display: standalone, scope,
  start_url, theme/background colors, full icon set (72→512 with purpose: any maskable).
  - HTTPS hosting, service worker registered (vite-plugin-pwa autoUpdate).
  - twa-manifest.json at repo root with packageId: app.web.toothbrush_tales.twa, host toothbrush-tales.web.app, portrait
   orientation, splash colors.
  - Firebase Hosting now sets correct Content-Type + short cache for /.well-known/assetlinks.json.
  - Placeholder Toothbrush_Tales_GCP/public/.well-known/assetlinks.json will be copied into dist/ on npm run build.

  Still required from you (cannot be done in code) ⚠️
  1. Generate signing keystore — there's no android.keystore in the repo (correct — never commit it). Bubblewrap will
  create it on first build.
  2. Fill in real SHA-256 in public/.well-known/assetlinks.json and redeploy hosting. Without this, the TWA will show
  the Chrome address bar.
  3. Privacy policy URL — Play Store requires a hosted privacy policy, doubly so for a Kids app (Designed for Families
  program / COPPA).
  4. Play Console declarations — target age 5–9, ads (none), data safety form, COPPA acknowledgement.
  5. Tooling — JDK 17 and Android SDK on your machine for Bubblewrap to invoke Gradle.

  Optional pre-flight cleanups (recommended)
  - The partial Bubblewrap scaffolding at the repo root (app/, build.gradle, gradle/, gradlew*, settings.gradle) is
  incomplete — no AndroidManifest.xml or LauncherActivity sources. Cleanest path is to delete them and let Bubblewrap
  regenerate.

  ---
  Bubblewrap walkthrough

  I'd recommend running these in a separate folder (e.g. Toothbrush_Tales_GCP/android/) to keep the Android project out
  of the web app's tree. The walkthrough below uses that pattern.

  0. Prereqs (one time)

  # Verify JDK 17 (Bubblewrap needs JDK 17 with current AGP)
  java -version

  # Install Bubblewrap CLI globally
  npm install -g @bubblewrap/cli

  # First run will prompt to install JDK + Android SDK if missing — say yes.
  bubblewrap doctor

  1. Clean the partial scaffold

  # From repo root — these files are stale
  rm -rf app build.gradle gradle gradle.properties gradlew gradlew.bat settings.gradle

  Keep twa-manifest.json — Bubblewrap will reuse it.

  2. Re-initialize from the live manifest

  mkdir -p Toothbrush_Tales_GCP/android
  cd Toothbrush_Tales_GCP/android
  mv ../../twa-manifest.json .

  bubblewrap init --manifest=https://toothbrush-tales.web.app/manifest.webmanifest

  When prompted:
  - Accept defaults from your existing twa-manifest.json where possible.
  - Confirm package id app.web.toothbrush_tales.twa (or change — but if you change it, also update package_name in
  public/.well-known/assetlinks.json).
  - For signing key: let it create a new one. Save the keystore password and key password somewhere safe (1Password,
  etc.). If you lose the keystore you can never update the app on Play.

  3. Build the Android App Bundle

  bubblewrap build

  Output: app-release-bundle.aab (upload this to Play) and app-release-signed.apk (for sideload testing).

  4. Get the SHA-256 fingerprint and update assetlinks

  # After build, Bubblewrap prints the SHA-256. To re-print:
  keytool -list -v -keystore android.keystore -alias android \
    | grep "SHA256:"

  Copy the colon-separated hex string. Replace REPLACE_WITH_SHA256_FROM_KEYSTORE in
  Toothbrush_Tales_GCP/public/.well-known/assetlinks.json, then redeploy:

  cd Toothbrush_Tales_GCP
  npm run build
  firebase deploy --only hosting

  Verify it's live:
  curl https://toothbrush-tales.web.app/.well-known/assetlinks.json

  5. Test on a real device before uploading

  # With phone in USB-debug mode
  cd Toothbrush_Tales_GCP/android
  bubblewrap install

  Open the app and confirm:
  - No Chrome address bar at the top (this is the assetlinks check working).
  - Splash screen shows your colors, then the PWA loads.
  - Story generation, TTS playback, timer all work.
  - Back button behavior is sane.

  If you see a URL bar, assetlinks isn't matching. Re-check the SHA-256 and that the JSON is valid (jq .
  dist/.well-known/assetlinks.json).

  6. Play Console upload

  In Google Play Console:

  1. Create app → Name "Toothbrush Tales", Default language, App or Game = App, Free, Declarations.
  2. App content (sidebar):
    - Privacy policy — paste your hosted URL. Required.
    - App access — All functionality available without restrictions (no login).
    - Ads — No ads.
    - Content rating — fill the IARC questionnaire. Likely "Everyone".
    - Target audience — select "Ages 5 and under" or "Ages 6–8" based on your real target. This triggers the Designed
  for Families rules and stricter data/SDK policies.
    - Data safety — declare what's collected (anonymous Firebase auth UID, Firestore story requests, GA4 events). Mark
  whether each is encrypted in transit (yes — HTTPS) and whether users can request deletion.
    - Government apps, News, COVID-19 — No.
    - Health apps — No (toothbrushing guidance is fine).
    - Financial features — None.
  3. Production → Create release → upload app-release-bundle.aab.
  4. Use Play App Signing (default, recommended). Google generates the actual signing key; your android.keystore becomes
   the upload key.
  5. Critical: after upload, Play Console shows the App signing key certificate with its own SHA-256. That is the
  fingerprint that needs to be in assetlinks.json for the production install — not your local upload key. Add both
  fingerprints to the array in assetlinks.json, redeploy hosting, then promote the release.

  "sha256_cert_fingerprints": [
    "<UPLOAD_KEY_SHA256_FROM_LOCAL_KEYSTORE>",
    "<APP_SIGNING_KEY_SHA256_FROM_PLAY_CONSOLE>"
  ]

  6. Submit for review. Kids apps go through stricter manual review — typically 1–7 days.

  ---
  Things that will surprise you

  - Two SHA-256s, not one. The local-build TWA uses your upload key; the Play-installed TWA uses Google's app signing
  key. Both must be in assetlinks.json or installed users will see the URL bar.
  - Maskable icon — your icon-512x512.png is marked purpose: "any maskable". If it doesn't have ~10% safe-zone padding,
  the OS will crop edges. Test on a Pixel launcher (which masks aggressively) before launch.
  - Notifications were true in the manifest; I turned them off. If you ever wire push, flip back and ensure the runtime
  permission flow is implemented.
  - Family policy: no third-party ad SDKs, no behavioral analytics targeted to kids. Your GA4 setup is COPPA-flagged in
  the recent commit — verify the consent gate works in production before you submit.
