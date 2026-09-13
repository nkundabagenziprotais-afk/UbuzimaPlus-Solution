import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureSessionStore {
  SecureSessionStore({
    FlutterSecureStorage? storage,
  }) : _storage = storage ?? const FlutterSecureStorage();

  static const _accessTokenKey = 'ubuzima.native.access_token';

  static const _trustedDeviceTokenKey = 'ubuzima.native.trusted_device_token';

  static const _profileKey = 'ubuzima.native.profile';

  final FlutterSecureStorage _storage;

  Future<String?> readAccessToken() {
    return _storage.read(
      key: _accessTokenKey,
    );
  }

  Future<String?> readTrustedDeviceToken() {
    return _storage.read(
      key: _trustedDeviceTokenKey,
    );
  }

  Future<Map<String, dynamic>?> readCachedProfile() async {
    final raw = await _storage.read(
      key: _profileKey,
    );

    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      final parsed = jsonDecode(raw);

      if (parsed is Map<String, dynamic>) {
        return parsed;
      }
    } catch (_) {}

    return null;
  }

  Future<void> saveAuthenticatedSession({
    required String accessToken,
    required Map<String, dynamic> profile,
  }) async {
    await _storage.write(
      key: _accessTokenKey,
      value: accessToken,
    );

    await _storage.write(
      key: _profileKey,
      value: jsonEncode(profile),
    );
  }

  Future<void> saveTrustedDeviceToken(
    String token,
  ) async {
    if (token.trim().isEmpty) {
      return;
    }

    await _storage.write(
      key: _trustedDeviceTokenKey,
      value: token.trim(),
    );
  }

  Future<void> clearSession({
    bool clearTrustedDevice = false,
  }) async {
    await _storage.delete(
      key: _accessTokenKey,
    );

    await _storage.delete(
      key: _profileKey,
    );

    if (clearTrustedDevice) {
      await _storage.delete(
        key: _trustedDeviceTokenKey,
      );
    }
  }
}
