## Why

The product already has a meaningful Android baseline on the `capacitor` branch, but the current state is not yet a fully validated or operationally complete Android delivery path. We need to formalize Android support so the team can treat it as a planned product capability with clear requirements, hard gates, and rollout scope instead of an exploratory branch.

## What Changes

- Define Android app delivery as a first-class product capability using Capacitor around the existing `apps/frontend` client.
- Preserve the current offline-first sync model, backend-authored sync outcomes, and React/Vite codebase as the single application implementation.
- Require explicit Android production API configuration, auth/session validation, and signed-build verification before Android support is considered ready.
- Require Android-specific lifecycle integration for app resume, reconnect, and hardware back navigation.
- Require targeted mobile hardening for viewport, keyboard, scrolling, and background behavior so the desktop-first app remains functionally usable on phones.
- Define release-readiness expectations for versioning, signing, packaging, and Play Store preparation.

## Capabilities

### New Capabilities
- `android-mobile-delivery`: Deliver the existing frontend as an Android app through Capacitor with validated auth, sync, lifecycle, UX hardening, and release-readiness requirements.

### Modified Capabilities
- None.

## Impact

- Affected frontend areas: `apps/frontend` build configuration, platform integration layer, auth/network transport, viewport/layout hardening, and release scripts.
- Affected backend areas: auth/network compatibility validation and client diagnostic intake for storage/runtime telemetry.
- Affected delivery systems: Android Gradle project, signing/release flow, Play Store packaging, and production mobile API configuration.
