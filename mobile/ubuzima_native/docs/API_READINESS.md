# Ubuzima+ Native R1 API Readiness

Audit UTC:
20260913T110246Z

## Proven production authentication endpoints

POST /api/v1/auth/login

GET /api/v1/auth/me

POST /api/v1/auth/two-factor/verify

POST /api/v1/auth/password-reset-request

## Runtime probes

Health:
200|0.536125|0.536251

Unauthenticated auth/me:
401|0.060257|0.060361

Empty Login validation:
422|0.012742|0.056598|application/json

Empty Password Reset validation:
422|0.010903|0.028035|application/json

OPTIONS/CORS:
204

## R1 decision

Authentication transport is suitable for direct native API
integration provided the next implementation step confirms
the exact successful-login response schema, 2FA response
schema, session expiry semantics, trusted-device contract,
and authorization bootstrap data.

No WebView is required for these API calls.
