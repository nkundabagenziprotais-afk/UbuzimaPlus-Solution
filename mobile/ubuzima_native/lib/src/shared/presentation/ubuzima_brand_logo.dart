import 'package:flutter/material.dart';

class UbuzimaBrandLogo extends StatelessWidget {
  const UbuzimaBrandLogo({
    this.width = 220,
    this.alignment = Alignment.center,
    super.key,
  });

  final double width;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Ubuzima+',
      image: true,
      child: Align(
        alignment: alignment,
        child: Image.asset(
          'assets/branding/ubuzima-logo.png',
          width: width,
          fit: BoxFit.contain,
          filterQuality: FilterQuality.high,
          excludeFromSemantics: true,
        ),
      ),
    );
  }
}
