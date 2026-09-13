# Ubuzima+ Native Mobile Architecture

## Product

Ubuzima+

## R1 objective

Build a real Android and iOS mobile application whose core
user interface is rendered locally on the device.

The native application communicates directly with the
existing Ubuzima+ REST API.

## Runtime architecture

Flutter UI
    |
    v
Native API client
    |
    v
https://ubuzimaplus.com/api/v1/
    |
    v
Existing Ubuzima+ backend
    |
    v
Existing production database

## Explicitly prohibited

The core application must not use:

- WebView
- flutter_inappwebview
- webview_flutter
- embedded Admin website
- embedded PWA
- iframe-style runtime
- browser navigation as the primary mobile application shell

## R1 native scope

- Splash / application bootstrap
- Email and password Login
- Phone PIN Login
- Two-factor authentication
- Forgot Password
- Secure session persistence
- Trusted-device handling
- Session expiry
- Logout
- Role and permission bootstrap
- 360 Business View
- Native bottom navigation
- Connectivity states
- Native error handling

## Existing systems retained

The current backend remains the system of record.

No new production database is introduced.

Existing authorization remains enforced server-side.

## Android identity

Target application ID:

com.ubuzimaplus.app

Production upgrade requires the same Android signing key
used by the currently distributed Ubuzima+ application.

## iOS identity

Target bundle identifier:

com.ubuzimaplus.app

Final signing and App Store/TestFlight provisioning must
take place on macOS CI or an approved macOS build host.

## Security

Passwords are never stored locally.

Production authentication tokens must use platform secure
storage:

- Android Keystore
- iOS Keychain

Biometrics may unlock an existing secured session but must
not bypass backend authentication or authorization.

## Migration principle

The existing Android/PWA applications continue operating
until the native application passes physical-device UAT.

No production customer is migrated during R1 foundation
work.
