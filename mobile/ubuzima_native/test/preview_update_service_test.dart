import 'package:flutter_test/flutter_test.dart';
import 'package:ubuzima_native/src/features/update/data/preview_update_service.dart';

Map<String, dynamic> validManifest() {
  return <String, dynamic>{
    'enabled': true,
    'platform': 'android',
    'application_id': 'com.ubuzimaplus.preview',
    'version_code': 32005,
    'version_name': '3.2.0-rc.5',
    'minimum_supported_version_code': 32004,
    'mandatory': false,
    'download_url': 'https://ubuzimaplus.com/downloads/'
        'ubuzima-plus-preview-3.2.0-rc5.apk',
    'sha256': List<String>.filled(64, 'a').join(),
    'bytes': 18000000,
    'release_notes': <String>[
      'Native Preview update test.',
    ],
    'published_at': '2026-09-14T00:00:00Z',
  };
}

void main() {
  test(
    'valid Preview manifest uses integer versionCode',
    () {
      final manifest = PreviewUpdateManifest.fromJson(
        validManifest(),
      );

      expect(
        manifest.packageName,
        'com.ubuzimaplus.preview',
      );

      expect(manifest.versionCode, 32005);
      expect(manifest.isNewerThan(32004), isTrue);
      expect(manifest.isNewerThan(32005), isFalse);
    },
  );

  test('commercial package is rejected', () {
    final json = validManifest()..['application_id'] = 'com.ubuzimaplus.app';

    expect(
      () => PreviewUpdateManifest.fromJson(json),
      throwsFormatException,
    );
  });

  test('non HTTPS download is rejected', () {
    final json = validManifest()
      ..['download_url'] = 'http://ubuzimaplus.com/downloads/update.apk';

    expect(
      () => PreviewUpdateManifest.fromJson(json),
      throwsFormatException,
    );
  });

  test('external download host is rejected', () {
    final json = validManifest()
      ..['download_url'] = 'https://example.com/update.apk';

    expect(
      () => PreviewUpdateManifest.fromJson(json),
      throwsFormatException,
    );
  });

  test('invalid SHA256 is rejected', () {
    final json = validManifest()..['sha256'] = 'bad-sha';

    expect(
      () => PreviewUpdateManifest.fromJson(json),
      throwsFormatException,
    );
  });

  test('mandatory state is explicit only', () {
    final json = validManifest()..['mandatory'] = true;

    final manifest = PreviewUpdateManifest.fromJson(json);

    expect(manifest.mandatory, isTrue);

    expect(
      manifest.minimumSupportedVersionCode,
      32004,
    );
  });
}
