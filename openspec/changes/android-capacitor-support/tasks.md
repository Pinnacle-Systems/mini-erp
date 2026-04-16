## 1. Baseline Verification

- [ ] 1.1 Validate the existing Capacitor Android project builds successfully in debug mode
- [ ] 1.2 Validate the existing Capacitor Android project builds successfully as a signed or release-like bundle
- [ ] 1.3 Update Android tracking docs to reflect the actual branch baseline instead of the pre-Capacitor starting state

## 2. Auth And Networking Hardening

- [ ] 2.1 Verify login, refresh, and logout behavior against the real backend on Android
- [ ] 2.2 Verify repeated cold-start session continuity on signed Android builds
- [ ] 2.3 Decide whether auth-sensitive requests can remain on WebView `fetch` or need Capacitor native HTTP integration
- [ ] 2.4 Align backend CORS and cookie behavior with the chosen Android transport path

## 3. Offline And Lifecycle Validation

- [ ] 3.1 Verify sync-on-resume and sync-on-reconnect behavior on Android devices
- [ ] 3.2 Verify queued offline mutations replay correctly after reconnect
- [ ] 3.3 Verify storage diagnostics run and capture persistence/quota risk signals appropriately
- [ ] 3.4 Decide the escalation threshold for future native persistence or SQLite work if device testing shows IndexedDB durability problems

## 4. Mobile UX Stabilization

- [ ] 4.1 Audit login, business selection, home, and one high-value operational workflow per key module on Android phones
- [ ] 4.2 Fix Android-specific viewport, keyboard, or scroll blockers discovered during audit
- [ ] 4.3 Verify Android back-button behavior matches user expectations across nested routes
- [ ] 4.4 Record accepted first-release Android UX limitations, if any remain

## 5. Release Readiness

- [ ] 5.1 Finalize Android package metadata, signing ownership, and release ownership
- [ ] 5.2 Verify Android versioning automation fits the intended release process
- [ ] 5.3 Prepare release documentation from frontend build through Play Console upload
- [ ] 5.4 Gather remaining Play Store compliance inputs such as privacy policy, data safety, and permissions review
