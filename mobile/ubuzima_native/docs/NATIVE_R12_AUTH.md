# Ubuzima+ Native Mobile R1.2

## Architecture

Ubuzima+ Native R1 is a locally rendered Flutter application.

Its principal Android and iOS user journeys must not load
the Ubuzima+ website, PWA, Admin interface, or another web
runtime.

## Authentication

Native authentication supports:

- Email and password
- Phone and PIN
- Password reset request
- Two-factor challenge
- First-time two-factor setup
- Trusted device
- Secure session restoration
- Logout

## API transport

Authentication communicates directly with the production
Ubuzima+ Laravel API.

The authenticated transport uses Laravel Sanctum bearer
tokens.

## Security

Passwords are never persisted.

PINs are never persisted.

Access tokens and trusted-device tokens use
flutter_secure_storage so production platform builds can use
Android Keystore and iOS Keychain protected storage.

## Mobile experience

The R1 source includes:

- native startup
- native Login
- native 2FA
- native Forgot Password
- native 360 Business View shell
- native bottom navigation

POS & Sales, Inventory, Procurement, Finance and other
business modules will be connected to their respective API
contracts progressively.

No fabricated operational figures are introduced.
