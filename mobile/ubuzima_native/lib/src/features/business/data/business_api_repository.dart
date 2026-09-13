import '../../../core/network/api_endpoints.dart';
import '../../../core/network/native_api_client.dart';
import '../../../core/security/secure_session_store.dart';

typedef AccessTokenReader = Future<String?> Function();

class BusinessApiRepository {
  BusinessApiRepository({
    NativeApiClient? api,
    AccessTokenReader? readAccessToken,
  })  : _api = api ?? NativeApiClient(),
        _readAccessToken =
            readAccessToken ?? SecureSessionStore().readAccessToken;

  final NativeApiClient _api;
  final AccessTokenReader _readAccessToken;

  Future<String> _token() async {
    final token = await _readAccessToken();

    if (token == null || token.trim().isEmpty) {
      throw ApiException(
        statusCode: 401,
        message: 'Your Ubuzima+ session has expired. Please sign in again.',
      );
    }

    return token.trim();
  }

  Future<Map<String, dynamic>> _get(
    String endpoint,
  ) async {
    return _api.get(
      endpoint,
      bearerToken: await _token(),
    );
  }

  Future<Map<String, dynamic>> _post(
    String endpoint, {
    Map<String, dynamic>? body,
  }) async {
    return _api.post(
      endpoint,
      body: body,
      bearerToken: await _token(),
    );
  }

  Future<Map<String, dynamic>> _patch(
    String endpoint, {
    Map<String, dynamic>? body,
  }) async {
    return _api.patch(
      endpoint,
      body: body,
      bearerToken: await _token(),
    );
  }

  Future<Map<String, dynamic>> loadSales() => _get(ApiEndpoints.sales);

  Future<Map<String, dynamic>> loadProducts() => _get(ApiEndpoints.products);

  Future<Map<String, dynamic>> loadInventorySummary() =>
      _get(ApiEndpoints.inventorySummary);

  Future<Map<String, dynamic>> loadInventoryLocations() =>
      _get(ApiEndpoints.inventoryLocations);

  Future<Map<String, dynamic>> loadInventoryBatches() =>
      _get(ApiEndpoints.inventoryBatches);

  Future<Map<String, dynamic>> loadSuppliers() => _get(ApiEndpoints.suppliers);

  Future<Map<String, dynamic>> loadPurchaseOrders() =>
      _get(ApiEndpoints.purchaseOrders);

  Future<Map<String, dynamic>> loadPurchaseOrder(Object id) => _get(
        ApiEndpoints.purchaseOrder(id),
      );

  Future<Map<String, dynamic>> approvePurchaseOrder(Object id) => _post(
        ApiEndpoints.approvePurchaseOrder(id),
      );

  Future<Map<String, dynamic>> cancelPurchaseOrder(
    Object id, {
    String? reason,
  }) {
    return _post(
      ApiEndpoints.cancelPurchaseOrder(id),
      body: <String, dynamic>{
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    );
  }

  Future<Map<String, dynamic>> updateSupplier(
    Object id,
    Map<String, dynamic> payload,
  ) {
    return _patch(
      ApiEndpoints.supplier(id),
      body: payload,
    );
  }

  Future<Map<String, dynamic>> createSale(
    Map<String, dynamic> payload,
  ) {
    return _post(
      ApiEndpoints.sales,
      body: payload,
    );
  }

  Future<Map<String, dynamic>> checkoutSale(
    Map<String, dynamic> payload,
  ) {
    return _post(
      ApiEndpoints.saleCheckout,
      body: payload,
    );
  }

  Future<Map<String, dynamic>> recordSalePayment(
    Object saleId,
    Map<String, dynamic> payload,
  ) {
    return _post(
      ApiEndpoints.salePayments(saleId),
      body: payload,
    );
  }

  Future<Map<String, dynamic>> confirmSale(
    Object saleId,
    Map<String, dynamic> payload,
  ) {
    return _post(
      ApiEndpoints.saleConfirm(saleId),
      body: payload,
    );
  }

  Future<Map<String, dynamic>> receiveInventory(
    Map<String, dynamic> payload,
  ) {
    return _post(
      ApiEndpoints.inventoryReceive,
      body: payload,
    );
  }
}
