import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../domain/auth_models.dart';
import 'native_auth_controller.dart';

class TwoFactorScreen extends StatefulWidget {
  const TwoFactorScreen({
    required this.controller,
    required this.flow,
    super.key,
  });

  final NativeAuthController controller;

  final AuthOutcome flow;

  @override
  State<TwoFactorScreen> createState() => _TwoFactorScreenState();
}

class _TwoFactorScreenState extends State<TwoFactorScreen> {
  final _code = TextEditingController();

  bool _trustDevice = true;

  @override
  void dispose() {
    _code.dispose();

    super.dispose();
  }

  Future<void> _verify() async {
    final code = _code.text.trim();

    if (code.isEmpty) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Enter your authenticator or recovery code.'),
          ),
        );

      return;
    }

    await widget.controller.verifyTwoFactor(
      code: code,
      trustDevice: widget.flow.trustDeviceAvailable ? _trustDevice : false,
    );
  }

  Future<void> _copySecret(String secret) async {
    await Clipboard.setData(ClipboardData(text: secret));

    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Authenticator setup key copied.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final setup = widget.flow.setup;

    final busy = widget.controller.stage == NativeAuthStage.submitting;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: busy ? null : widget.controller.cancelTwoFactor,
          icon: const Icon(Icons.arrow_back),
        ),
        title: const Text('Account verification'),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(22),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 430),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(
                    Icons.verified_user_outlined,
                    size: 48,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(height: 18),
                  Text(
                    widget.flow.kind == AuthOutcomeKind.twoFactorSetup
                        ? 'Set up two-factor authentication'
                        : 'Verify your identity',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    widget.flow.message ??
                        'Enter your authenticator code to continue.',
                    textAlign: TextAlign.center,
                  ),
                  if (setup?.manualSecret != null) ...[
                    const SizedBox(height: 22),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: Theme.of(context).dividerColor,
                        ),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Authenticator setup key',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 8),
                          SelectableText(
                            setup!.manualSecret!,
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          OutlinedButton.icon(
                            onPressed: () => _copySecret(setup.manualSecret!),
                            icon: const Icon(Icons.copy),
                            label: const Text('Copy setup key'),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 22),
                  TextField(
                    controller: _code,
                    enabled: !busy,
                    autofocus: true,
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    onSubmitted: (_) => _verify(),
                    decoration: const InputDecoration(
                      labelText: 'Authenticator or recovery code',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.password_outlined),
                    ),
                  ),
                  if (widget.flow.trustDeviceAvailable)
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _trustDevice,
                      onChanged: busy
                          ? null
                          : (value) {
                              setState(() {
                                _trustDevice = value ?? false;
                              });
                            },
                      title: const Text('Trust this device'),
                      subtitle: const Text(
                        'Skip repeated verification on this approved device where permitted.',
                      ),
                    ),
                  if (widget.controller.errorMessage != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      widget.controller.errorMessage!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: busy ? null : _verify,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      child: busy
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Verify and continue'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
