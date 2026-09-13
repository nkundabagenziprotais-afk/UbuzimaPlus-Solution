enum LoginMethod { email, phone }

enum AuthOutcomeKind { authenticated, twoFactorChallenge, twoFactorSetup }

class AuthOutcome {
  const AuthOutcome({
    required this.kind,
    this.accessToken,
    this.profile,
    this.message,
    this.challengeToken,
    this.expiresAt,
    this.deliveryMethods = const <String>[],
    this.trustDeviceAvailable = false,
    this.setup,
    this.recoveryCodes = const <String>[],
    this.trustedDeviceToken,
  });

  final AuthOutcomeKind kind;

  final String? accessToken;

  final Map<String, dynamic>? profile;

  final String? message;

  final String? challengeToken;

  final String? expiresAt;

  final List<String> deliveryMethods;

  final bool trustDeviceAvailable;

  final TwoFactorSetup? setup;

  final List<String> recoveryCodes;

  final String? trustedDeviceToken;

  factory AuthOutcome.fromLogin(Map<String, dynamic> data) {
    final token = _stringValue(data['access_token']);

    final profile = _mapValue(data['profile']);

    if (token != null && profile != null) {
      return AuthOutcome(
        kind: AuthOutcomeKind.authenticated,
        accessToken: token,
        profile: profile,
        message: _stringValue(data['message']),
      );
    }

    final status = _stringValue(data['status']);

    final challenge = _stringValue(data['challenge_token']);

    if (status == 'two_factor_setup_required') {
      return AuthOutcome(
        kind: AuthOutcomeKind.twoFactorSetup,
        challengeToken: challenge,
        expiresAt: _stringValue(data['expires_at']),
        message: _stringValue(data['message']),
        setup: TwoFactorSetup.fromDynamic(data['setup']),
      );
    }

    if (status == 'two_factor_challenge_required') {
      return AuthOutcome(
        kind: AuthOutcomeKind.twoFactorChallenge,
        challengeToken: challenge,
        expiresAt: _stringValue(data['expires_at']),
        message: _stringValue(data['message']),
        deliveryMethods: _stringList(data['delivery_methods']),
        trustDeviceAvailable: data['trust_device_available'] == true,
      );
    }

    throw const FormatException(
      'Login response did not contain a supported authentication state.',
    );
  }

  factory AuthOutcome.fromTwoFactor(Map<String, dynamic> data) {
    final token = _stringValue(data['access_token']);

    final profile = _mapValue(data['profile']);

    if (token == null || profile == null) {
      throw const FormatException(
        'Two-factor verification did not return an authenticated session.',
      );
    }

    String? trustedDeviceToken;

    final trusted = data['trusted_device'];

    if (trusted is Map) {
      trustedDeviceToken = _stringValue(trusted['trusted_device_token']);
    }

    return AuthOutcome(
      kind: AuthOutcomeKind.authenticated,
      accessToken: token,
      profile: profile,
      message: _stringValue(data['message']),
      recoveryCodes: _stringList(data['recovery_codes']),
      trustedDeviceToken: trustedDeviceToken,
    );
  }
}

class TwoFactorSetup {
  const TwoFactorSetup({
    this.type,
    this.issuer,
    this.account,
    this.manualSecret,
    this.otpAuthUri,
  });

  final String? type;
  final String? issuer;
  final String? account;
  final String? manualSecret;
  final String? otpAuthUri;

  static TwoFactorSetup? fromDynamic(dynamic value) {
    if (value is! Map) {
      return null;
    }

    return TwoFactorSetup(
      type: _stringValue(value['type']),
      issuer: _stringValue(value['issuer']),
      account: _stringValue(value['account']),
      manualSecret: _stringValue(value['manual_secret']),
      otpAuthUri: _stringValue(value['otpauth_uri']),
    );
  }
}

class SessionBootstrap {
  const SessionBootstrap({required this.profile, required this.offline});

  final Map<String, dynamic> profile;

  final bool offline;
}

String? _stringValue(dynamic value) {
  if (value == null) {
    return null;
  }

  final result = value.toString().trim();

  return result.isEmpty ? null : result;
}

Map<String, dynamic>? _mapValue(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }

  if (value is Map) {
    return value.map((key, dynamic entry) => MapEntry(key.toString(), entry));
  }

  return null;
}

List<String> _stringList(dynamic value) {
  if (value is! List) {
    return const <String>[];
  }

  return value
      .map((item) => item.toString().trim())
      .where((item) => item.isNotEmpty)
      .toList(growable: false);
}
