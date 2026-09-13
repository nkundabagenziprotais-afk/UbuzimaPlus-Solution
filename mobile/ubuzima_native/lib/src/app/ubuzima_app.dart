import 'package:flutter/material.dart';

import '../core/theme/ubuzima_brand.dart';
import '../features/auth/presentation/auth_gate.dart';

class UbuzimaApp extends StatelessWidget {
  const UbuzimaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ubuzima+',
      debugShowCheckedModeBanner: false,
      theme: UbuzimaBrand.theme(),
      home: const AuthGate(),
    );
  }
}
