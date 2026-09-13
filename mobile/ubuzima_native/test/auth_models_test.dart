import 'package:flutter_test/flutter_test.dart';
import 'package:ubuzima_native/src/features/auth/domain/auth_models.dart';

void main() {
  test(
    'authenticated login response is parsed',
    () {
      final result = AuthOutcome.fromLogin(
        <String, dynamic>{
          'access_token': 'test-token',
          'profile': <String, dynamic>{
            'user_name': 'Test User',
          },
        },
      );

      expect(
        result.kind,
        AuthOutcomeKind.authenticated,
      );

      expect(
        result.accessToken,
        'test-token',
      );
    },
  );

  test(
    'two factor challenge is parsed',
    () {
      final result = AuthOutcome.fromLogin(
        <String, dynamic>{
          'status': 'two_factor_challenge_required',
          'challenge_token': 'challenge-token',
          'trust_device_available': true,
        },
      );

      expect(
        result.kind,
        AuthOutcomeKind.twoFactorChallenge,
      );

      expect(
        result.challengeToken,
        'challenge-token',
      );

      expect(
        result.trustDeviceAvailable,
        isTrue,
      );
    },
  );
}
