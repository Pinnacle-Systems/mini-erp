# RFC: Android Play Store Delivery via Capacitor V1

This RFC is a standalone design document for iterative refinement. It records the current agreed direction for Android delivery via Capacitor and does not replace [ARCHITECTURE.md](/home/ajay/workspace/mini-erp/ARCHITECTURE.md) or [DESIGN_GUIDELINES.md](/home/ajay/workspace/mini-erp/DESIGN_GUIDELINES.md).

**Status:** Proposed
**Area:** Frontend Platform, Auth, Sync, Mobile Delivery
**Core Logic:** Hybrid Android shell around the existing React/Vite frontend, with preserved offline-first sync behavior, hardened auth transport, mobile lifecycle sync triggers, and Play Store packaging.

## 1. Problem Statement

The product already has an offline-capable React/Vite frontend with local sync storage and queued mutation behavior. The next requirement is to package that frontend as an Android app suitable for Play Store delivery without throwing away the current sync architecture or creating a second client implementation.

The main constraint is that Capacitor Android is not the same runtime as a standard mobile browser or installed PWA:

- default app origin behavior differs from a normal hosted web origin
- WebView cookie and credential behavior is more fragile than desktop web assumptions
- app lifecycle and network regain behavior differ from always-open browser tabs
- web storage durability can be weaker under low-storage device conditions

The rollout should therefore prioritize reliability and store readiness over native parity.

## 2. Goals and Non-Goals

### 2.1 Goals

- Deliver an Android app bundle suitable for Play Store submission
- Preserve the current synced-entity and queued-mutation architecture
- Keep backend sync contracts and rejection semantics unchanged
- Make session establishment and refresh reliable in Capacitor Android
- Make the existing desktop-first product functional on Android phones
- Add mobile lifecycle hooks for sync on launch, resume, and reconnect
- Document release and rollout steps so Android delivery is repeatable

### 2.2 Non-Goals

- No full native Android rewrite in this phase
- No removal of offline/sync behavior from the web frontend
- No full mobile-first redesign of the product
- No iOS delivery in this phase
- No backend domain contract redesign unless Android transport limitations force a narrow compatibility change

## 3. Architectural Position

The Android delivery approach follows these rules:

1. `apps/frontend` remains the product client and source of truth for UI behavior in this phase.
2. Capacitor is the packaging and platform integration layer, not a second application architecture.
3. Dexie / IndexedDB remains the primary offline store for V1 Android delivery.
4. Sync remains backend-authored. The frontend must continue consuming server-authored sync results and rejection reason codes exactly as defined in `ARCHITECTURE.md`.
5. Service worker behavior is not the primary Android offline engine; local sync storage is.
6. Platform-specific changes should stay narrow and internal to the frontend/platform layer rather than creating parallel feature implementations.
7. The product remains desktop-first by design, but Android must be functionally usable and store-acceptable.

## 4. Technical Constraints

### 4.1 Auth Transport Is a Hard Gate

Phase 2 is a hard gate for the Android rollout.

- No progression to UX polish or store rollout should happen until session persistence is proven stable on signed release builds.
- The chosen transport path must maintain login and refresh behavior across repeated cold starts and mixed network conditions.

### 4.2 Capacitor Android Is a Distinct Web Context

The Android app must not assume browser-hosted web behavior.

- app origin assumptions differ from `https://app.example.com`
- backend CORS and cookie behavior must be validated against the actual Capacitor runtime
- raw WebView `fetch` plus cookie behavior must not be assumed production-safe without validation

### 4.3 Storage Durability Must Be Measured

Dexie / IndexedDB remains the default V1 store, but durability is a measured risk.

- request persistent storage where supported
- inspect storage quota and usage
- report storage-health signals so future persistence decisions are evidence-based

### 4.4 Android Release Versioning Must Be Automated

Play Store uploads require a strictly increasing integer `versionCode`.

- release automation must increment `versionCode` for every upload
- user-facing `versionName` should stay aligned with the workspace release version

## 5. Proposed Approach

### 5.1 Platform Strategy

- Wrap `apps/frontend` with Capacitor and generate `apps/frontend/android`
- Build the web app with Vite and sync the built assets into the Android shell
- Keep the current routing and module organization unless Android validation exposes a blocking issue
- Keep the existing PWA configuration for the web deployment path, but do not depend on it as the Android offline engine

### 5.2 Auth and Backend Strategy

- Add explicit mobile production API configuration for Android builds
- Validate the current access-token plus refresh-cookie flow under Capacitor Android
- Prefer Capacitor-native cookie support for credentialed session handling
- Use Capacitor-native HTTP transport for auth-sensitive requests if WebView transport proves unreliable
- Keep backend auth endpoints and token semantics unchanged unless Android validation forces a narrow compatibility change

### 5.3 Offline and Sync Strategy

- Preserve queued mutations, local entities, and reconciliation logic
- Trigger sync after session hydration on launch, on app resume, and on connectivity regain
- Keep the current foreground interval sync only as a secondary assist
- Add storage diagnostics that attempt persistence, inspect quota, and report failures or unexpectedly low quota
- Treat a future move to native persistence or SQLite as a later escalation path, not a V1 prerequisite

### 5.4 UX Strategy

- Fix Android-blocking issues without redesigning the product into a separate mobile UI family
- Prefer `100dvh` or equivalent dynamic viewport handling where mobile viewport behavior makes `100vh` unsafe
- Ensure explicit themed background colors exist on `html`, `body`, and the root app container to avoid white flashes during keyboard resize
- Handle Android back-button expectations inside the app shell
- Prevent accidental pull-to-refresh unless explicitly implemented as product behavior

### 5.5 Store Strategy

- Build and sign a release AAB
- Prepare Android App Links if product links need to open the app
- Generate Android icons and splash assets from a single source asset
- Document the build, signing, and upload flow

## 6. Public Interface and Contract Impact

### 6.1 Frontend

Expected frontend additions:

- mobile-aware environment/config support for backend API base URL
- a small internal platform service for:
  - Capacitor app lifecycle events
  - network status events
  - Android hardware back-button handling
  - optional native HTTP / cookie integration
- a storage diagnostics service that requests persistent storage and reads storage estimates
- Android build and release scripts

### 6.2 Backend

Expected backend impact:

- no domain API redesign
- possible environment or CORS hardening for Android production networking
- a telemetry intake path if the current backend does not already accept client storage diagnostics
- Android App Links hosting support if deep linking is required:
  - `.well-known/assetlinks.json` on the production domain

### 6.3 Unchanged Contracts

These interfaces should remain unchanged in this phase:

- sync payload shapes
- sync rejection codes
- backend-owned sync outcomes
- business-domain APIs unless a transport compatibility edge case forces a narrow change

## 7. Phased Rollout

### 7.1 Phase 0: Readiness and Decision Lock

Purpose: confirm production assumptions before platform hardening.

Deliverables:

- final Android package ID
- production backend host strategy
- signing owner and release owner
- privacy policy and data-safety inputs identified
- deep-link requirement explicitly decided
- source branding asset for Android icon and splash generation confirmed

Exit criteria:

- no open product or infrastructure decision remains that would materially change implementation direction

### 7.2 Phase 1: Capacitor Baseline Integration

Purpose: create a functioning Android shell around the existing frontend.

Deliverables:

- Capacitor added to `apps/frontend`
- Android platform generated under `apps/frontend/android`
- build, sync, open, and release scripts added
- baseline Android metadata configured
- keyboard resize and baseline back-button behavior in place

Exit criteria:

- the app launches on Android device or emulator and reaches the login screen using bundled frontend assets

### 7.3 Phase 2: Backend Connectivity, Origin Handling, and Auth Validation

Purpose: make session establishment and refresh reliable in Capacitor production conditions.

Deliverables:

- explicit production API configuration for Android
- documented origin / cookie / transport strategy
- validated login, refresh, and logout behavior on Android
- decided transport path for auth-sensitive requests

Hard gate rule:

- no progression to Phase 4 or Phase 5 until the chosen auth transport is proven stable on signed release builds

Exit criteria:

- Android can maintain a session across repeated cold starts and mixed network conditions on signed release builds

### 7.4 Phase 3: Offline and Sync Mobile Hardening

Purpose: preserve current offline behavior under real mobile lifecycle conditions.

Deliverables:

- sync triggers for launch, resume, and reconnect
- validated queued mutation replay after reconnect
- storage diagnostics and telemetry
- documented durability threshold for any future SQLite escalation

Exit criteria:

- core offline create and edit flows behave correctly on Android, and storage-health telemetry is live

### 7.5 Phase 4: Mobile UX Stabilization

Purpose: make the existing app practically usable on phones without redesigning the product.

Deliverables:

- targeted mobile fixes for login, business selection, home, key browse flows, and key edit flows
- keyboard-safe layouts
- viewport, background, and scroll behavior hardened for Android WebView
- documented first-release UX limitations if any remain

Exit criteria:

- primary workflows are functional on Android phones without critical layout, keyboard, or navigation blockers

### 7.6 Phase 5: Store Readiness, Deep Linking, and Release Pipeline

Purpose: make the Android package releasable and repeatable.

Deliverables:

- signed release AAB
- release documentation
- Play Store metadata and compliance inputs
- App Links support if required
- automated Android release versioning

Exit criteria:

- the app can be built, signed, versioned, and prepared for Play Console upload without manual version-code risk

### 7.7 Phase 6: Controlled Rollout and Post-Launch Observation

Purpose: reduce risk before broad adoption.

Deliverables:

- staged rollout sequence
- issue triage ownership
- rollback path
- Android-specific monitoring of auth failures, sync failures, storage-loss reports, and crashes

Exit criteria:

- production rollout is approved with no unresolved Sev-1 or Sev-2 Android blockers

## 8. Testing and Validation

### 8.1 Required Automated Validation

- frontend typecheck
- frontend lint
- frontend production build
- backend lint and tests for any auth, CORS, App Links, or telemetry changes
- Android debug build
- Android release or AAB build

### 8.2 Required Manual Validation

- fresh install and first login
- repeated cold starts with session refresh
- offline usage and later reconnect
- queued mutation replay
- expired-session recovery while online
- poor-network launch and later recovery
- upgrade over an existing app install
- hardware back-button behavior on nested routes
- keyboard-heavy forms and editable tables
- at least one low-storage or lower-end device spot check if feasible

## 9. Risks and Mitigations

- Refresh cookies may behave inconsistently in Android WebView.
  Mitigation: validate early and prefer Capacitor-native cookie / HTTP support for auth-sensitive requests.

- Capacitor origin assumptions may conflict with backend CORS or cookie policy.
  Mitigation: explicitly test release-like transport behavior and document the chosen production path.

- Desktop-first layout may be clumsy or broken on phone screens.
  Mitigation: fix targeted blocking issues for Android instead of attempting a full redesign in this phase.

- Web storage may be cleared under low-storage or unusual device conditions.
  Mitigation: request persistence, inspect storage estimates, emit telemetry, and define criteria for future native persistence escalation.

- Manual Play Store versioning may cause rejected uploads.
  Mitigation: automate `versionCode` incrementation in the release flow.

## 10. Acceptance Criteria

- Android app launches from a signed release build and can be packaged as an AAB
- users can sign in, restart the app, and continue without re-auth loops
- offline changes persist locally and sync correctly when connectivity returns
- primary workflows remain usable on phones without critical layout, keyboard, or back-navigation defects
- release process, store assets, App Links setup if needed, and policy inputs are documented and repeatable

## 11. Assumptions and Defaults

- Android only for this RFC
- production devices reach a public HTTPS backend
- current sync and auth contracts remain the baseline
- Capacitor cookie / native networking support is the default mitigation path if raw WebView behavior is unreliable
- Dexie remains the primary offline store for V1 unless validation proves it insufficient
- no full native rewrite is planned in this initiative
