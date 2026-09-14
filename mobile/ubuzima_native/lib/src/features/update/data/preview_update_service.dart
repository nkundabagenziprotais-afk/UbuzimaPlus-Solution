import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';

class PreviewUpdateManifest {
  const PreviewUpdateManifest({
    required this.enabled,
    required this.platform,
    required this.packageName,
    required this.versionCode,
    required this.versionName,
    required this.minimumSupportedVersionCode,
    required this.mandatory,
    required this.downloadUrl,
    required this.sha256,
    required this.bytes,
    required this.releaseNotes,
    required this.publishedAt,
  });

  static const expectedPackageName = 'com.ubuzimaplus.preview';

  final bool enabled;
  final String platform;
  final String packageName;
  final int versionCode;
  final String versionName;
  final int minimumSupportedVersionCode;
  final bool mandatory;
  final String downloadUrl;
  final String sha256;
  final int bytes;
  final List<String> releaseNotes;
  final String? publishedAt;

  factory PreviewUpdateManifest.fromJson(
    Map<String, dynamic> json,
  ) {
    String stringValue(
      Object? value, {
      required String field,
      bool allowEmpty = false,
    }) {
      final result = value?.toString().trim() ?? '';

      if (!allowEmpty && result.isEmpty) {
        throw FormatException(
          'Update manifest field "$field" is required.',
        );
      }

      return result;
    }

    int intValue(
      Object? value, {
      required String field,
      int fallback = 0,
    }) {
      if (value == null) {
        return fallback;
      }

      if (value is int) {
        return value;
      }

      if (value is num) {
        return value.toInt();
      }

      final parsed = int.tryParse(value.toString());

      if (parsed == null) {
        throw FormatException(
          'Update manifest field "$field" must be an integer.',
        );
      }

      return parsed;
    }

    final enabled = json['enabled'] != false;

    final platform = stringValue(
      json['platform'] ?? 'android',
      field: 'platform',
    ).toLowerCase();

    final packageName = stringValue(
      json['application_id'] ?? json['packageName'],
      field: 'application_id',
    );

    final versionCode = intValue(
      json['version_code'] ?? json['versionCode'],
      field: 'version_code',
    );

    final versionName = stringValue(
      json['version_name'] ?? json['versionName'],
      field: 'version_name',
    );

    final minimumSupportedVersionCode = intValue(
      json['minimum_supported_version_code'] ??
          json['minimumSupportedVersionCode'],
      field: 'minimum_supported_version_code',
    );

    final mandatory = json['mandatory'] == true;

    final downloadUrl = stringValue(
      json['download_url'] ?? json['apkUrl'],
      field: 'download_url',
    );

    final normalizedSha = stringValue(
      json['sha256'],
      field: 'sha256',
    ).toLowerCase();

    final bytes = intValue(
      json['bytes'],
      field: 'bytes',
    );

    final publishedAt = stringValue(
      json['published_at'] ?? json['publishedAt'],
      field: 'published_at',
      allowEmpty: true,
    );

    final rawReleaseNotes = json['release_notes'] ?? json['releaseNotes'];

    final releaseNotes = <String>[];

    if (rawReleaseNotes is List) {
      for (final note in rawReleaseNotes) {
        final value = note?.toString().trim() ?? '';

        if (value.isNotEmpty) {
          releaseNotes.add(value);
        }
      }
    }

    final message = json['message']?.toString().trim() ?? '';

    if (releaseNotes.isEmpty && message.isNotEmpty) {
      releaseNotes.add(message);
    }

    if (platform != 'android') {
      throw const FormatException(
        'Preview update manifest must target Android.',
      );
    }

    if (packageName != expectedPackageName) {
      throw const FormatException(
        'Preview update package identity does not match.',
      );
    }

    if (versionCode <= 0) {
      throw const FormatException(
        'Preview update versionCode must be positive.',
      );
    }

    if (!RegExp(r'^[0-9a-f]{64}$').hasMatch(normalizedSha)) {
      throw const FormatException(
        'Preview update SHA256 is invalid.',
      );
    }

    if (bytes < 0 || bytes > 45000000) {
      throw const FormatException(
        'Preview update byte size is outside the release gate.',
      );
    }

    final uri = Uri.tryParse(downloadUrl);

    if (uri == null ||
        uri.scheme.toLowerCase() != 'https' ||
        uri.host.toLowerCase() != 'ubuzimaplus.com' ||
        !uri.path.startsWith('/downloads/')) {
      throw const FormatException(
        'Preview update download URL is not approved.',
      );
    }

    return PreviewUpdateManifest(
      enabled: enabled,
      platform: platform,
      packageName: packageName,
      versionCode: versionCode,
      versionName: versionName,
      minimumSupportedVersionCode: minimumSupportedVersionCode,
      mandatory: mandatory,
      downloadUrl: downloadUrl,
      sha256: normalizedSha,
      bytes: bytes,
      releaseNotes: List<String>.unmodifiable(releaseNotes),
      publishedAt: publishedAt.isEmpty ? null : publishedAt,
    );
  }

  bool isNewerThan(int currentVersionCode) {
    return enabled && versionCode > currentVersionCode;
  }
}

class PreviewAppInfo {
  const PreviewAppInfo({
    required this.packageName,
    required this.versionCode,
    required this.versionName,
  });

  final String packageName;
  final int versionCode;
  final String versionName;

  factory PreviewAppInfo.fromMap(
    Map<Object?, Object?> value,
  ) {
    return PreviewAppInfo(
      packageName: value['packageName']?.toString() ?? '',
      versionCode: (value['versionCode'] as num?)?.toInt() ?? 0,
      versionName: value['versionName']?.toString() ?? '',
    );
  }
}

class PreviewUpdateCheck {
  const PreviewUpdateCheck({
    this.current,
    this.available,
    this.notPublished = false,
    this.unsupportedPlatform = false,
  });

  final PreviewAppInfo? current;
  final PreviewUpdateManifest? available;
  final bool notPublished;
  final bool unsupportedPlatform;
}

class PreviewPreparedUpdate {
  const PreviewPreparedUpdate({
    required this.path,
    required this.bytes,
  });

  final String path;
  final int bytes;
}

class PreviewUpdateService {
  const PreviewUpdateService();

  static const manifestUrl =
      'https://ubuzimaplus.com/downloads/preview-update.json';

  static const MethodChannel _channel =
      MethodChannel('com.ubuzimaplus.preview/update');

  Future<PreviewUpdateCheck> check() async {
    if (!Platform.isAndroid) {
      return const PreviewUpdateCheck(
        unsupportedPlatform: true,
      );
    }

    final currentMap = await _channel.invokeMapMethod<Object?, Object?>(
      'getAppInfo',
    );

    if (currentMap == null) {
      throw StateError(
        'Unable to read the installed Preview identity.',
      );
    }

    final current = PreviewAppInfo.fromMap(currentMap);

    if (current.packageName != PreviewUpdateManifest.expectedPackageName) {
      throw StateError(
        'Preview updater is disabled for this application identity.',
      );
    }

    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 12);

    try {
      final request = await client.getUrl(Uri.parse(manifestUrl));

      request.headers.set(
        HttpHeaders.acceptHeader,
        'application/json',
      );

      final response = await request.close();

      if (response.statusCode == HttpStatus.notFound) {
        await response.drain<void>();

        return PreviewUpdateCheck(
          current: current,
          notPublished: true,
        );
      }

      if (response.statusCode != HttpStatus.ok) {
        await response.drain<void>();

        throw HttpException(
          'Preview update check returned HTTP '
          '${response.statusCode}.',
        );
      }

      final body = await utf8.decoder.bind(response).join();

      if (body.length > 65536) {
        throw const FormatException(
          'Preview update manifest is unexpectedly large.',
        );
      }

      final decoded = jsonDecode(body);

      if (decoded is! Map) {
        throw const FormatException(
          'Preview update manifest must be a JSON object.',
        );
      }

      final manifest = PreviewUpdateManifest.fromJson(
        Map<String, dynamic>.from(decoded),
      );

      if (!manifest.isNewerThan(
        current.versionCode,
      )) {
        return PreviewUpdateCheck(
          current: current,
        );
      }

      return PreviewUpdateCheck(
        current: current,
        available: manifest,
      );
    } finally {
      client.close(force: true);
    }
  }

  Future<PreviewPreparedUpdate> prepare(
    PreviewUpdateManifest manifest,
  ) async {
    if (!Platform.isAndroid) {
      throw UnsupportedError(
        'Preview APK updates are Android-only.',
      );
    }

    final result = await _channel.invokeMapMethod<Object?, Object?>(
      'prepareUpdate',
      <String, Object?>{
        'downloadUrl': manifest.downloadUrl,
        'sha256': manifest.sha256,
        'expectedBytes': manifest.bytes,
      },
    );

    if (result == null) {
      throw StateError(
        'Android did not return a prepared update.',
      );
    }

    final path = result['path']?.toString() ?? '';
    final bytes = (result['bytes'] as num?)?.toInt() ?? 0;

    if (path.isEmpty || bytes <= 0) {
      throw StateError(
        'Prepared Preview update is incomplete.',
      );
    }

    return PreviewPreparedUpdate(
      path: path,
      bytes: bytes,
    );
  }

  Future<String> installPrepared({
    required String path,
    required String sha256,
  }) async {
    final status = await _channel.invokeMethod<String>(
      'installPrepared',
      <String, Object?>{
        'path': path,
        'sha256': sha256,
      },
    );

    return status ?? 'unknown';
  }

  Future<void> openInstallPermission() async {
    await _channel.invokeMethod<void>(
      'openInstallPermission',
    );
  }
}
