import 'package:flutter/foundation.dart';

import '../../../core/network/native_api_client.dart';
import '../data/auth_repository.dart';
import '../domain/auth_models.dart';

enum NativeAuthStage {
  bootstrapping,
  signedOut,
  submitting,
  twoFactor,
  signedIn,
}

class NativeAuthController extends ChangeNotifier {
  NativeAuthController({
    required AuthRepository repository,
  }) : _repository = repository;

  final AuthRepository _repository;

  NativeAuthStage stage = NativeAuthStage.bootstrapping;

  Map<String, dynamic>? profile;

  AuthOutcome? pendingTwoFactor;

  String? errorMessage;

  String? noticeMessage;

  bool offlineSession = false;

  Future<void> bootstrap() async {
    stage = NativeAuthStage.bootstrapping;

    errorMessage = null;

    notifyListeners();

    try {
      final session = await _repository.restoreSession();

      if (session == null) {
        stage = NativeAuthStage.signedOut;

        profile = null;
      } else {
        profile = session.profile;

        offlineSession = session.offline;

        stage = NativeAuthStage.signedIn;
      }
    } catch (error) {
      stage = NativeAuthStage.signedOut;

      errorMessage = _friendlyError(error);
    }

    notifyListeners();
  }

  Future<void> loginEmail({
    required String email,
    required String password,
  }) async {
    await _runLogin(
      () => _repository.loginWithEmail(
        email: email,
        password: password,
      ),
    );
  }

  Future<void> loginPhone({
    required String phone,
    required String pin,
  }) async {
    await _runLogin(
      () => _repository.loginWithPhone(
        phone: phone,
        pin: pin,
      ),
    );
  }

  Future<void> _runLogin(
    Future<AuthOutcome> Function() action,
  ) async {
    stage = NativeAuthStage.submitting;

    errorMessage = null;
    noticeMessage = null;
    pendingTwoFactor = null;

    notifyListeners();

    try {
      final outcome = await action();

      if (outcome.kind == AuthOutcomeKind.authenticated) {
        profile = outcome.profile;

        offlineSession = false;

        stage = NativeAuthStage.signedIn;

        return;
      }

      pendingTwoFactor = outcome;

      stage = NativeAuthStage.twoFactor;
    } catch (error) {
      errorMessage = _friendlyError(error);

      stage = NativeAuthStage.signedOut;
    } finally {
      notifyListeners();
    }
  }

  Future<void> verifyTwoFactor({
    required String code,
    required bool trustDevice,
  }) async {
    final pending = pendingTwoFactor;

    final challengeToken = pending?.challengeToken;

    if (challengeToken == null || challengeToken.isEmpty) {
      errorMessage = 'The verification challenge has expired. Sign in again.';

      stage = NativeAuthStage.signedOut;

      pendingTwoFactor = null;

      notifyListeners();

      return;
    }

    stage = NativeAuthStage.submitting;

    errorMessage = null;

    notifyListeners();

    try {
      final outcome = await _repository.verifyTwoFactor(
        challengeToken: challengeToken,
        code: code,
        trustDevice: trustDevice,
      );

      profile = outcome.profile;

      pendingTwoFactor = null;

      offlineSession = false;

      stage = NativeAuthStage.signedIn;
    } catch (error) {
      errorMessage = _friendlyError(error);

      stage = NativeAuthStage.twoFactor;
    } finally {
      notifyListeners();
    }
  }

  Future<String> requestPasswordReset(
    String email,
  ) {
    return _repository.requestPasswordReset(email);
  }

  void cancelTwoFactor() {
    pendingTwoFactor = null;

    errorMessage = null;

    stage = NativeAuthStage.signedOut;

    notifyListeners();
  }

  Future<void> logout() async {
    try {
      await _repository.logout();
    } finally {
      profile = null;

      pendingTwoFactor = null;

      offlineSession = false;

      stage = NativeAuthStage.signedOut;

      notifyListeners();
    }
  }

  String _friendlyError(
    Object error,
  ) {
    if (error is ApiException) {
      return error.message;
    }

    if (error is FormatException) {
      return error.message;
    }

    return 'Ubuzima+ could not complete authentication. Please try again.';
  }
}
