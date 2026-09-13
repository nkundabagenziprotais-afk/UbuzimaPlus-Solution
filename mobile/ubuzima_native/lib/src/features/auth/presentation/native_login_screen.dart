import 'package:flutter/material.dart';

import '../../../shared/presentation/ubuzima_brand_logo.dart';

import '../domain/auth_models.dart';
import 'forgot_password_sheet.dart';
import 'native_auth_controller.dart';

class NativeLoginScreen extends StatefulWidget {
  const NativeLoginScreen({required this.controller, super.key});

  final NativeAuthController controller;

  @override
  State<NativeLoginScreen> createState() => _NativeLoginScreenState();
}

class _NativeLoginScreenState extends State<NativeLoginScreen> {
  LoginMethod _method = LoginMethod.email;

  final _email = TextEditingController();

  final _password = TextEditingController();

  final _phone = TextEditingController();

  final _pin = TextEditingController();

  bool _showPassword = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _phone.dispose();
    _pin.dispose();

    super.dispose();
  }

  Future<void> _submit() async {
    FocusManager.instance.primaryFocus?.unfocus();

    if (_method == LoginMethod.email) {
      if (_email.text.trim().isEmpty || _password.text.isEmpty) {
        _showLocalError('Enter your staff email address and password.');

        return;
      }

      await widget.controller.loginEmail(
        email: _email.text,
        password: _password.text,
      );

      _password.clear();
    } else {
      if (_phone.text.trim().isEmpty || _pin.text.trim().isEmpty) {
        _showLocalError('Enter your staff phone number and PIN.');

        return;
      }

      await widget.controller.loginPhone(phone: _phone.text, pin: _pin.text);

      _pin.clear();
    }
  }

  void _showLocalError(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _forgotPassword() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) {
        return ForgotPasswordSheet(
          controller: widget.controller,
          initialEmail: _email.text.trim(),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isBusy = widget.controller.stage == NativeAuthStage.submitting;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(22, 28, 22, 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 430),
              child: AutofillGroup(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _BrandHeader(),
                    const SizedBox(height: 30),
                    Text(
                      'Welcome back',
                      style: Theme.of(context)
                          .textTheme
                          .headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Sign in to continue to your secure Ubuzima+ workspace.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 24),
                    SegmentedButton<LoginMethod>(
                      segments: const [
                        ButtonSegment(
                          value: LoginMethod.email,
                          label: Text('Email'),
                          icon: Icon(Icons.mail_outline),
                        ),
                        ButtonSegment(
                          value: LoginMethod.phone,
                          label: Text('Phone'),
                          icon: Icon(Icons.phone_outlined),
                        ),
                      ],
                      selected: {_method},
                      onSelectionChanged: isBusy
                          ? null
                          : (selection) {
                              setState(() {
                                _method = selection.first;
                              });
                            },
                    ),
                    const SizedBox(height: 22),
                    if (_method == LoginMethod.email) ...[
                      TextField(
                        controller: _email,
                        enabled: !isBusy,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [
                          AutofillHints.username,
                          AutofillHints.email,
                        ],
                        decoration: const InputDecoration(
                          labelText: 'Staff email',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.mail_outline),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _password,
                        enabled: !isBusy,
                        obscureText: !_showPassword,
                        textInputAction: TextInputAction.done,
                        autofillHints: const [AutofillHints.password],
                        onSubmitted: (_) => _submit(),
                        decoration: InputDecoration(
                          labelText: 'Password',
                          border: const OutlineInputBorder(),
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            onPressed: isBusy
                                ? null
                                : () {
                                    setState(() {
                                      _showPassword = !_showPassword;
                                    });
                                  },
                            icon: Icon(
                              _showPassword
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                            ),
                          ),
                        ),
                      ),
                    ] else ...[
                      TextField(
                        controller: _phone,
                        enabled: !isBusy,
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.telephoneNumber],
                        decoration: const InputDecoration(
                          labelText: 'Staff phone number',
                          hintText: '+250...',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.phone_outlined),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _pin,
                        enabled: !isBusy,
                        obscureText: true,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        maxLength: 6,
                        onSubmitted: (_) => _submit(),
                        decoration: const InputDecoration(
                          labelText: 'Staff PIN',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.pin_outlined),
                        ),
                      ),
                    ],
                    if (widget.controller.errorMessage != null) ...[
                      const SizedBox(height: 14),
                      _ErrorPanel(message: widget.controller.errorMessage!),
                    ],
                    const SizedBox(height: 18),
                    FilledButton(
                      onPressed: isBusy ? null : _submit,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        child: isBusy
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text('Sign in securely'),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: isBusy ? null : _forgotPassword,
                      child: const Text('Forgot password?'),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Secure access · Role based · Activity protected',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _BrandHeader extends StatelessWidget {
  const _BrandHeader();

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Column(
      children: [
        const UbuzimaBrandLogo(width: 226),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: colors.secondary.withOpacity(0.10),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            "Secure health business workspace",
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colors.secondary,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ),
      ],
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(message, style: TextStyle(color: colors.onErrorContainer)),
    );
  }
}
