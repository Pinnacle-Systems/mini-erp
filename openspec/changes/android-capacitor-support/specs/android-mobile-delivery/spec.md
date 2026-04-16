## ADDED Requirements

### Requirement: Package The Existing Frontend As The Android App
The system SHALL deliver Android support by packaging the existing `apps/frontend` client through Capacitor rather than introducing a separate Android application implementation.

#### Scenario: Android app uses the existing frontend
- **WHEN** Android support is implemented
- **THEN** the Android app uses the existing React/Vite frontend as its application UI
- **AND** Capacitor is limited to packaging and platform integration responsibilities

### Requirement: Android Must Support Explicit Production API Configuration
The system SHALL support an explicit Android production API base URL so Android builds do not depend on browser dev proxy assumptions.

#### Scenario: Android build runs against a production backend
- **WHEN** the app runs as a native Android build
- **THEN** the frontend can resolve requests against an Android-specific configured API base URL

### Requirement: Auth Validation Is A Release Gate
The system SHALL not treat Android support as release-ready until Android builds have validated login, refresh, logout, and repeated cold-start session continuity against the real backend.

#### Scenario: Session behavior is evaluated for Android readiness
- **WHEN** the team evaluates whether Android support is ready for release
- **THEN** signed Android builds must demonstrate stable login and refresh behavior
- **AND** repeated cold starts must not force unexpected re-authentication loops under normal conditions

### Requirement: Android Must Integrate Lifecycle And Back Navigation
The system SHALL integrate Android-specific lifecycle and navigation behavior needed for operational usability.

#### Scenario: App resumes or reconnects
- **WHEN** the Android app resumes from background or regains connectivity
- **THEN** the app triggers sync behavior once session and business context are ready

#### Scenario: User presses the Android back button
- **WHEN** the user presses the Android hardware back button
- **THEN** the app navigates backward within the current route stack when possible
- **AND** the app exits only when the user is already at the root app route

### Requirement: Android Must Preserve The Existing Sync Model
The system SHALL preserve the existing offline-first sync architecture for Android support.

#### Scenario: Android client performs sync
- **WHEN** the Android client creates, stores, or replays offline work
- **THEN** it continues using the existing synced-entity and queued-mutation model
- **AND** sync outcomes and rejection semantics remain backend-authored

### Requirement: Android Must Meet Minimum Mobile Hardening Requirements
The system SHALL address Android-specific viewport, keyboard, scrolling, and background issues that would otherwise make the desktop-first app unusable on phones.

#### Scenario: User opens the app on a phone-sized Android device
- **WHEN** key workflows are used on Android
- **THEN** layouts avoid unsafe viewport sizing that causes visible clipping or browser-chrome overlap
- **AND** primary content remains reachable while the keyboard is open
- **AND** background or resize transitions do not expose obvious white flashes or broken shell behavior

### Requirement: Android Release Pipeline Must Support Store Packaging
The system SHALL support Android release packaging with repeatable versioning suitable for Play Store submission.

#### Scenario: Team prepares an Android release
- **WHEN** an Android release build is prepared
- **THEN** the release process can produce an Android app bundle
- **AND** the Android `versionCode` is incremented for each release build
- **AND** the Android `versionName` stays aligned with the app release version
