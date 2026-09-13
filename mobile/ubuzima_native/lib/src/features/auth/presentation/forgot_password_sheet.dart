import 'package:flutter/material.dart';

import 'native_auth_controller.dart';

class ForgotPasswordSheet extends StatefulWidget {
  const ForgotPasswordSheet({
    required this.controller,
    this.initialEmail = '',
    super.key,
  });

  final NativeAuthController controller;

  final String initialEmail;

  @override
  State<ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends State<ForgotPasswordSheet> {
  late final TextEditingController _email;

  bool _busy = false;

  String? _message;

  String? _error;

  @override
  void initState() {
    super.initState();

    _email = TextEditingController(
      text: widget.initialEmail,
    );
  }

  @override
  void dispose() {
    _email.dispose();

    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();

    if (email.isEmpty) {
      setState(
        () {
          _error = 'Enter your staff email address.';
        },
      );

      return;
    }

    setState(
      () {
        _busy = true;
        _error = null;
        _message = null;
      },
    );

    try {
      final result = await widget.controller.requestPasswordReset(
        email,
      );

      if (!mounted) {
        return;
      }

      setState(
        () {
          _message = result;
        },
      );
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(
        () {
          _error = error.toString();
        },
      );
    } finally {
      if (mounted) {
        setState(
          () {
            _busy = false;
          },
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.viewInsetsOf(
      context,
    );

    return Padding(
      padding: EdgeInsets.fromLTRB(
        22,
        22,
        22,
        22 + inset.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Reset password',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Enter your registered staff email address.',
          ),
          const SizedBox(height: 18),
          TextField(
            controller: _email,
            enabled: !_busy,
            keyboardType: TextInputType.emailAddress,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'Staff email',
              border: OutlineInputBorder(),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: TextStyle(
                color: Theme.of(context).colorScheme.error,
              ),
            ),
          ],
          if (_message != null) ...[
            const SizedBox(height: 12),
            Text(_message!),
          ],
          const SizedBox(height: 18),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: Text(
              _busy ? 'Submitting...' : 'Request reset',
            ),
          ),
        ],
      ),
    );
  }
}
