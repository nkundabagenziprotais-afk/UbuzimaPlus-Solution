# Login Hardening Notes

Production login must not ship demo credentials, default passwords, or visible environment/workspace choices that confuse staff.

Current policy:
- No hardcoded staff email or password in frontend source.
- No prefilled password fields in production.
- Browser password managers may still autofill saved passwords; production password reset invalidates old saved credentials.
- Staff workspace selection should be handled by backend role/tenant assignment after authentication, not by an unprofessional public-facing selector.
- Existing API tokens should be revoked after resetting any known/default admin password.
