import 'package:flutter/material.dart';

import '../../../core/network/native_api_client.dart';
import '../../../core/security/secure_session_store.dart';
import '../../home/presentation/native_home_screen.dart';
import '../data/auth_repository.dart';
import 'native_auth_controller.dart';
import 'native_login_screen.dart';
import 'two_factor_screen.dart';

class AuthGate extends StatefulWidget {
  const AuthGate({
    super.key,
  });

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  late final NativeAuthController _controller;

  @override
  void initState() {
    super.initState();

    _controller = NativeAuthController(
      repository: AuthRepository(
        api: NativeApiClient(),
        store: SecureSessionStore(),
      ),
    );

    _controller.addListener(
      _refresh,
    );

    _controller.bootstrap();
  }

  void _refresh() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_refresh);

    _controller.dispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    switch (_controller.stage) {
      case NativeAuthStage.bootstrapping:
        return const _NativeStartup();

      case NativeAuthStage.signedOut:
        return NativeLoginScreen(
          controller: _controller,
        );

      case NativeAuthStage.twoFactor:
        final flow = _controller.pendingTwoFactor;

        if (flow == null) {
          return NativeLoginScreen(
            controller: _controller,
          );
        }

        return TwoFactorScreen(
          controller: _controller,
          flow: flow,
        );

      case NativeAuthStage.signedIn:
        return NativeHomeScreen(
          controller: _controller,
          profile: _controller.profile ?? const <String, dynamic>{},
          offline: _controller.offlineSession,
        );

      case NativeAuthStage.submitting:
        if (_controller.pendingTwoFactor != null) {
          return TwoFactorScreen(
            controller: _controller,
            flow: _controller.pendingTwoFactor!,
          );
        }

        return NativeLoginScreen(
          controller: _controller,
        );
    }
  }
}

class _NativeStartup extends StatelessWidget {
  const _NativeStartup();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Ubuzima+',
                style: TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                ),
              ),
              SizedBox(height: 18),
              SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
