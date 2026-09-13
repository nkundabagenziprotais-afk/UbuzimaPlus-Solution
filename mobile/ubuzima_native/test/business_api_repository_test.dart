import 'package:flutter_test/flutter_test.dart';
import 'package:ubuzima_native/src/core/network/native_api_client.dart';
import 'package:ubuzima_native/src/features/business/data/business_api_repository.dart';

class FakeNativeApiClient extends NativeApiClient {
  String? method;
  String? path;
  String? token;
  String? tenantSlug;
  Map<String, dynamic>? body;

  void capture(
    String newMethod,
    String newPath,
    String? newToken,
    Map<String, dynamic>? newBody,
  ) {
    method = newMethod;
    path = newPath;
    token = newToken;
    body = newBody;
  }

  @override
  Future<Map<String, dynamic>> get(
    String path, {
    String? bearerToken,
    String? tenantSlug,
  }) async {
    this.tenantSlug = tenantSlug;
    capture(
      'GET',
      path,
      bearerToken,
      null,
    );

    return <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    String? bearerToken,
    String? tenantSlug,
  }) async {
    this.tenantSlug = tenantSlug;
    capture(
      'POST',
      path,
      bearerToken,
      body,
    );

    return <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> patch(
    String path, {
    Map<String, dynamic>? body,
    String? bearerToken,
    String? tenantSlug,
  }) async {
    this.tenantSlug = tenantSlug;
    capture(
      'PATCH',
      path,
      bearerToken,
      body,
    );

    return <String, dynamic>{};
  }
}

void main() {
  late FakeNativeApiClient api;
  late BusinessApiRepository repository;

  setUp(() {
    api = FakeNativeApiClient();

    repository = BusinessApiRepository(
      api: api,
      readAccessToken: () async => 'secure-real-session-token',
      readTenantSlug: () => 'vitapharma',
    );
  });

  test(
    'sales uses authenticated endpoint',
    () async {
      await repository.loadSales();

      expect(api.method, 'GET');
      expect(
        api.path,
        '/api/v1/pharmaco/sales',
      );
      expect(
        api.token,
        'secure-real-session-token',
      );
      expect(
        api.tenantSlug,
        'vitapharma',
      );
    },
  );

  test(
    'inventory uses summary endpoint',
    () async {
      await repository.loadInventorySummary();

      expect(api.method, 'GET');
      expect(
        api.path,
        '/api/v1/pharmaco/inventory/summary',
      );
    },
  );

  test(
    'purchase order approval uses server workflow',
    () async {
      await repository.approvePurchaseOrder(42);

      expect(api.method, 'POST');
      expect(
        api.path,
        '/api/v1/pharmaco/purchase-orders/42/approve',
      );
    },
  );

  test(
    'purchase order cancellation sends reason',
    () async {
      await repository.cancelPurchaseOrder(
        42,
        reason: 'Duplicate order',
      );

      expect(api.method, 'POST');
      expect(
        api.path,
        '/api/v1/pharmaco/purchase-orders/42/cancel',
      );
      expect(
        api.body?['reason'],
        'Duplicate order',
      );
    },
  );

  test(
    'supplier update uses patch',
    () async {
      await repository.updateSupplier(
        7,
        <String, dynamic>{
          'name': 'Supplier A',
        },
      );

      expect(api.method, 'PATCH');
      expect(
        api.path,
        '/api/v1/pharmaco/suppliers/7',
      );
    },
  );

  test(
    'checkout uses sales checkout endpoint',
    () async {
      await repository.checkoutSale(
        <String, dynamic>{
          'items': <dynamic>[],
        },
      );

      expect(api.method, 'POST');
      expect(
        api.path,
        '/api/v1/pharmaco/sales/checkout',
      );
    },
  );

  test(
    'secure session is required',
    () async {
      final noSession = BusinessApiRepository(
        api: api,
        readAccessToken: () async => null,
      );

      expect(
        noSession.loadProducts(),
        throwsA(
          isA<ApiException>().having(
            (error) => error.statusCode,
            'statusCode',
            401,
          ),
        ),
      );
    },
  );
}
