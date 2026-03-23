# Android Play Store Delivery via Capacitor V1 Checklist

This checklist tracks implementation status for [RFC: Android Play Store Delivery via Capacitor V1](/home/ajay/workspace/mini-erp/docs/rfcs/android-capacitor-play-store-v1.md). It is execution-focused and should be updated as work progresses without changing the RFC itself.

Status review note: created against tracked repository state on 2026-03-23. There is no Android Capacitor platform checked into the repo yet. The frontend is a React/Vite PWA with service-worker registration, Dexie-backed local sync state, and browser-oriented auth/session handling. This checklist starts from that baseline and tracks the work required to package and harden the app for Play Store delivery.

## Phase 0: Readiness and Decision Lock

Goal: confirm production assumptions before platform hardening starts.

- [ ] Confirm Android-only scope for this rollout
- [ ] Confirm public HTTPS backend is available for production mobile traffic
- [ ] Confirm final Android package ID
- [ ] Confirm app label, versioning policy, and release owner
- [ ] Confirm signing key ownership and storage
- [ ] Confirm privacy policy hosting plan and support contact details
- [ ] Confirm whether password reset, email links, or notification links must open the app
- [ ] Confirm a single source branding asset for launcher and splash generation
- [ ] Confirm Dexie-only V1 storage risk is acceptable pending telemetry

## Phase 1: Capacitor Baseline Integration

Goal: create the Android shell around the existing frontend.

- [ ] Add Capacitor dependencies under `apps/frontend`
- [ ] Add Capacitor config under `apps/frontend`
- [ ] Configure web build output as the Capacitor web asset source
- [ ] Generate Android platform under `apps/frontend/android`
- [ ] Add scripts for build, sync, Android Studio open, and release build
- [ ] Set Android app name and package ID
- [ ] Set Android theme color and baseline shell metadata
- [ ] Generate Android icons and Android 12+ splash assets from a single source asset
- [ ] Configure Android soft-keyboard resize behavior
- [ ] Add Android hardware back-button integration
- [ ] Verify the bundled frontend launches in Android debug shell

## Phase 2: Backend Connectivity, Origin Handling, and Auth Validation

Goal: make auth and session persistence reliable in Capacitor production conditions.

- [ ] Add explicit production API base URL handling for Android builds
- [ ] Validate login in Capacitor Android against the real backend
- [ ] Validate refresh-cookie persistence after app restart
- [ ] Validate logout behavior
- [ ] Validate expired-session recovery behavior
- [ ] Document Capacitor origin assumptions and production transport strategy
- [ ] Enable Capacitor cookie support for mobile auth/session handling
- [ ] Validate whether native HTTP transport is required for credentialed requests
- [ ] Adopt native HTTP transport if WebView networking is unreliable
- [ ] Confirm backend CORS and cookie policy are compatible with the chosen transport path
- [ ] Validate behavior on signed release builds, not only debug builds
- [ ] Prove stable session survival across at least 5 cold starts and mixed network conditions
- [ ] Document fallback path if pure WebView networking fails

Hard gate:

- [ ] Do not proceed to Phase 4 or Phase 5 until the chosen auth transport is proven stable on signed release builds

## Phase 3: Offline and Sync Mobile Hardening

Goal: preserve current offline behavior under mobile lifecycle conditions.

- [ ] Keep Dexie local storage and synced-entity reads unchanged
- [ ] Trigger sync after launch once session and business context are ready
- [ ] Trigger sync on app resume
- [ ] Trigger sync on connectivity regain
- [ ] Validate offline queued mutations replay correctly after reconnect
- [ ] Validate sync rejection UI still behaves correctly after delayed replay
- [ ] Implement `StorageDiagnostics` service
- [ ] Call `navigator.storage.persist()` on app load
- [ ] Call `navigator.storage.estimate()` on app load
- [ ] Log storage-persistence failures to backend telemetry
- [ ] Log unexpectedly low quota to backend telemetry
- [ ] Confirm IndexedDB persistence survives restart and process death on Android
- [ ] Document escalation threshold for native persistence or SQLite if durability proves insufficient

## Phase 4: Mobile UX Stabilization

Goal: make the existing app practically usable on phones without redesigning the product.

- [ ] Audit login, business selection, home, one browse flow, and one edit flow per key module
- [ ] Replace mobile-problematic `100vh` usage with `100dvh` or equivalent dynamic viewport handling where needed
- [ ] Fix safe-area and viewport height issues
- [ ] Fix keyboard overlap on forms and editable grids
- [ ] Ensure `html`, `body`, and the root app container have explicit themed background colors
- [ ] Verify keyboard resize does not introduce white flashes
- [ ] Fix scroll traps caused by desktop pane locking
- [ ] Disable accidental pull-to-refresh unless intentionally implemented
- [ ] Remove default tap-highlight artifacts where they make the app feel like an unpolished website shell
- [ ] Verify primary actions remain visible and reachable during keyboard open
- [ ] Verify text, tables, and controls remain legible on common phone widths
- [ ] Record any accepted first-release UX limitations

## Phase 5: Store Readiness, Deep Linking, and Release Pipeline

Goal: make the Android package releasable and repeatable.

- [ ] Create release signing setup
- [ ] Document secret ownership and release steps
- [ ] Generate a signed release AAB successfully
- [ ] Add pre-build automation to increment Android `versionCode` for every release build
- [ ] Keep Android `versionName` mapped to the workspace/package release version
- [ ] Prepare adaptive icons and final branding assets
- [ ] Provide privacy policy URL
- [ ] Gather Play Store data-safety answers
- [ ] Review Android permissions and remove unnecessary declarations
- [ ] Verify HTTPS-only production networking policy
- [ ] If app links are required, host `.well-known/assetlinks.json` on the production domain
- [ ] If app links are required, configure Android intent filters
- [ ] If app links are required, verify Android domain association
- [ ] Document the full path from frontend build to Play Console upload

## Phase 6: Controlled Rollout and Post-Launch Observation

Goal: reduce risk before broad rollout.

- [ ] Start with internal testing track
- [ ] Expand to closed testing after auth and offline validation passes
- [ ] Monitor login failures
- [ ] Monitor sync failures
- [ ] Monitor storage-loss reports
- [ ] Monitor crash reports
- [ ] Triage Android-only issues separately from web regressions
- [ ] Hold production rollout until no blocker remains in auth, sync, launch stability, or data persistence
- [ ] Define rollback path to prior store release if a critical issue ships

## Validation Checklist

- [ ] `pnpm --filter frontend typecheck`
- [ ] `pnpm --filter frontend lint`
- [ ] `pnpm --filter frontend build`
- [ ] Run relevant backend lint/tests if auth, CORS, App Links, or telemetry changes are made
- [ ] Android debug build succeeds
- [ ] Android release or AAB build succeeds
- [ ] Test on at least one physical Android phone
- [ ] Test on one lower-end or older Android target if feasible
- [ ] Validate image and asset loading against the production backend
- [ ] Validate upgrade-over-existing-install behavior
- [ ] Validate session stability over repeated cold starts on signed release builds

## Notes

- [ ] Android platform work is not started in the current tracked repo state
- [ ] Auth transport validation is the highest-risk gate for the rollout
- [ ] Dexie remains the default V1 offline store unless telemetry and device testing prove it insufficient
