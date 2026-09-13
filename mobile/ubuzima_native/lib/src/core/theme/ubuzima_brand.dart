import 'package:flutter/material.dart';

abstract final class UbuzimaBrand {
  static const blue = Color(0xFF0878C9);
  static const blueDark = Color(0xFF075F9E);

  static const green = Color(0xFF41B43D);
  static const greenDark = Color(0xFF278D31);

  static const surface = Color(0xFFF7FBF8);
  static const surfaceSoft = Color(0xFFEEF7F2);
  static const border = Color(0xFFDCE9E2);

  static const textPrimary = Color(0xFF16333F);
  static const textSecondary = Color(0xFF60756E);

  static ThemeData theme() {
    final scheme = ColorScheme.fromSeed(
      seedColor: blue,
      brightness: Brightness.light,
    ).copyWith(
      primary: blue,
      onPrimary: Colors.white,
      secondary: green,
      onSecondary: Colors.white,
      surface: Colors.white,
      onSurface: textPrimary,
      outline: border,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: surface,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: textPrimary,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        labelStyle: const TextStyle(
          color: textSecondary,
          fontWeight: FontWeight.w600,
        ),
        prefixIconColor: blue,
        suffixIconColor: textSecondary,
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: blue, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(54),
          backgroundColor: blue,
          foregroundColor: Colors.white,
          disabledBackgroundColor: const Color(0xFFB9CFDC),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: blue,
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 72,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        indicatorColor: green.withOpacity(0.14),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: green),
      textTheme: const TextTheme(
        headlineSmall: TextStyle(
          color: textPrimary,
          fontWeight: FontWeight.w800,
        ),
        titleLarge: TextStyle(color: textPrimary, fontWeight: FontWeight.w800),
        titleMedium: TextStyle(color: textPrimary, fontWeight: FontWeight.w700),
        bodyLarge: TextStyle(color: textPrimary),
        bodyMedium: TextStyle(color: textSecondary, height: 1.42),
        bodySmall: TextStyle(color: textSecondary, height: 1.35),
      ),
    );
  }
}
