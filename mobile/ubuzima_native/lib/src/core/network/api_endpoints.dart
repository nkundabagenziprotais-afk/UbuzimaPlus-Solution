abstract final class ApiEndpoints {
  static const String health = '/api/v1/health';

  static const String login = '/api/v1/auth/login';

  static const String logout = '/api/v1/auth/logout';

  static const String currentUser = '/api/v1/auth/me';

  static const String twoFactorVerify = '/api/v1/auth/two-factor/verify';

  static const String passwordResetRequest =
      '/api/v1/auth/password-reset-request';

  static const String sales = '/api/v1/pharmaco/sales';

  static const String saleCheckout = '/api/v1/pharmaco/sales/checkout';

  static String sale(Object id) => '/api/v1/pharmaco/sales/$id';

  static String salePayments(Object id) =>
      '/api/v1/pharmaco/sales/$id/payments';

  static String saleConfirm(Object id) => '/api/v1/pharmaco/sales/$id/confirm';

  static String saleInvoice(Object id) => '/api/v1/pharmaco/sales/$id/invoice';

  static const String products = '/api/v1/pharmaco/products';

  static String product(Object id) => '/api/v1/pharmaco/products/$id';

  static const String inventorySummary = '/api/v1/pharmaco/inventory/summary';

  static const String inventoryAnalyticsSummary =
      '/api/v1/pharmaco/inventory/analytics-summary';

  static const String inventoryLocations =
      '/api/v1/pharmaco/inventory/locations';

  static const String inventoryBatches = '/api/v1/pharmaco/inventory/batches';

  static const String inventoryReceive = '/api/v1/pharmaco/inventory/receive';

  static const String suppliers = '/api/v1/pharmaco/suppliers';

  static String supplier(Object id) => '/api/v1/pharmaco/suppliers/$id';

  static const String purchaseOrders = '/api/v1/pharmaco/purchase-orders';

  static String purchaseOrder(Object id) =>
      '/api/v1/pharmaco/purchase-orders/$id';

  static String approvePurchaseOrder(Object id) =>
      '/api/v1/pharmaco/purchase-orders/$id/approve';

  static String cancelPurchaseOrder(Object id) =>
      '/api/v1/pharmaco/purchase-orders/$id/cancel';

  static const String supplierInvoices = '/api/v1/pharmaco/supplier-invoices';

  static const String reportsOverview = '/api/v1/pharmaco/reports/overview';

  static const String reportsSalesSummary =
      '/api/v1/pharmaco/reports/sales-summary';

  static const String reportsProcurementSummary =
      '/api/v1/pharmaco/reports/procurement-summary';
}
