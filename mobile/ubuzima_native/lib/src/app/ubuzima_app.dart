import 'package:flutter/material.dart';

import '../features/auth/presentation/auth_gate.dart';

class UbuzimaApp extends StatelessWidget {
  const UbuzimaApp({
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ubuzima+',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(
            0xFF0C78C8,
          ),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(
          0xFFF8FAFC,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      home: const AuthGate(),
    );
  }
}
