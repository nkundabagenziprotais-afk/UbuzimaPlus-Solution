abstract final class ApiEndpoints {
  static const String health = '/api/v1/health';

  static const String login = '/api/v1/auth/login';

  static const String currentUser = '/api/v1/auth/me';

  static const String twoFactorVerify = '/api/v1/auth/two-factor/verify';

  static const String passwordResetRequest =
      '/api/v1/auth/password-reset-request';
}
