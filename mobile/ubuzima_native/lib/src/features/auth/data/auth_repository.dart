import '../../../core/network/native_api_client.dart';
import '../../../core/security/secure_session_store.dart';
import '../domain/auth_models.dart';

class AuthRepository {
  AuthRepository({
    required NativeApiClient api,
    required SecureSessionStore store,
  })  : _api = api,
        _store = store;

  final NativeApiClient _api;
  final SecureSessionStore _store;

  static const _deviceName = 'Ubuzima+ Native Mobile';

  Future<AuthOutcome> loginWithEmail({
    required String email,
    required String password,
  }) {
    return _login(
      <String, dynamic>{
        'login_method': 'email',
        'email': email.trim(),
        'password': password,
      },
    );
  }

  Future<AuthOutcome> loginWithPhone({
    required String phone,
    required String pin,
  }) {
    return _login(
      <String, dynamic>{
        'login_method': 'phone',
        'phone': phone.trim(),
        'pin': pin,
      },
    );
  }

  Future<AuthOutcome> _login(
    Map<String, dynamic> credentials,
  ) async {
    final trustedDeviceToken = await _store.readTrustedDeviceToken();

    final payload = <String, dynamic>{
      ...credentials,
      'device_name': _deviceName,
      if (trustedDeviceToken != null && trustedDeviceToken.isNotEmpty)
        'trusted_device_token': trustedDeviceToken,
    };

    final response = await _api.post(
      '/api/v1/auth/login',
      body: payload,
    );

    final outcome = AuthOutcome.fromLogin(
      response,
    );

    await _persistIfAuthenticated(
      outcome,
    );

    return outcome;
  }

  Future<AuthOutcome> verifyTwoFactor({
    required String challengeToken,
    required String code,
    required bool trustDevice,
  }) async {
    final response = await _api.post(
      '/api/v1/auth/two-factor/verify',
      body: <String, dynamic>{
        'challenge_token': challengeToken,
        'code': code.trim(),
        'trust_device': trustDevice,
        'device_name': _deviceName,
      },
    );

    final outcome = AuthOutcome.fromTwoFactor(
      response,
    );

    await _persistIfAuthenticated(
      outcome,
    );

    if (outcome.trustedDeviceToken != null) {
      await _store.saveTrustedDeviceToken(
        outcome.trustedDeviceToken!,
      );
    }

    return outcome;
  }

  Future<String> requestPasswordReset(
    String email,
  ) async {
    final response = await _api.post(
      '/api/v1/auth/password-reset-request',
      body: <String, dynamic>{
        'email': email.trim(),
      },
    );

    return response['message']?.toString().trim() ??
        'Password reset request submitted.';
  }

  Future<SessionBootstrap?> restoreSession() async {
    final token = await _store.readAccessToken();

    if (token == null || token.trim().isEmpty) {
      return null;
    }

    try {
      final response = await _api.get(
        '/api/v1/auth/me',
        bearerToken: token,
      );

      final profile = _profileFromMe(response);

      if (profile == null) {
        await _store.clearSession();

        return null;
      }

      await _store.saveAuthenticatedSession(
        accessToken: token,
        profile: profile,
      );

      return SessionBootstrap(
        profile: profile,
        offline: false,
      );
    } on ApiException catch (error) {
      if (error.statusCode == 401) {
        await _store.clearSession();

        return null;
      }

      if (error.statusCode == 0 || error.statusCode == 408) {
        final cached = await _store.readCachedProfile();

        if (cached != null) {
          return SessionBootstrap(
            profile: cached,
            offline: true,
          );
        }
      }

      rethrow;
    }
  }

  Future<void> logout() async {
    final token = await _store.readAccessToken();

    try {
      if (token != null && token.trim().isNotEmpty) {
        await _api.post(
          '/api/v1/auth/logout',
          bearerToken: token,
        );
      }
    } finally {
      /*
       * Keep the trusted-device token.
       * This matches its purpose:
       * the device may remain trusted after
       * the active API session is closed.
       */
      await _store.clearSession();
    }
  }

  Future<void> forgetTrustedDevice() async {
    await _store.clearSession(
      clearTrustedDevice: true,
    );
  }

  Future<void> _persistIfAuthenticated(
    AuthOutcome outcome,
  ) async {
    if (outcome.kind != AuthOutcomeKind.authenticated) {
      return;
    }

    final token = outcome.accessToken;

    final profile = outcome.profile;

    if (token == null || profile == null) {
      throw const FormatException(
        'Authenticated response is incomplete.',
      );
    }

    await _store.saveAuthenticatedSession(
      accessToken: token,
      profile: profile,
    );
  }

  Map<String, dynamic>? _profileFromMe(
    Map<String, dynamic> response,
  ) {
    final profile = response['profile'];

    if (profile is Map<String, dynamic>) {
      return profile;
    }

    if (profile is Map) {
      return profile.map(
        (key, dynamic value) => MapEntry(
          key.toString(),
          value,
        ),
      );
    }

    return null;
  }
}
