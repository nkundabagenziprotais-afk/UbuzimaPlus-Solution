# Mobile App Packaging

Ubuzima+ Admin now has a production mobile web app shell and PWA support in
`web/admin-dashboard`. The near-term native store path is Capacitor: keep the
single React/Vite codebase, wrap it in native Android/iOS projects, and add
native capabilities only where they are needed.

## Current Status

- Phone UI: app shell, Home dashboard, POS/Sales, Inventory, Procurement,
  General Stock, More, safe-area layout, offline shell, and install prompt.
- Website install: supported browsers can show the native install prompt after
  login once the browser marks the PWA as eligible. Installed mode opens
  standalone from the phone home screen without the browser address bar.
- iPhone web install: iOS users may need the browser Share menu / Add to Home
  Screen flow because browser-controlled install prompts are not available in
  every iOS browser.
- Live dashboard adoption: Business Overview data is loaded by
  `BusinessOverviewReviewPage` and shared to mobile through
  `ubuzimaSharedDashboardAnalyticsMetricsV1`.
- Native bridge: Capacitor dependencies, scripts, and
  `web/admin-dashboard/capacitor.config.ts` are prepared.
- Native Android/iOS folders are intentionally not generated yet. Confirm the
  app identifier, signing owners, store accounts, privacy policy URL, and final
  app icons before running `cap add`.

## Native Project Commands

Run from `web/admin-dashboard` after confirming `appId`:

```bash
npm run native:doctor
npm run native:add:android
npm run native:add:ios
npm run native:sync
```

Open native projects:

```bash
npm run native:open:android
npm run native:open:ios
```

## Store Output Targets

- Google Play publishing target: Android App Bundle (`.aab`). Google Play uses
  App Bundles to generate optimized APKs for devices.
- Android direct testing target: signed APK, generated from Android Studio or
  Gradle after the native Android project exists.
- Apple App Store target: signed iOS app archive/IPA through Xcode and App Store
  Connect.

## SMS Reconciliation Permission Strategy

- The web/PWA version cannot read a phone SMS inbox. Do not add a fake SMS
  permission prompt to the web app.
- Android native build: prefer the SMS User Consent API for reconciliation
  messages when possible, because it asks the user to approve access to a
  single incoming message. Broad `READ_SMS` access is restricted by Google Play
  and needs an approved core use case.
- iPhone native build: iOS supports secure one-time-code AutoFill patterns, but
  does not provide a general third-party SMS inbox permission. Reconciliation on
  iPhone should use provider APIs/webhooks, uploads, manual review, or secure
  code import flows.
- Native permission work should be added after the reconciliation message source
  is confirmed: bank SMS, mobile-money SMS, payment provider API, email
  statement, or uploaded file.

## Before Store Submission

- Confirm final bundle IDs:
  - Android/iOS current proposal: `com.ubuzimaplus.admin`
- Replace placeholder SVG/PWA icons with final store icons and splash assets.
- Add privacy policy, support URL, app category, screenshots, and app
  description.
- Add native push notification plan if required for pharmacist/cashier alerts.
- Test role-specific flows: Owner/Admin, Pharmacist, Cashier, Finance,
  Procurement, Inventory, and general staff.
- Validate offline behavior and loading/error states on real Android and iPhone
  devices.
- Prepare signed release builds with the organization store accounts.

## References

- Capacitor native runtime: https://capacitorjs.com/docs
- Capacitor Android workflow: https://capacitorjs.com/docs/android
- Android App Bundles: https://developer.android.com/guide/app-bundle
- Google Play Console app setup: https://support.google.com/googleplay/android-developer/answer/9859152
- PWA installation prompts: https://web.dev/learn/pwa/installation-prompt
- SMS User Consent API: https://developers.google.com/identity/sms-retriever/user-consent/overview
- Google Play SMS/Call Log policy: https://support.google.com/googleplay/android-developer/answer/10208820
- Apple one-time-code AutoFill: https://developer.apple.com/documentation/security/one-time-codes
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
