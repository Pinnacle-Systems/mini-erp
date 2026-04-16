## Context

The repository already contains a substantial Android baseline on the `capacitor` branch: Capacitor dependencies and config, an Android project under `apps/frontend/android`, lifecycle and hardware-back handling, storage diagnostics, and release metadata automation. That baseline aligns with the documented architecture because it keeps `apps/frontend` as the single client and limits platform-specific logic to a narrow frontend platform layer.

The main unresolved issue is not whether the app can be wrapped for Android, but whether the wrapped app is reliable enough for real use and store delivery. The highest-risk area is auth/session transport. The current code still relies on WebView `fetch` with `credentials: "include"` while enabling Capacitor cookie/native HTTP support in config. That means Android packaging exists, but the branch has not yet proven the refresh-cookie and repeated cold-start behavior that matter most for a production app.

The design also has to respect existing repo constraints:

- Preserve the current backend-authored sync contract from `ARCHITECTURE.md`
- Avoid creating a second frontend implementation
- Keep the desktop-first design direction from `DESIGN_GUIDELINES.md` while making Android functionally usable

## Goals / Non-Goals

**Goals:**
- Formalize Android delivery as a product capability rather than an exploratory implementation branch
- Keep Capacitor as a packaging and platform-integration layer around the existing frontend
- Make auth/session validation on Android a hard gate before store-readiness work is treated as complete
- Define the minimum Android UX hardening needed for a first release
- Define a phased path from current branch state to validated Android release readiness

**Non-Goals:**
- Rewriting the app as a native Android application
- Designing a fully separate mobile UI family
- Redesigning backend sync contracts for Android
- Committing to iOS delivery in the same change

## Decisions

### 1. Keep one frontend implementation

The Android app should continue to package `apps/frontend` through Capacitor rather than introducing a separate Android client implementation.

Why:
- This matches the existing architecture rule to keep platform-specific changes narrow
- The repo already has the right integration shape
- A second client would create unnecessary divergence in sync, auth, and business workflows

Alternatives considered:
- Native Android rewrite: rejected as too large and out of scope
- Separate mobile web fork inside the frontend: rejected because it would fragment behavior and increase maintenance cost

### 2. Treat auth/session reliability as the primary release gate

Android support should not be considered complete until signed builds prove stable login, refresh, logout, and cold-start session continuity.

Why:
- The current branch already covers much of the baseline scaffolding
- WebView cookie behavior is the most likely source of production-only failures
- An Android app that installs but loops on login is operationally worse than having no Android app

Alternatives considered:
- Focus first on visual/mobile polish: rejected because UI improvements do not matter if session persistence is unstable
- Declare pure WebView networking sufficient without validation: rejected because this is the highest-risk unknown

### 3. Preserve the existing sync and offline model

Dexie/IndexedDB and backend-authored sync outcomes remain the V1 Android model.

Why:
- The codebase already uses this model
- The architecture explicitly keeps sync outcomes server-authored
- The existing branch adds lifecycle sync triggers and storage diagnostics that support this direction

Alternatives considered:
- Move immediately to native persistence or SQLite: rejected for now because durability concerns should first be measured, not assumed
- Redesign sync for Android-specific behavior: rejected as unnecessary scope expansion

### 4. Use targeted mobile hardening instead of a mobile redesign

Android readiness should focus on eliminating blocking issues such as unsafe viewport sizing, keyboard overlap, scroll traps, and back-navigation mismatches.

Why:
- The design guidelines keep the product desktop-first
- A narrow hardening pass is more consistent with the current product direction than inventing a second UI language
- The current branch has already started this work with `100dvh`, themed backgrounds, and overscroll/tap behavior fixes

Alternatives considered:
- Full mobile-first redesign: rejected as out of scope for first Android delivery

## Risks / Trade-offs

- [WebView auth/cookie instability] -> Validate on signed release builds and adopt native HTTP/cookie handling for auth-sensitive flows if pure `fetch` is unreliable.
- [Desktop-first layouts remain awkward on phones] -> Define first-release usability thresholds and fix blockers instead of aiming for perfect mobile ergonomics in one change.
- [IndexedDB durability varies by device/storage pressure] -> Keep diagnostics and define an escalation threshold for future native persistence.
- [Docs drift from implementation] -> Update proposal/design/tasks/specs from actual branch state and avoid checklists that still describe pre-Capacitor conditions.
- [Play Store work appears "close" because scaffolding exists] -> Separate scaffold completion from release readiness and require explicit validation evidence.

## Migration Plan

1. Adopt this change as the planning baseline for Android support.
2. Validate the existing Capacitor baseline against Android debug and signed release builds.
3. Resolve auth/session transport and production networking behavior first.
4. Validate offline replay, lifecycle sync behavior, and storage diagnostics.
5. Address phone-specific UX blockers in the highest-priority flows.
6. Complete store-readiness work: signing, versioning, packaging, and compliance inputs.

Rollback strategy:
- If Android auth/session behavior proves too unstable for first release, keep the existing web/PWA path as the primary supported client and treat Android delivery as still in-progress rather than partially shipping an unreliable app.

## Open Questions

- Is pure WebView `fetch` sufficient in signed Android builds, or do auth-sensitive flows need Capacitor native HTTP?
- What exact phone workflows define the minimum acceptable Android release surface?
- What telemetry destination should replace the current console-only diagnostic intake?
- Does first Android release require App Links, or can that be deferred?
