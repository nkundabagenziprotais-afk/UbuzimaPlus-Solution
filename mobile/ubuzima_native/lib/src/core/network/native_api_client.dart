import 'dart:async';
import 'dart:convert';
import 'dart:io';

class ApiException implements Exception {
  ApiException({
    required this.statusCode,
    required this.message,
    this.body = const <String, dynamic>{},
  });

  final int statusCode;
  final String message;
  final Map<String, dynamic> body;

  @override
  String toString() => message;
}

class NativeApiClient {
  NativeApiClient({
    Uri? baseUri,
    this.timeout = const Duration(seconds: 15),
  }) : baseUri = baseUri ?? Uri.parse('https://ubuzimaplus.com');

  final Uri baseUri;
  final Duration timeout;

  Future<Map<String, dynamic>> get(
    String path, {
    String? bearerToken,
  }) {
    return _request(
      method: 'GET',
      path: path,
      bearerToken: bearerToken,
    );
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    String? bearerToken,
  }) {
    return _request(
      method: 'POST',
      path: path,
      body: body,
      bearerToken: bearerToken,
    );
  }

  Future<Map<String, dynamic>> put(
    String path, {
    Map<String, dynamic>? body,
    String? bearerToken,
  }) {
    return _request(
      method: 'PUT',
      path: path,
      body: body,
      bearerToken: bearerToken,
    );
  }

  Future<Map<String, dynamic>> patch(
    String path, {
    Map<String, dynamic>? body,
    String? bearerToken,
  }) {
    return _request(
      method: 'PATCH',
      path: path,
      body: body,
      bearerToken: bearerToken,
    );
  }

  Future<Map<String, dynamic>> delete(
    String path, {
    Map<String, dynamic>? body,
    String? bearerToken,
  }) {
    return _request(
      method: 'DELETE',
      path: path,
      body: body,
      bearerToken: bearerToken,
    );
  }

  Future<Map<String, dynamic>> _request({
    required String method,
    required String path,
    Map<String, dynamic>? body,
    String? bearerToken,
  }) async {
    final client = HttpClient()..connectionTimeout = timeout;

    try {
      final request = await client
          .openUrl(
            method,
            baseUri.resolve(path),
          )
          .timeout(timeout);

      request.headers.set(
        HttpHeaders.acceptHeader,
        'application/json',
      );

      request.headers.set(
        'X-Ubuzima-Client',
        'ubuzima-plus-native',
      );

      if (bearerToken != null && bearerToken.trim().isNotEmpty) {
        request.headers.set(
          HttpHeaders.authorizationHeader,
          'Bearer ${bearerToken.trim()}',
        );
      }

      if (body != null) {
        request.headers.set(
          HttpHeaders.contentTypeHeader,
          'application/json',
        );

        request.add(
          utf8.encode(
            jsonEncode(body),
          ),
        );
      }

      final response = await request.close().timeout(timeout);

      final raw = await utf8.decoder.bind(response).join().timeout(timeout);

      dynamic decoded;

      if (raw.trim().isEmpty) {
        decoded = <String, dynamic>{};
      } else {
        try {
          decoded = jsonDecode(raw);
        } catch (_) {
          decoded = <String, dynamic>{
            'message': 'Unexpected server response.',
          };
        }
      }

      final payload = decoded is Map<String, dynamic>
          ? decoded
          : <String, dynamic>{
              'data': decoded,
            };

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return payload;
      }

      throw ApiException(
        statusCode: response.statusCode,
        message: _messageFrom(payload),
        body: payload,
      );
    } on TimeoutException {
      throw ApiException(
        statusCode: 408,
        message:
            'The request took too long. Check your connection and try again.',
      );
    } on SocketException {
      throw ApiException(
        statusCode: 0,
        message:
            'Ubuzima+ could not reach the server. Check your internet connection.',
      );
    } finally {
      client.close(force: true);
    }
  }

  String _messageFrom(
    Map<String, dynamic> body,
  ) {
    final message = body['message'];

    if (message is String && message.trim().isNotEmpty) {
      return message.trim();
    }

    final errors = body['errors'];

    if (errors is Map) {
      for (final value in errors.values) {
        if (value is List && value.isNotEmpty) {
          return value.first.toString();
        }

        if (value is String && value.trim().isNotEmpty) {
          return value.trim();
        }
      }
    }

    return 'Ubuzima+ could not complete this request.';
  }
}
