import 'package:flutter/material.dart';

import '../../business/data/business_api_repository.dart';

// AQUILA_RC6_FULL_PWA_NATIVE_REPLACEMENT

const Color _blue = Color(0xFF0878C9);
const Color _green = Color(0xFF41B43D);
const Color _surface = Color(0xFFF7FBF8);
const Color _text = Color(0xFF16333F);
const Color _border = Color(0xFFDCEAE4);

Map<String, dynamic> _map(Object? value) {
  if (value is Map<String, dynamic>) return value;

  if (value is Map) {
    return value.map(
      (key, item) => MapEntry(key.toString(), item),
    );
  }

  return <String, dynamic>{};
}

List<Map<String, dynamic>> _rows(
  Object? value, [
  List<String> keys = const <String>[],
]) {
  if (value is List) {
    return value
        .whereType<Map>()
        .map(
          (row) => row.map(
            (key, item) => MapEntry(key.toString(), item),
          ),
        )
        .toList();
  }

  final source = _map(value);

  for (final key in <String>[
    ...keys,
    'data',
    'items',
    'rows',
    'sales',
    'products',
    'suppliers',
    'purchase_orders',
    'batches',
    'locations',
  ]) {
    final candidate = source[key];

    if (candidate is List) {
      return _rows(candidate);
    }

    if (candidate is Map) {
      final nested = _rows(candidate);

      if (nested.isNotEmpty) return nested;
    }
  }

  return const <Map<String, dynamic>>[];
}

Object? _pick(
  Object? value,
  List<String> keys,
) {
  final source = _map(value);

  for (final key in keys) {
    if (source.containsKey(key) && source[key] != null) {
      return source[key];
    }
  }

  if (source['data'] is Map) {
    return _pick(source['data'], keys);
  }

  if (source['summary'] is Map) {
    return _pick(source['summary'], keys);
  }

  return null;
}

double? _number(Object? value) {
  if (value is num) return value.toDouble();

  return double.tryParse(
    value?.toString() ?? '',
  );
}

int? _integer(Object? value) {
  if (value is int) return value;

  return int.tryParse(
    value?.toString() ?? '',
  );
}

String _money(Object? value) {
  final amount = _number(value);

  if (amount == null) return '—';

  return 'RWF ${amount.round()}';
}

String _count(Object? value) {
  final number = _number(value);

  if (number == null) return '—';

  return number == number.roundToDouble()
      ? number.toInt().toString()
      : number.toStringAsFixed(1);
}

String _value(
  Map<String, dynamic> row,
  List<String> keys, {
  String fallback = '—',
}) {
  for (final key in keys) {
    final value = row[key]?.toString().trim();

    if (value != null && value.isNotEmpty) {
      return value;
    }
  }

  return fallback;
}

Object? _id(Map<String, dynamic> row) {
  for (final key in <String>[
    'id',
    'uuid',
    'product_id',
    'supplier_id',
  ]) {
    if (row[key] != null) return row[key];
  }

  return null;
}

String? _optional(String value) {
  final trimmed = value.trim();

  return trimmed.isEmpty ? null : trimmed;
}

List<String> _permissions(
  Map<String, dynamic> profile,
) {
  final direct = profile['permissions'];

  if (direct is List) {
    return direct
        .map((item) => item.toString())
        .where((item) => item.trim().isNotEmpty)
        .toList();
  }

  final user = profile['user'];

  if (user is Map && user['permissions'] is List) {
    return (user['permissions'] as List)
        .map((item) => item.toString())
        .where((item) => item.trim().isNotEmpty)
        .toList();
  }

  return const <String>[];
}

bool _can(
  Map<String, dynamic> profile,
  String permission,
) {
  return _permissions(profile).contains(permission);
}

bool _hasPrefix(
  Map<String, dynamic> profile,
  String prefix,
) {
  return _permissions(profile).any(
    (permission) => permission.startsWith(prefix),
  );
}

int? _branchId(
  Map<String, dynamic> profile,
) {
  final branch = profile['branch'];

  if (branch is Map) {
    final id = _integer(branch['id']);

    if (id != null) return id;
  }

  final assignments = profile['tenant_assignments'];

  if (assignments is List) {
    for (final assignment in assignments) {
      if (assignment is! Map) continue;

      final branch = assignment['branch'];

      if (branch is Map) {
        final id = _integer(branch['id']);

        if (id != null) return id;
      }

      final direct = _integer(
        assignment['branch_id'],
      );

      if (direct != null) return direct;
    }
  }

  return null;
}

String _userName(Map<String, dynamic> profile) {
  final user = profile['user'];

  if (user is Map) {
    final value = user['name']?.toString().trim();

    if (value != null && value.isNotEmpty) {
      return value;
    }
  }

  return 'Team member';
}

String _roleName(Map<String, dynamic> profile) {
  final user = profile['user'];

  if (user is Map) {
    for (final key in <String>[
      'role_name',
      'role',
      'job_title',
    ]) {
      final value = user[key]?.toString().trim();

      if (value != null && value.isNotEmpty) {
        return value;
      }
    }
  }

  return 'Authorized user';
}

Map<String, dynamic> _payload(
  Map<String, Map<String, dynamic>> payloads,
  String key,
) {
  return payloads[key] ?? const <String, dynamic>{};
}

class _Page extends StatelessWidget {
  const _Page({
    required this.title,
    required this.subtitle,
    required this.tenantName,
    required this.branchName,
    required this.offline,
    required this.onRefresh,
    required this.children,
  });

  final String title;
  final String subtitle;
  final String tenantName;
  final String? branchName;
  final bool offline;
  final Future<void> Function() onRefresh;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: _surface,
      child: RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: <Widget>[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: _border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Container(
                        width: 40,
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _blue,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text(
                          'U+',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              title,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleLarge
                                  ?.copyWith(
                                    color: _text,
                                    fontWeight: FontWeight.w900,
                                  ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              subtitle,
                              style: TextStyle(
                                color: _text.withValues(
                                  alpha: 0.68,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: <Widget>[
                      _Pill(
                        icon: Icons.business_outlined,
                        label: tenantName,
                      ),
                      if (branchName != null && branchName!.trim().isNotEmpty)
                        _Pill(
                          icon: Icons.store_outlined,
                          label: branchName!,
                        ),
                      _Pill(
                        icon: offline
                            ? Icons.cloud_off_outlined
                            : Icons.cloud_done_outlined,
                        label: offline ? 'Offline session' : 'Live',
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 10,
        vertical: 7,
      ),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: _border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(
            icon,
            size: 15,
            color: _green,
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: _text,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.child,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: _border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              title,
              style: const TextStyle(
                color: _text,
                fontSize: 16,
                fontWeight: FontWeight.w900,
              ),
            ),
            if (subtitle != null) ...<Widget>[
              const SizedBox(height: 3),
              Text(
                subtitle!,
                style: TextStyle(
                  color: _text.withValues(
                    alpha: 0.68,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric(
    this.label,
    this.value,
  );

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 156,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            label,
            style: const TextStyle(
              color: _text,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: _text,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(
    this.label, {
    this.onTap,
  });

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: 11,
          vertical: 9,
        ),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _border),
        ),
        child: Text(
          label,
          style: const TextStyle(
            color: _text,
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class _RowCard extends StatelessWidget {
  const _RowCard({
    required this.title,
    required this.subtitle,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: _text,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (subtitle.trim().isNotEmpty)
                  Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: _text.withValues(
                        alpha: 0.66,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (trailing != null) ...<Widget>[
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                trailing!,
                textAlign: TextAlign.right,
                style: const TextStyle(
                  color: _text,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Text(
      message,
      style: TextStyle(
        color: _text.withValues(alpha: 0.65),
      ),
    );
  }
}

class _ErrorBox extends StatelessWidget {
  const _ErrorBox(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        message,
        style: TextStyle(
          color: Theme.of(context).colorScheme.onErrorContainer,
        ),
      ),
    );
  }
}

class Rc6HomeView extends StatelessWidget {
  const Rc6HomeView({
    required this.profile,
    required this.offline,
    required this.payloads,
    required this.errors,
    required this.tenantName,
    required this.branchName,
    required this.onRefresh,
    required this.onOpenSales,
    required this.onOpenInventory,
    required this.onOpenProcurement,
    super.key,
  });

  final Map<String, dynamic> profile;
  final bool offline;
  final Map<String, Map<String, dynamic>> payloads;
  final Map<String, String> errors;
  final String tenantName;
  final String? branchName;
  final Future<void> Function() onRefresh;
  final VoidCallback onOpenSales;
  final VoidCallback onOpenInventory;
  final VoidCallback onOpenProcurement;

  @override
  Widget build(BuildContext context) {
    final report = _payload(
      payloads,
      'reports_sales',
    );

    final inventory = _payload(
      payloads,
      'inventory',
    );

    final analytics = _payload(
      payloads,
      'inventory_analytics',
    );

    final products = _rows(
      payloads['products'],
      const <String>['products'],
    );

    final sales = _rows(
      payloads['sales'],
      const <String>['sales'],
    );

    final lowStock = _rows(
      _pick(
        analytics,
        const <String>[
          'low_stock_products',
          'low_stock',
          'low_stock_items',
        ],
      ),
    );

    final expiry = _rows(
      _pick(
        analytics,
        const <String>[
          'near_expiry',
          'near_expiry_batches',
          'expiry_watch',
        ],
      ),
    );

    return _Page(
      title: 'Ubuzima+',
      subtitle: '${_userName(profile)} · ${_roleName(profile)}',
      tenantName: tenantName,
      branchName: branchName,
      offline: offline,
      onRefresh: onRefresh,
      children: <Widget>[
        if (errors.isNotEmpty)
          _Section(
            title: 'Live alerts',
            child: Column(
              children: errors.entries
                  .take(2)
                  .map(
                    (entry) => _ErrorBox(
                      '${entry.key}: ${entry.value}',
                    ),
                  )
                  .toList(),
            ),
          ),
        _Section(
          title: 'Today',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              _Metric(
                'Today Sales',
                _money(
                  _pick(
                    report,
                    const <String>[
                      'total_sales_amount',
                      'total_sales',
                    ],
                  ),
                ),
              ),
              _Metric(
                'Paid Today',
                _money(
                  _pick(
                    report,
                    const <String>[
                      'paid_amount',
                      'payments_collected',
                      'cash_collected',
                    ],
                  ),
                ),
              ),
              _Metric(
                'Low Stock',
                lowStock.isNotEmpty
                    ? lowStock.length.toString()
                    : _count(
                        _pick(
                          inventory,
                          const <String>[
                            'low_stock_count',
                          ],
                        ),
                      ),
              ),
              _Metric(
                'Expiry Watch',
                expiry.isNotEmpty
                    ? expiry.length.toString()
                    : _count(
                        _pick(
                          analytics,
                          const <String>[
                            'near_expiry_count',
                          ],
                        ),
                      ),
              ),
              _Metric(
                'Open Balance',
                _money(
                  _pick(
                    report,
                    const <String>[
                      'balance_amount',
                      'outstanding_balance',
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        _Section(
          title: 'Quick Actions',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              _Chip(
                'POS & Sales',
                onTap: onOpenSales,
              ),
              _Chip(
                'Inventory',
                onTap: onOpenInventory,
              ),
              _Chip(
                'Procurement',
                onTap: onOpenProcurement,
              ),
            ],
          ),
        ),
        _Section(
          title: 'Counter & Dispensing Queue',
          child: sales.isEmpty
              ? const _Empty(
                  'No live sales are currently loaded.',
                )
              : Column(
                  children: sales
                      .take(5)
                      .map(
                        (row) => _RowCard(
                          title: _value(
                            row,
                            const <String>[
                              'sale_number',
                              'invoice_number',
                              'reference_number',
                            ],
                            fallback: 'Sale',
                          ),
                          subtitle: _value(
                            row,
                            const <String>[
                              'status',
                              'payment_status',
                            ],
                          ),
                          trailing: _money(
                            row['total_amount'],
                          ),
                        ),
                      )
                      .toList(),
                ),
        ),
        _Section(
          title: 'Stock That Needs Attention',
          child: lowStock.isEmpty && expiry.isEmpty
              ? const _Empty(
                  'No stock-attention rows are loaded.',
                )
              : Column(
                  children: <Widget>[
                    ...lowStock.take(3).map(
                          (row) => _RowCard(
                            title: _value(
                              row,
                              const <String>[
                                'name',
                                'product_name',
                              ],
                              fallback: 'Low-stock product',
                            ),
                            subtitle: 'Low stock',
                            trailing: _value(
                              row,
                              const <String>[
                                'quantity',
                                'available_quantity',
                                'on_hand',
                              ],
                            ),
                          ),
                        ),
                    ...expiry.take(3).map(
                          (row) => _RowCard(
                            title: _value(
                              row,
                              const <String>[
                                'product_name',
                                'name',
                              ],
                              fallback: 'Expiry watch',
                            ),
                            subtitle: _value(
                              row,
                              const <String>[
                                'batch_number',
                              ],
                            ),
                            trailing: _value(
                              row,
                              const <String>[
                                'expiry_date',
                              ],
                            ),
                          ),
                        ),
                  ],
                ),
        ),
        _Section(
          title: 'Product Shelf',
          child: products.isEmpty
              ? const _Empty(
                  'No product shelf rows are loaded.',
                )
              : Column(
                  children: products
                      .take(6)
                      .map(
                        (row) => _RowCard(
                          title: _value(
                            row,
                            const <String>[
                              'name',
                              'product_name',
                            ],
                            fallback: 'Product',
                          ),
                          subtitle: _value(
                            row,
                            const <String>[
                              'sku',
                              'code',
                              'category_name',
                            ],
                          ),
                          trailing: _money(
                            _pick(
                              row,
                              const <String>[
                                'selling_price',
                                'retail_price',
                                'price',
                              ],
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
        ),
        const _Section(
          title: 'Customer Care',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              _Chip(
                'Customers & Patients',
              ),
              _Chip(
                'Prescription Management',
              ),
              _Chip(
                'Receipts & Payments',
              ),
            ],
          ),
        ),
        const _Section(
          title: 'Management Work',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              _Chip('Reports'),
              _Chip('Inventory Review'),
              _Chip(
                'Procurement Operations',
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class Rc6SalesView extends StatefulWidget {
  const Rc6SalesView({
    required this.profile,
    required this.offline,
    required this.business,
    required this.payloads,
    required this.errors,
    required this.tenantName,
    required this.branchName,
    required this.onRefresh,
    super.key,
  });

  final Map<String, dynamic> profile;
  final bool offline;
  final BusinessApiRepository business;
  final Map<String, Map<String, dynamic>> payloads;
  final Map<String, String> errors;
  final String tenantName;
  final String? branchName;
  final Future<void> Function() onRefresh;

  @override
  State<Rc6SalesView> createState() => _Rc6SalesViewState();
}

class _Rc6SalesViewState extends State<Rc6SalesView> {
  late final TextEditingController _branch;

  final _quantity = TextEditingController(text: '1');

  final _unitPrice = TextEditingController();

  final _reference = TextEditingController();

  String? _productId;
  String _paymentMethod = 'cash';
  bool _prescriptionVerified = false;
  bool _busy = false;

  String? _error;
  String? _notice;

  @override
  void initState() {
    super.initState();

    _branch = TextEditingController(
      text: _branchId(widget.profile)?.toString() ?? '',
    );
  }

  @override
  void dispose() {
    _branch.dispose();
    _quantity.dispose();
    _unitPrice.dispose();
    _reference.dispose();
    super.dispose();
  }

  Future<void> _checkout() async {
    if (widget.offline || _busy) {
      return;
    }

    final branchId = int.tryParse(_branch.text.trim());

    final productId = int.tryParse(_productId ?? '');

    final quantity = double.tryParse(_quantity.text.trim());

    final unitPrice = double.tryParse(_unitPrice.text.trim());

    if (branchId == null ||
        productId == null ||
        quantity == null ||
        quantity <= 0 ||
        unitPrice == null ||
        unitPrice < 0 ||
        _reference.text.trim().isEmpty) {
      setState(() {
        _error =
            'Choose a product and enter branch, quantity, unit price and transaction reference.';
        _notice = null;
      });

      return;
    }

    final saleType = switch (_paymentMethod) {
      'insurance' => 'insurance_sale',
      'credit' => 'credit_sale',
      _ => 'cash_sale',
    };

    final payload = <String, dynamic>{
      'idempotency_key':
          'mobile-${DateTime.now().microsecondsSinceEpoch}-$productId',
      'branch_id': branchId,
      'sale_type': saleType,
      'items': <Map<String, dynamic>>[
        <String, dynamic>{
          'product_id': productId,
          'quantity': quantity,
          'unit_price': unitPrice,
          'discount_amount': 0,
          'tax_amount': 0,
          'prescription_verified': _prescriptionVerified,
        },
      ],
      'payment': <String, dynamic>{
        'payment_method': _paymentMethod,
        'generate_receipt': true,
        'reference_number': _reference.text.trim(),
      },
    };

    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });

    try {
      final response = await widget.business.checkoutSale(
        payload,
      );

      if (!mounted) return;

      setState(() {
        _notice = _value(
          response,
          const <String>[
            'message',
            'status',
          ],
          fallback: 'Checkout completed.',
        );
      });

      await widget.onRefresh();
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final products = _rows(
      widget.payloads['products'],
      const <String>['products'],
    );

    final sales = _rows(
      widget.payloads['sales'],
      const <String>['sales'],
    );

    final report = _payload(
      widget.payloads,
      'reports_sales',
    );

    return _Page(
      title: 'POS & Sales',
      subtitle: 'Native checkout, sales health and counter follow-up.',
      tenantName: widget.tenantName,
      branchName: widget.branchName,
      offline: widget.offline,
      onRefresh: widget.onRefresh,
      children: <Widget>[
        const _Section(
          title: 'POS and Sales',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              _Chip('Pharmacist Review'),
              _Chip('Customers & Patients'),
              _Chip(
                'Prescription Management',
              ),
              _Chip(
                'Sales Register & Returns',
              ),
              _Chip('Receipts & Payments'),
            ],
          ),
        ),
        _Section(
          title: 'Sales health',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              _Metric(
                'Total sales',
                _money(
                  _pick(
                    report,
                    const <String>[
                      'total_sales_amount',
                      'total_sales',
                    ],
                  ),
                ),
              ),
              _Metric(
                'Cash collected',
                _money(
                  _pick(
                    report,
                    const <String>[
                      'payments_collected',
                      'paid_amount',
                      'cash_collected',
                    ],
                  ),
                ),
              ),
              _Metric(
                'Outstanding balance',
                _money(
                  _pick(
                    report,
                    const <String>[
                      'balance_amount',
                      'outstanding_balance',
                    ],
                  ),
                ),
              ),
              _Metric(
                'Average transaction',
                _money(
                  _pick(
                    report,
                    const <String>[
                      'average_transaction',
                      'average_sale',
                    ],
                  ),
                ),
              ),
              _Metric(
                'MoMo Sales',
                _money(
                  _pick(
                    report,
                    const <String>[
                      'momo_sales',
                    ],
                  ),
                ),
              ),
              _Metric(
                'Insurance Sales',
                _money(
                  _pick(
                    report,
                    const <String>[
                      'insurance_sales',
                    ],
                  ),
                ),
              ),
              _Metric(
                'Strongest business day',
                _pick(
                      report,
                      const <String>[
                        'strongest_business_day',
                        'strongest_day',
                      ],
                    )?.toString() ??
                    '—',
              ),
              _Metric(
                'Daily cash requirement',
                _money(
                  _pick(
                    report,
                    const <String>[
                      'daily_cash_requirement',
                    ],
                  ),
                ),
              ),
              _Metric(
                'Collection efficiency',
                _pick(
                      report,
                      const <String>[
                        'collection_efficiency',
                      ],
                    )?.toString() ??
                    '—',
              ),
              _Metric(
                'Seven-day sales forecast',
                _money(
                  _pick(
                    report,
                    const <String>[
                      'seven_day_sales_forecast',
                      'sales_forecast',
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        _Section(
          title: 'Native checkout',
          child: Column(
            children: <Widget>[
              TextField(
                controller: _branch,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Branch ID',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: products.any(
                  (row) => _id(row)?.toString() == _productId,
                )
                    ? _productId
                    : null,
                decoration: const InputDecoration(
                  labelText: 'Product',
                  border: OutlineInputBorder(),
                ),
                items: products
                    .where(
                      (row) => _id(row) != null,
                    )
                    .map(
                      (row) => DropdownMenuItem<String>(
                        value: _id(row)!.toString(),
                        child: Text(
                          _value(
                            row,
                            const <String>[
                              'name',
                              'product_name',
                            ],
                            fallback: 'Product',
                          ),
                        ),
                      ),
                    )
                    .toList(),
                onChanged: _busy
                    ? null
                    : (value) {
                        setState(() {
                          _productId = value;
                        });

                        if (value == null) return;

                        for (final row in products) {
                          if (_id(row)?.toString() != value) {
                            continue;
                          }

                          final price = _number(
                            _pick(
                              row,
                              const <String>[
                                'selling_price',
                                'retail_price',
                                'price',
                              ],
                            ),
                          );

                          if (price != null) {
                            _unitPrice.text = price.toString();
                          }

                          break;
                        }
                      },
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _quantity,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(
                  labelText: 'Quantity',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _unitPrice,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(
                  labelText: 'Unit price',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _paymentMethod,
                decoration: const InputDecoration(
                  labelText: 'Payment method',
                  border: OutlineInputBorder(),
                ),
                items: const <DropdownMenuItem<String>>[
                  DropdownMenuItem(
                    value: 'cash',
                    child: Text('Cash'),
                  ),
                  DropdownMenuItem(
                    value: 'momo',
                    child: Text('Mobile Money'),
                  ),
                  DropdownMenuItem(
                    value: 'card',
                    child: Text('Card'),
                  ),
                  DropdownMenuItem(
                    value: 'insurance',
                    child: Text('Insurance'),
                  ),
                  DropdownMenuItem(
                    value: 'credit',
                    child: Text('Customer Credit'),
                  ),
                ],
                onChanged: _busy
                    ? null
                    : (value) {
                        if (value != null) {
                          setState(() {
                            _paymentMethod = value;
                          });
                        }
                      },
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _reference,
                decoration: const InputDecoration(
                  labelText: 'Transaction reference',
                  border: OutlineInputBorder(),
                ),
              ),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: _prescriptionVerified,
                title: const Text(
                  'Prescription verified where required',
                ),
                onChanged: _busy
                    ? null
                    : (value) {
                        setState(() {
                          _prescriptionVerified = value ?? false;
                        });
                      },
              ),
              if (_error != null) _ErrorBox(_error!),
              if (_notice != null)
                Text(
                  _notice!,
                  style: const TextStyle(
                    color: _green,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: widget.offline || _busy ? null : _checkout,
                  child: Text(
                    _busy ? 'Processing…' : 'Complete checkout',
                  ),
                ),
              ),
            ],
          ),
        ),
        _Section(
          title: 'Sales and Collection Trend',
          child: sales.isEmpty
              ? const _Empty(
                  'No sales trend rows are loaded.',
                )
              : Column(
                  children: sales
                      .take(7)
                      .map(
                        (row) => _RowCard(
                          title: _value(
                            row,
                            const <String>[
                              'sale_number',
                              'reference_number',
                            ],
                            fallback: 'Sale',
                          ),
                          subtitle: _value(
                            row,
                            const <String>[
                              'created_at',
                              'business_date',
                              'status',
                            ],
                          ),
                          trailing: _money(
                            row['total_amount'],
                          ),
                        ),
                      )
                      .toList(),
                ),
        ),
        const _Section(
          title: 'Payment Health',
          child: Text(
            'Review collections, outstanding balances and payment exceptions.',
          ),
        ),
        const _Section(
          title: 'Recommended Actions',
          child: Text(
            'Resolve balance, payment and prescription exceptions before closeout.',
          ),
        ),
      ],
    );
  }
}

class Rc6InventoryView extends StatefulWidget {
  const Rc6InventoryView({
    required this.profile,
    required this.offline,
    required this.business,
    required this.payloads,
    required this.errors,
    required this.tenantName,
    required this.branchName,
    required this.onRefresh,
    super.key,
  });

  final Map<String, dynamic> profile;
  final bool offline;
  final BusinessApiRepository business;
  final Map<String, Map<String, dynamic>> payloads;
  final Map<String, String> errors;
  final String tenantName;
  final String? branchName;
  final Future<void> Function() onRefresh;

  @override
  State<Rc6InventoryView> createState() => _Rc6InventoryViewState();
}

class _Rc6InventoryViewState extends State<Rc6InventoryView> {
  String? _productId;
  String? _locationId;

  final _batch = TextEditingController();
  final _quantity = TextEditingController();
  final _expiry = TextEditingController();
  final _unitCost = TextEditingController();
  final _sellingPrice = TextEditingController();
  final _supplierName = TextEditingController();
  final _reference = TextEditingController();
  final _reason = TextEditingController();

  bool _busy = false;
  String? _error;
  String? _notice;

  @override
  void dispose() {
    _batch.dispose();
    _quantity.dispose();
    _expiry.dispose();
    _unitCost.dispose();
    _sellingPrice.dispose();
    _supplierName.dispose();
    _reference.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _receive() async {
    if (widget.offline || _busy) {
      return;
    }

    if (!_can(
      widget.profile,
      'pharmaco.product_inventory.receive',
    )) {
      setState(() {
        _error = 'You do not have permission to receive inventory.';
        _notice = null;
      });
      return;
    }

    final productId = int.tryParse(_productId ?? '');

    final locationId = int.tryParse(_locationId ?? '');

    final quantity = double.tryParse(_quantity.text.trim());

    if (productId == null ||
        locationId == null ||
        quantity == null ||
        quantity <= 0 ||
        _batch.text.trim().isEmpty) {
      setState(() {
        _error =
            'Choose product and location, then enter batch number and quantity.';
        _notice = null;
      });

      return;
    }

    final payload = <String, dynamic>{
      'product_id': productId,
      'stock_location_id': locationId,
      'batch_number': _batch.text.trim(),
      'quantity': quantity,
      'expiry_date': _optional(_expiry.text),
      'unit_cost': double.tryParse(_unitCost.text.trim()),
      'selling_price': double.tryParse(
        _sellingPrice.text.trim(),
      ),
      'supplier_name': _optional(_supplierName.text),
      'reference_number': _optional(_reference.text),
      'reason': _optional(_reason.text),
    };

    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });

    try {
      final response = await widget.business.receiveInventory(
        payload,
      );

      if (!mounted) return;

      setState(() {
        _notice = _value(
          response,
          const <String>[
            'message',
            'status',
          ],
          fallback: 'Stock received.',
        );
      });

      await widget.onRefresh();
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final summary = _payload(
      widget.payloads,
      'inventory',
    );

    final analytics = _payload(
      widget.payloads,
      'inventory_analytics',
    );

    final products = _rows(
      widget.payloads['products'],
      const <String>['products'],
    );

    final locations = _rows(
      widget.payloads['inventory_locations'],
      const <String>['locations'],
    );

    final batches = _rows(
      widget.payloads['inventory_batches'],
      const <String>['batches'],
    );

    final lowStock = _rows(
      _pick(
        analytics,
        const <String>[
          'low_stock_products',
          'low_stock',
          'low_stock_items',
        ],
      ),
    );

    final nearExpiry = _rows(
      _pick(
        analytics,
        const <String>[
          'near_expiry',
          'near_expiry_batches',
          'expiry_watch',
        ],
      ),
    );

    final canReceiveInventory = _can(
      widget.profile,
      'pharmaco.product_inventory.receive',
    );

    return _Page(
      title: 'Inventory',
      subtitle: 'Native stock visibility, batch review and receiving.',
      tenantName: widget.tenantName,
      branchName: widget.branchName,
      offline: widget.offline,
      onRefresh: widget.onRefresh,
      children: <Widget>[
        const _Section(
          title: 'Inventory workspace',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              _Chip('Overview Summary'),
              _Chip(
                'Low Stock Watch List',
              ),
              _Chip(
                'Retail Product Shelf',
              ),
              _Chip(
                'Batch & Expiry Review',
              ),
              _Chip(
                'Near Expiry Watch List',
              ),
              _Chip(
                'Inventory / Product Master',
              ),
              _Chip('Product Inventory'),
              _Chip('Stock Locations'),
              _Chip('Receiving Stock'),
            ],
          ),
        ),
        _Section(
          title: 'Overview Summary',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              _Metric(
                'Products',
                products.isNotEmpty
                    ? products.length.toString()
                    : _count(
                        _pick(
                          summary,
                          const <String>[
                            'product_count',
                            'total_products',
                          ],
                        ),
                      ),
              ),
              _Metric(
                'Low stock',
                lowStock.isNotEmpty
                    ? lowStock.length.toString()
                    : _count(
                        _pick(
                          summary,
                          const <String>[
                            'low_stock_count',
                          ],
                        ),
                      ),
              ),
              _Metric(
                'Near expiry',
                nearExpiry.isNotEmpty
                    ? nearExpiry.length.toString()
                    : _count(
                        _pick(
                          analytics,
                          const <String>[
                            'near_expiry_count',
                          ],
                        ),
                      ),
              ),
              _Metric(
                'Locations',
                locations.isEmpty ? '—' : locations.length.toString(),
              ),
            ],
          ),
        ),
        _Section(
          title: 'Low Stock Watch List',
          child: lowStock.isEmpty
              ? const _Empty(
                  'No low-stock rows are loaded.',
                )
              : Column(
                  children: lowStock
                      .take(8)
                      .map(
                        (row) => _RowCard(
                          title: _value(
                            row,
                            const <String>[
                              'name',
                              'product_name',
                            ],
                            fallback: 'Product',
                          ),
                          subtitle: 'Low stock',
                          trailing: _value(
                            row,
                            const <String>[
                              'available_quantity',
                              'quantity',
                              'on_hand',
                            ],
                          ),
                        ),
                      )
                      .toList(),
                ),
        ),
        _Section(
          title: 'Retail Product Shelf',
          child: products.isEmpty
              ? const _Empty(
                  'No products are loaded.',
                )
              : Column(
                  children: products
                      .take(8)
                      .map(
                        (row) => _RowCard(
                          title: _value(
                            row,
                            const <String>[
                              'name',
                              'product_name',
                            ],
                            fallback: 'Product',
                          ),
                          subtitle: _value(
                            row,
                            const <String>[
                              'sku',
                              'code',
                            ],
                          ),
                          trailing: _money(
                            _pick(
                              row,
                              const <String>[
                                'selling_price',
                                'retail_price',
                              ],
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
        ),
        _Section(
          title: 'Batch & Expiry Review',
          child: batches.isEmpty
              ? const _Empty(
                  'No batches are loaded.',
                )
              : Column(
                  children: batches
                      .take(8)
                      .map(
                        (row) => _RowCard(
                          title: _value(
                            row,
                            const <String>[
                              'product_name',
                              'batch_number',
                            ],
                            fallback: 'Batch',
                          ),
                          subtitle: _value(
                            row,
                            const <String>[
                              'batch_number',
                            ],
                          ),
                          trailing: _value(
                            row,
                            const <String>[
                              'expiry_date',
                            ],
                          ),
                        ),
                      )
                      .toList(),
                ),
        ),
        _Section(
          title: 'Near Expiry Watch List',
          child: nearExpiry.isEmpty
              ? const _Empty(
                  'No near-expiry rows are loaded.',
                )
              : Column(
                  children: nearExpiry
                      .take(8)
                      .map(
                        (row) => _RowCard(
                          title: _value(
                            row,
                            const <String>[
                              'product_name',
                              'name',
                            ],
                            fallback: 'Expiry watch',
                          ),
                          subtitle: _value(
                            row,
                            const <String>[
                              'batch_number',
                            ],
                          ),
                          trailing: _value(
                            row,
                            const <String>[
                              'expiry_date',
                            ],
                          ),
                        ),
                      )
                      .toList(),
                ),
        ),
        if (canReceiveInventory)
          _Section(
            title: 'Receiving Stock',
            child: Column(
              children: <Widget>[
                DropdownButtonFormField<String>(
                  initialValue: products.any(
                    (row) => _id(row)?.toString() == _productId,
                  )
                      ? _productId
                      : null,
                  decoration: const InputDecoration(
                    labelText: 'Product',
                    border: OutlineInputBorder(),
                  ),
                  items: products
                      .where(
                        (row) => _id(row) != null,
                      )
                      .map(
                        (row) => DropdownMenuItem<String>(
                          value: _id(row)!.toString(),
                          child: Text(
                            _value(
                              row,
                              const <String>[
                                'name',
                                'product_name',
                              ],
                              fallback: 'Product',
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: _busy
                      ? null
                      : (value) {
                          setState(() {
                            _productId = value;
                          });
                        },
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: locations.any(
                    (row) => _id(row)?.toString() == _locationId,
                  )
                      ? _locationId
                      : null,
                  decoration: const InputDecoration(
                    labelText: 'Stock location',
                    border: OutlineInputBorder(),
                  ),
                  items: locations
                      .where(
                        (row) => _id(row) != null,
                      )
                      .map(
                        (row) => DropdownMenuItem<String>(
                          value: _id(row)!.toString(),
                          child: Text(
                            _value(
                              row,
                              const <String>[
                                'name',
                                'location_name',
                              ],
                              fallback: 'Location',
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: _busy
                      ? null
                      : (value) {
                          setState(() {
                            _locationId = value;
                          });
                        },
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _batch,
                  decoration: const InputDecoration(
                    labelText: 'Batch number',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _quantity,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Quantity received',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _expiry,
                  keyboardType: TextInputType.datetime,
                  decoration: const InputDecoration(
                    labelText: 'Expiry date (YYYY-MM-DD)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _unitCost,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Unit cost',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _sellingPrice,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Selling price',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _supplierName,
                  decoration: const InputDecoration(
                    labelText: 'Supplier name',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _reference,
                  decoration: const InputDecoration(
                    labelText: 'Reference number',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _reason,
                  decoration: const InputDecoration(
                    labelText: 'Reason / receiving note',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                if (_error != null) _ErrorBox(_error!),
                if (_notice != null)
                  Text(
                    _notice!,
                    style: const TextStyle(
                      color: _green,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: widget.offline || _busy ? null : _receive,
                    child: Text(
                      _busy ? 'Receiving…' : 'Receive stock',
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class Rc6ProcurementView extends StatefulWidget {
  const Rc6ProcurementView({
    required this.profile,
    required this.offline,
    required this.business,
    required this.payloads,
    required this.errors,
    required this.tenantName,
    required this.branchName,
    required this.onRefresh,
    required this.onApprove,
    required this.onCancel,
    super.key,
  });

  final Map<String, dynamic> profile;
  final bool offline;
  final BusinessApiRepository business;
  final Map<String, Map<String, dynamic>> payloads;
  final Map<String, String> errors;
  final String tenantName;
  final String? branchName;
  final Future<void> Function() onRefresh;

  final Future<void> Function(
    Map<String, dynamic> purchaseOrder,
  ) onApprove;

  final Future<void> Function(
    Map<String, dynamic> purchaseOrder,
  ) onCancel;

  @override
  State<Rc6ProcurementView> createState() => _Rc6ProcurementViewState();
}

class _Rc6ProcurementViewState extends State<Rc6ProcurementView> {
  final _supplierName = TextEditingController();
  final _supplierLegalName = TextEditingController();
  final _supplierCode = TextEditingController();
  final _supplierType = TextEditingController();
  final _supplierContact = TextEditingController();
  final _supplierPhone = TextEditingController();
  final _supplierEmail = TextEditingController();
  final _supplierTax = TextEditingController();
  final _supplierLicense = TextEditingController();
  final _supplierAddress = TextEditingController();
  final _supplierTerms = TextEditingController();
  final _supplierNotes = TextEditingController();

  late final TextEditingController _poBranch;

  final _poQuantity = TextEditingController();
  final _poUnitCost = TextEditingController();
  final _poExpectedDate = TextEditingController();
  final _poOrderDate = TextEditingController();
  final _poDiscount = TextEditingController();
  final _poTax = TextEditingController();
  final _poShipping = TextEditingController();
  final _poNotes = TextEditingController();
  final _poLineNotes = TextEditingController();

  final _receiveBatch = TextEditingController();
  final _receiveQuantity = TextEditingController();
  final _receiveExpiry = TextEditingController();
  final _receiveUnitCost = TextEditingController();
  final _receiveSellingPrice = TextEditingController();

  String _supplierStatus = 'active';

  String? _poSupplierId;
  String? _poProductId;

  String? _receivePoId;
  Map<String, dynamic>? _receivePoDetail;

  String? _receiveItemId;
  String? _receiveProductId;
  String? _receiveLocationId;

  bool _busy = false;
  bool _detailBusy = false;

  String? _poActionBusy;

  String? _error;
  String? _notice;

  @override
  void initState() {
    super.initState();

    _poBranch = TextEditingController(
      text: _branchId(widget.profile)?.toString() ?? '',
    );
  }

  @override
  void dispose() {
    for (final controller in <TextEditingController>[
      _supplierName,
      _supplierLegalName,
      _supplierCode,
      _supplierType,
      _supplierContact,
      _supplierPhone,
      _supplierEmail,
      _supplierTax,
      _supplierLicense,
      _supplierAddress,
      _supplierTerms,
      _supplierNotes,
      _poBranch,
      _poQuantity,
      _poUnitCost,
      _poExpectedDate,
      _poOrderDate,
      _poDiscount,
      _poTax,
      _poShipping,
      _poNotes,
      _poLineNotes,
      _receiveBatch,
      _receiveQuantity,
      _receiveExpiry,
      _receiveUnitCost,
      _receiveSellingPrice,
    ]) {
      controller.dispose();
    }

    super.dispose();
  }

  Future<void> _mutate(
    Future<Map<String, dynamic>> Function() action,
    String fallback,
  ) async {
    if (_busy) return;

    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });

    try {
      final response = await action();

      if (!mounted) return;

      setState(() {
        _notice = _value(
          response,
          const <String>[
            'message',
            'status',
          ],
          fallback: fallback,
        );
      });

      await widget.onRefresh();
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _runPoAction(
    String key,
    Future<void> Function() action,
  ) async {
    if (_poActionBusy != null) {
      return;
    }

    setState(() {
      _poActionBusy = key;
      _error = null;
    });

    try {
      await action();
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _poActionBusy = null;
        });
      }
    }
  }

  Future<void> _createSupplier() async {
    if (widget.offline || _busy) {
      return;
    }

    final canCreateSupplier = _can(
          widget.profile,
          'pharmaco.procurement.suppliers.manage',
        ) &&
        _can(
          widget.profile,
          'pharmaco.procurement.suppliers.create',
        );

    if (!canCreateSupplier) {
      setState(() {
        _error = 'You do not have permission to create suppliers.';
        _notice = null;
      });
      return;
    }

    if (_supplierName.text.trim().isEmpty) {
      setState(() {
        _error = 'Supplier name is required.';
        _notice = null;
      });

      return;
    }

    final payload = <String, dynamic>{
      'name': _supplierName.text.trim(),
      if (_supplierLegalName.text.trim().isNotEmpty)
        'legal_name': _supplierLegalName.text.trim(),
      if (_supplierCode.text.trim().isNotEmpty)
        'supplier_code': _supplierCode.text.trim(),
      'status': _supplierStatus,
      if (_supplierType.text.trim().isNotEmpty)
        'supplier_type': _supplierType.text.trim(),
      if (_supplierContact.text.trim().isNotEmpty)
        'contact_person': _supplierContact.text.trim(),
      if (_supplierPhone.text.trim().isNotEmpty)
        'phone': _supplierPhone.text.trim(),
      if (_supplierEmail.text.trim().isNotEmpty)
        'email': _supplierEmail.text.trim(),
      if (_supplierTax.text.trim().isNotEmpty)
        'tax_identification_number': _supplierTax.text.trim(),
      if (_supplierLicense.text.trim().isNotEmpty)
        'license_number': _supplierLicense.text.trim(),
      if (_supplierAddress.text.trim().isNotEmpty)
        'address': _supplierAddress.text.trim(),
      if (_supplierTerms.text.trim().isNotEmpty)
        'payment_terms': _supplierTerms.text.trim(),
      if (_supplierNotes.text.trim().isNotEmpty)
        'notes': _supplierNotes.text.trim(),
    };

    await _mutate(
      () => widget.business.createSupplier(
        payload,
      ),
      'Supplier created.',
    );
  }

  Future<void> _createPo() async {
    if (widget.offline || _busy) {
      return;
    }

    if (!_can(
      widget.profile,
      'pharmaco.procurement.purchase_order.create',
    )) {
      setState(() {
        _error = 'You do not have permission to create Purchase Orders.';
        _notice = null;
      });
      return;
    }

    final branchId = int.tryParse(_poBranch.text.trim());

    final supplierId = int.tryParse(_poSupplierId ?? '');

    final productId = int.tryParse(_poProductId ?? '');

    final quantity = double.tryParse(_poQuantity.text.trim());

    final unitCost = double.tryParse(_poUnitCost.text.trim());

    if (branchId == null ||
        supplierId == null ||
        productId == null ||
        quantity == null ||
        quantity <= 0 ||
        unitCost == null ||
        unitCost < 0) {
      setState(() {
        _error =
            'Branch, supplier, product, quantity and unit cost are required.';
        _notice = null;
      });

      return;
    }

    final payload = <String, dynamic>{
      'branch_id': branchId,
      'pharmaco_supplier_id': supplierId,
      'purchase_type': 'core_products',
      if (_poExpectedDate.text.trim().isNotEmpty)
        'expected_delivery_date': _poExpectedDate.text.trim(),
      if (_poOrderDate.text.trim().isNotEmpty)
        'order_date': _poOrderDate.text.trim(),
      if (double.tryParse(
            _poDiscount.text.trim(),
          ) !=
          null)
        'discount_amount': double.parse(
          _poDiscount.text.trim(),
        ),
      if (double.tryParse(
            _poTax.text.trim(),
          ) !=
          null)
        'tax_amount': double.parse(
          _poTax.text.trim(),
        ),
      if (double.tryParse(
            _poShipping.text.trim(),
          ) !=
          null)
        'shipping_amount': double.parse(
          _poShipping.text.trim(),
        ),
      if (_poNotes.text.trim().isNotEmpty) 'notes': _poNotes.text.trim(),
      'items': <Map<String, dynamic>>[
        <String, dynamic>{
          'product_id': productId,
          'quantity_ordered': quantity,
          'unit_cost': unitCost,
          'discount_amount': 0,
          'tax_amount': 0,
          if (_poLineNotes.text.trim().isNotEmpty)
            'notes': _poLineNotes.text.trim(),
        },
      ],
    };

    await _mutate(
      () => widget.business.createPurchaseOrder(
        payload,
      ),
      'Purchase Order created.',
    );
  }

  Future<void> _loadPo() async {
    if (_receivePoId == null || _detailBusy) {
      return;
    }

    final canReceivePurchaseOrder = _can(
          widget.profile,
          'pharmaco.product_inventory.receive',
        ) &&
        _can(
          widget.profile,
          'pharmaco.procurement.purchase_order.receive',
        );

    if (!canReceivePurchaseOrder) {
      setState(() {
        _error = 'You do not have permission to receive Purchase Orders.';
      });
      return;
    }

    setState(() {
      _detailBusy = true;
      _error = null;
    });

    try {
      final detail = await widget.business.loadPurchaseOrder(
        _receivePoId!,
      );

      if (!mounted) return;

      final directPo = _map(
        detail['purchase_order'],
      );

      final purchaseOrder = directPo.isNotEmpty ? directPo : _map(detail);

      final status = _value(
        purchaseOrder,
        const <String>['status'],
        fallback: '',
      ).toLowerCase();

      final purchaseType = _value(
        purchaseOrder,
        const <String>['purchase_type'],
        fallback: '',
      ).toLowerCase();

      if (!<String>{
            'approved',
            'partially_received',
          }.contains(status) ||
          purchaseType != 'core_products') {
        throw StateError(
          'Only approved or partially received Core Products Purchase Orders can be received.',
        );
      }

      setState(() {
        _receivePoDetail = detail;
        _receiveItemId = null;
        _receiveProductId = null;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _detailBusy = false;
        });
      }
    }
  }

  List<Map<String, dynamic>> _poItems() {
    if (_receivePoDetail == null) {
      return const <Map<String, dynamic>>[];
    }

    final direct = _rows(
      _receivePoDetail!['items'],
    );

    final purchaseOrder = _map(
      _receivePoDetail!['purchase_order'],
    );

    final items = direct.isNotEmpty
        ? direct
        : _rows(
            purchaseOrder['items'],
          );

    return items.where(
      (row) {
        final product = row['product'];

        final hasProduct = (product is Map && product['id'] != null) ||
            row['product_id'] != null;

        final ordered = _number(
              row['quantity_ordered'],
            ) ??
            0;

        final received = _number(
              row['quantity_received'],
            ) ??
            0;

        return hasProduct && ordered > 0 && received < ordered;
      },
    ).toList();
  }

  Future<void> _receivePo() async {
    if (widget.offline || _busy) {
      return;
    }

    final canReceivePurchaseOrder = _can(
          widget.profile,
          'pharmaco.product_inventory.receive',
        ) &&
        _can(
          widget.profile,
          'pharmaco.procurement.purchase_order.receive',
        );

    if (!canReceivePurchaseOrder) {
      setState(() {
        _error = 'You do not have permission to receive Purchase Orders.';
        _notice = null;
      });
      return;
    }

    final itemId = int.tryParse(_receiveItemId ?? '');

    final productId = int.tryParse(_receiveProductId ?? '');

    final locationId = int.tryParse(_receiveLocationId ?? '');

    final quantity = double.tryParse(
      _receiveQuantity.text.trim(),
    );

    Map<String, dynamic>? selectedItem;

    if (itemId != null) {
      for (final row in _poItems()) {
        if (_id(row)?.toString() == itemId.toString()) {
          selectedItem = row;
          break;
        }
      }
    }

    final ordered = _number(
          selectedItem?['quantity_ordered'],
        ) ??
        0;

    final alreadyReceived = _number(
          selectedItem?['quantity_received'],
        ) ??
        0;

    final remaining = ordered - alreadyReceived;

    if (itemId == null ||
        productId == null ||
        locationId == null ||
        quantity == null ||
        quantity <= 0 ||
        selectedItem == null ||
        remaining <= 0 ||
        _receiveBatch.text.trim().isEmpty) {
      setState(() {
        _error =
            'PO item, product, stock location, batch and valid quantity are required.';
        _notice = null;
      });

      return;
    }

    if (quantity > remaining) {
      setState(() {
        _error =
            'Received quantity cannot exceed the remaining quantity of $remaining.';
        _notice = null;
      });
      return;
    }

    final payload = <String, dynamic>{
      'product_id': productId,
      'stock_location_id': locationId,
      'pharmaco_purchase_order_item_id': itemId,
      'batch_number': _receiveBatch.text.trim(),
      'quantity': quantity,
      'expiry_date': _optional(_receiveExpiry.text),
      'unit_cost': double.tryParse(
        _receiveUnitCost.text.trim(),
      ),
      'selling_price': double.tryParse(
        _receiveSellingPrice.text.trim(),
      ),
      'reason':
          'Stock received through the focused Procurement receiving workspace.',
    };

    await _mutate(
      () => widget.business.receiveInventory(
        payload,
      ),
      'Purchase Order stock received.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final suppliers = _rows(
      widget.payloads['suppliers'],
      const <String>['suppliers'],
    );

    final purchaseOrders = _rows(
      widget.payloads['purchase_orders'],
      const <String>[
        'purchase_orders',
      ],
    );

    final products = _rows(
      widget.payloads['products'],
      const <String>['products'],
    );

    final locations = _rows(
      widget.payloads['inventory_locations'],
      const <String>['locations'],
    );

    final report = _payload(
      widget.payloads,
      'reports_procurement',
    );

    final activeSuppliers = suppliers
        .where(
          (row) =>
              _value(
                row,
                const <String>['status'],
                fallback: '',
              ).toLowerCase() ==
              'active',
        )
        .length;

    final approvalAttention = purchaseOrders
        .where(
          (row) => <String>{
            'draft',
            'pending',
            'submitted',
          }.contains(
            _value(
              row,
              const <String>['status'],
              fallback: '',
            ).toLowerCase(),
          ),
        )
        .length;

    final receivingProgress = purchaseOrders
        .where(
          (row) => <String>{
            'approved',
            'partially_received',
          }.contains(
            _value(
              row,
              const <String>['status'],
              fallback: '',
            ).toLowerCase(),
          ),
        )
        .length;

    final canManageSuppliers = _can(
      widget.profile,
      'pharmaco.procurement.suppliers.manage',
    );

    final canCreateSupplier = canManageSuppliers &&
        _can(
          widget.profile,
          'pharmaco.procurement.suppliers.create',
        );

    final canCreatePurchaseOrder = _can(
      widget.profile,
      'pharmaco.procurement.purchase_order.create',
    );

    final canReceivePurchaseOrder = _can(
          widget.profile,
          'pharmaco.product_inventory.receive',
        ) &&
        _can(
          widget.profile,
          'pharmaco.procurement.purchase_order.receive',
        );

    final eligibleReceivePurchaseOrders = purchaseOrders.where(
      (row) {
        final status = _value(
          row,
          const <String>['status'],
          fallback: '',
        ).toLowerCase();

        final purchaseType = _value(
          row,
          const <String>['purchase_type'],
          fallback: '',
        ).toLowerCase();

        return purchaseType == 'core_products' &&
            <String>{
              'approved',
              'partially_received',
            }.contains(status);
      },
    ).toList();

    return _Page(
      title: 'Procurement',
      subtitle: 'Supplier, ordering, approval and receiving operations.',
      tenantName: widget.tenantName,
      branchName: widget.branchName,
      offline: widget.offline,
      onRefresh: widget.onRefresh,
      children: <Widget>[
        _Section(
          title: 'Procurement Operations',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              if (canCreateSupplier)
                const _Chip(
                  'Create Supplier',
                ),
              if (canManageSuppliers)
                const _Chip(
                  'Supplier List',
                ),
              if (canCreatePurchaseOrder)
                const _Chip(
                  'Create Purchase Order',
                ),
              const _Chip(
                'Outstanding Purchase Orders',
              ),
              if (canReceivePurchaseOrder)
                const _Chip(
                  'Receive Purchase Order',
                ),
              const _Chip(
                'Received Purchase Orders',
              ),
            ],
          ),
        ),
        _Section(
          title: 'Procurement health',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              _Metric(
                'Active Suppliers',
                suppliers.isEmpty ? '—' : activeSuppliers.toString(),
              ),
              _Metric(
                'POs',
                purchaseOrders.isEmpty ? '—' : purchaseOrders.length.toString(),
              ),
              _Metric(
                'Approval Attention',
                approvalAttention.toString(),
              ),
              _Metric(
                'Receiving Progress',
                receivingProgress.toString(),
              ),
              _Metric(
                'Total Procurement Value',
                _money(
                  _pick(
                    report,
                    const <String>[
                      'total_procurement_value',
                      'total_purchase_order_value',
                    ],
                  ),
                ),
              ),
              _Metric(
                'Open Commitment',
                _money(
                  _pick(
                    report,
                    const <String>[
                      'open_commitment',
                      'open_commitments',
                    ],
                  ),
                ),
              ),
              _Metric(
                'Supplier Concentration',
                _pick(
                      report,
                      const <String>[
                        'supplier_concentration',
                      ],
                    )?.toString() ??
                    '—',
              ),
            ],
          ),
        ),
        if (_error != null)
          _Section(
            title: 'Action needs attention',
            child: _ErrorBox(_error!),
          ),
        if (_notice != null)
          _Section(
            title: 'Latest action',
            child: Text(
              _notice!,
              style: const TextStyle(
                color: _green,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        if (canCreateSupplier)
          _Section(
            title: 'Create Supplier',
            child: Column(
              children: <Widget>[
                TextField(
                  controller: _supplierName,
                  decoration: const InputDecoration(
                    labelText: 'Supplier name',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _supplierLegalName,
                  decoration: const InputDecoration(
                    labelText: 'Legal name',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _supplierCode,
                  decoration: const InputDecoration(
                    labelText: 'Supplier code',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _supplierType,
                  decoration: const InputDecoration(
                    labelText: 'Supplier type',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _supplierContact,
                  decoration: const InputDecoration(
                    labelText: 'Contact person',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _supplierPhone,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Phone',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _supplierEmail,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _supplierTax,
                  decoration: const InputDecoration(
                    labelText: 'Tax identification number',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _supplierLicense,
                  decoration: const InputDecoration(
                    labelText: 'License number',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _supplierAddress,
                  decoration: const InputDecoration(
                    labelText: 'Address',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _supplierTerms,
                  decoration: const InputDecoration(
                    labelText: 'Payment terms',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _supplierNotes,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Notes',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: _supplierStatus,
                  decoration: const InputDecoration(
                    labelText: 'Status',
                    border: OutlineInputBorder(),
                  ),
                  items: const <DropdownMenuItem<String>>[
                    DropdownMenuItem(
                      value: 'active',
                      child: Text('Active'),
                    ),
                    DropdownMenuItem(
                      value: 'inactive',
                      child: Text('Inactive'),
                    ),
                  ],
                  onChanged: _busy
                      ? null
                      : (value) {
                          if (value != null) {
                            setState(() {
                              _supplierStatus = value;
                            });
                          }
                        },
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: widget.offline || _busy ? null : _createSupplier,
                    child: const Text(
                      'Create Supplier',
                    ),
                  ),
                ),
              ],
            ),
          ),
        if (canCreatePurchaseOrder)
          _Section(
            title: 'Create Purchase Order',
            subtitle: 'Core Products Purchase',
            child: Column(
              children: <Widget>[
                TextField(
                  controller: _poBranch,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Branch ID',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: suppliers.any(
                    (row) => _id(row)?.toString() == _poSupplierId,
                  )
                      ? _poSupplierId
                      : null,
                  decoration: const InputDecoration(
                    labelText: 'Supplier',
                    border: OutlineInputBorder(),
                  ),
                  items: suppliers
                      .where(
                        (row) => _id(row) != null,
                      )
                      .map(
                        (row) => DropdownMenuItem<String>(
                          value: _id(row)!.toString(),
                          child: Text(
                            _value(
                              row,
                              const <String>[
                                'name',
                                'legal_name',
                              ],
                              fallback: 'Supplier',
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: _busy
                      ? null
                      : (value) {
                          setState(() {
                            _poSupplierId = value;
                          });
                        },
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: products.any(
                    (row) => _id(row)?.toString() == _poProductId,
                  )
                      ? _poProductId
                      : null,
                  decoration: const InputDecoration(
                    labelText: 'Core product',
                    border: OutlineInputBorder(),
                  ),
                  items: products
                      .where(
                        (row) => _id(row) != null,
                      )
                      .map(
                        (row) => DropdownMenuItem<String>(
                          value: _id(row)!.toString(),
                          child: Text(
                            _value(
                              row,
                              const <String>[
                                'name',
                                'product_name',
                              ],
                              fallback: 'Product',
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: _busy
                      ? null
                      : (value) {
                          setState(() {
                            _poProductId = value;
                          });
                        },
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _poQuantity,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Quantity ordered',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _poUnitCost,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Unit cost',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _poOrderDate,
                  keyboardType: TextInputType.datetime,
                  decoration: const InputDecoration(
                    labelText: 'Order date (YYYY-MM-DD)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _poExpectedDate,
                  keyboardType: TextInputType.datetime,
                  decoration: const InputDecoration(
                    labelText: 'Expected delivery date',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _poDiscount,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Discount amount',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _poTax,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Tax amount',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _poShipping,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Shipping amount',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _poLineNotes,
                  decoration: const InputDecoration(
                    labelText: 'Line notes',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _poNotes,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Purchase Order notes',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: widget.offline || _busy ? null : _createPo,
                    child: const Text(
                      'Create Purchase Order',
                    ),
                  ),
                ),
              ],
            ),
          ),
        if (canReceivePurchaseOrder)
          _Section(
            title: 'Receive Purchase Order',
            child: Column(
              children: <Widget>[
                DropdownButtonFormField<String>(
                  initialValue: eligibleReceivePurchaseOrders.any(
                    (row) => _id(row)?.toString() == _receivePoId,
                  )
                      ? _receivePoId
                      : null,
                  decoration: const InputDecoration(
                    labelText: 'Purchase Order',
                    border: OutlineInputBorder(),
                  ),
                  items: eligibleReceivePurchaseOrders
                      .where(
                        (row) => _id(row) != null,
                      )
                      .map(
                        (row) => DropdownMenuItem<String>(
                          value: _id(row)!.toString(),
                          child: Text(
                            _value(
                              row,
                              const <String>[
                                'po_number',
                                'purchase_order_number',
                              ],
                              fallback: 'Purchase Order',
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: _detailBusy
                      ? null
                      : (value) {
                          setState(() {
                            _receivePoId = value;
                            _receivePoDetail = null;
                            _receiveItemId = null;
                            _receiveProductId = null;
                          });
                        },
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed:
                        _receivePoId == null || _detailBusy ? null : _loadPo,
                    child: Text(
                      _detailBusy ? 'Loading…' : 'Load Purchase Order items',
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Builder(
                  builder: (context) {
                    final items = _poItems();

                    return DropdownButtonFormField<String>(
                      initialValue: items.any(
                        (row) => _id(row)?.toString() == _receiveItemId,
                      )
                          ? _receiveItemId
                          : null,
                      decoration: const InputDecoration(
                        labelText: 'Purchase Order item',
                        border: OutlineInputBorder(),
                      ),
                      items: items
                          .where(
                            (row) => _id(row) != null,
                          )
                          .map(
                            (row) => DropdownMenuItem<String>(
                              value: _id(row)!.toString(),
                              child: Text(
                                _value(
                                  row,
                                  const <String>[
                                    'product_name_snapshot',
                                    'product_name',
                                  ],
                                  fallback: 'PO item',
                                ),
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: _busy
                          ? null
                          : (value) {
                              setState(() {
                                _receiveItemId = value;

                                for (final row in items) {
                                  if (_id(row)?.toString() != value) {
                                    continue;
                                  }

                                  final product = row['product'];

                                  if (product is Map && product['id'] != null) {
                                    _receiveProductId =
                                        product['id'].toString();
                                  } else if (row['product_id'] != null) {
                                    _receiveProductId =
                                        row['product_id'].toString();
                                  }

                                  if (row['unit_cost'] != null) {
                                    _receiveUnitCost.text =
                                        row['unit_cost'].toString();
                                  }

                                  final ordered = _number(
                                    row['quantity_ordered'],
                                  );

                                  final received = _number(
                                    row['quantity_received'],
                                  );

                                  if (ordered != null) {
                                    final remaining = ordered - (received ?? 0);

                                    _receiveQuantity.text =
                                        (remaining < 0 ? 0 : remaining)
                                            .toString();
                                  }

                                  break;
                                }
                              });
                            },
                    );
                  },
                ),
                const SizedBox(height: 8),
                TextFormField(
                  key: ValueKey<String>(
                    'product-${_receiveProductId ?? ''}',
                  ),
                  initialValue: _receiveProductId ?? '',
                  enabled: false,
                  decoration: const InputDecoration(
                    labelText: 'Product ID',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: locations.any(
                    (row) => _id(row)?.toString() == _receiveLocationId,
                  )
                      ? _receiveLocationId
                      : null,
                  decoration: const InputDecoration(
                    labelText: 'Stock location',
                    border: OutlineInputBorder(),
                  ),
                  items: locations
                      .where(
                        (row) => _id(row) != null,
                      )
                      .map(
                        (row) => DropdownMenuItem<String>(
                          value: _id(row)!.toString(),
                          child: Text(
                            _value(
                              row,
                              const <String>[
                                'name',
                                'location_name',
                              ],
                              fallback: 'Location',
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: _busy
                      ? null
                      : (value) {
                          setState(() {
                            _receiveLocationId = value;
                          });
                        },
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _receiveBatch,
                  decoration: const InputDecoration(
                    labelText: 'Batch number',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _receiveQuantity,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Quantity received',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _receiveExpiry,
                  keyboardType: TextInputType.datetime,
                  decoration: const InputDecoration(
                    labelText: 'Expiry date',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _receiveUnitCost,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Unit cost',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _receiveSellingPrice,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Selling price',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: widget.offline || _busy ? null : _receivePo,
                    child: const Text(
                      'Receive Purchase Order',
                    ),
                  ),
                ),
              ],
            ),
          ),
        _Section(
          title: 'Outstanding Purchase Orders',
          child: purchaseOrders.isEmpty
              ? const _Empty(
                  'No Purchase Orders are loaded.',
                )
              : Column(
                  children: purchaseOrders
                      .where(
                        (row) => !<String>{
                          'received',
                          'completed',
                          'cancelled',
                        }.contains(
                          _value(
                            row,
                            const <String>[
                              'status',
                            ],
                            fallback: '',
                          ).toLowerCase(),
                        ),
                      )
                      .take(8)
                      .map(
                    (row) {
                      final id = _id(row);

                      final approveKey = 'approve-$id';

                      return Column(
                        children: <Widget>[
                          _RowCard(
                            title: _value(
                              row,
                              const <String>[
                                'po_number',
                                'purchase_order_number',
                              ],
                              fallback: 'Purchase Order',
                            ),
                            subtitle: _value(
                              row,
                              const <String>[
                                'status',
                                'supplier_name',
                              ],
                            ),
                            trailing: _money(
                              _pick(
                                row,
                                const <String>[
                                  'total_amount',
                                  'total',
                                ],
                              ),
                            ),
                          ),
                          Row(
                            children: <Widget>[
                              if (_can(
                                widget.profile,
                                'pharmaco.procurement.purchase_order.approve',
                              ))
                                Expanded(
                                  child: FilledButton(
                                    onPressed:
                                        id == null || _poActionBusy != null
                                            ? null
                                            : () async {
                                                await _runPoAction(
                                                  approveKey,
                                                  () async {
                                                    await widget.onApprove(
                                                      row,
                                                    );
                                                  },
                                                );
                                              },
                                    child: Text(
                                      _poActionBusy == approveKey
                                          ? 'Approving…'
                                          : 'Approve',
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(
                            height: 8,
                          ),
                        ],
                      );
                    },
                  ).toList(),
                ),
        ),
        _Section(
          title: 'Received Purchase Orders',
          child: Column(
            children: purchaseOrders
                .where(
                  (row) => <String>{
                    'received',
                    'completed',
                  }.contains(
                    _value(
                      row,
                      const <String>[
                        'status',
                      ],
                      fallback: '',
                    ).toLowerCase(),
                  ),
                )
                .take(8)
                .map(
                  (row) => _RowCard(
                    title: _value(
                      row,
                      const <String>[
                        'po_number',
                        'purchase_order_number',
                      ],
                      fallback: 'Purchase Order',
                    ),
                    subtitle: _value(
                      row,
                      const <String>[
                        'status',
                      ],
                    ),
                    trailing: _money(
                      row['total_amount'],
                    ),
                  ),
                )
                .toList(),
          ),
        ),
      ],
    );
  }
}

class Rc6MoreView extends StatelessWidget {
  const Rc6MoreView({
    required this.profile,
    required this.offline,
    required this.payloads,
    required this.errors,
    required this.tenantName,
    required this.branchName,
    required this.onRefresh,
    required this.updateVersionName,
    required this.updateMandatory,
    required this.updateNotice,
    required this.updateChecking,
    required this.updateBusy,
    required this.onCheckUpdate,
    required this.onInstallUpdate,
    required this.onLogout,
    super.key,
  });

  final Map<String, dynamic> profile;
  final bool offline;
  final Map<String, Map<String, dynamic>> payloads;
  final Map<String, String> errors;
  final String tenantName;
  final String? branchName;
  final Future<void> Function() onRefresh;

  final String? updateVersionName;
  final bool updateMandatory;
  final String? updateNotice;
  final bool updateChecking;
  final bool updateBusy;

  final Future<void> Function() onCheckUpdate;

  final Future<void> Function()? onInstallUpdate;

  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final modules = <Widget>[];

    if (_hasPrefix(
      profile,
      'reports.',
    )) {
      modules.add(
        const _Chip('Reports'),
      );
    }

    if (_hasPrefix(
          profile,
          'finance.',
        ) ||
        _hasPrefix(
          profile,
          'pharmaco.finance.',
        )) {
      modules.add(
        const _Chip('Finance'),
      );
    }

    if (_hasPrefix(
      profile,
      'tenant.',
    )) {
      modules.add(
        const _Chip('Tenant Setup'),
      );
    }

    if (_hasPrefix(
          profile,
          'users.',
        ) ||
        _hasPrefix(
          profile,
          'security.',
        )) {
      modules.add(
        const _Chip('Users / Security'),
      );
    }

    if (_can(
      profile,
      'communications.email.view',
    )) {
      modules.add(
        const _Chip('Corporate Email'),
      );
    }

    if (_can(
      profile,
      'communications.chat.view',
    )) {
      modules.add(
        const _Chip('Pharmacist Chat'),
      );
    }

    if (_can(
      profile,
      'communications.notifications.view',
    )) {
      modules.add(
        const _Chip('Notifications'),
      );
    }

    if (_hasPrefix(
          profile,
          'settings.',
        ) ||
        _hasPrefix(
          profile,
          'platform.',
        ) ||
        _hasPrefix(
          profile,
          'tenant.',
        )) {
      modules.add(
        const _Chip(
          'Settings / Administration',
        ),
      );
    }

    return _Page(
      title: 'More',
      subtitle: 'Permission-aware workspace, session and Preview controls.',
      tenantName: tenantName,
      branchName: branchName,
      offline: offline,
      onRefresh: onRefresh,
      children: <Widget>[
        _Section(
          title: 'Your modules',
          child: modules.isEmpty
              ? const _Empty(
                  'No additional permission-driven modules are available.',
                )
              : Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: modules,
                ),
        ),
        _Section(
          title: 'Preview Update Management',
          child: Column(
            children: <Widget>[
              _RowCard(
                title: updateVersionName == null
                    ? 'No downloaded update offer'
                    : 'Available: $updateVersionName',
                subtitle: updateMandatory
                    ? 'Mandatory Preview update'
                    : 'Preview update status',
                trailing: updateNotice,
              ),
              const SizedBox(height: 8),
              Row(
                children: <Widget>[
                  Expanded(
                    child: OutlinedButton(
                      onPressed: updateChecking
                          ? null
                          : () async {
                              await onCheckUpdate();
                            },
                      child: const Text(
                        'Check update',
                      ),
                    ),
                  ),
                  if (onInstallUpdate != null) ...<Widget>[
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton(
                        onPressed: updateBusy
                            ? null
                            : () async {
                                await onInstallUpdate!();
                              },
                        child: const Text(
                          'Install',
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
        _Section(
          title: 'Session',
          subtitle: '${_userName(profile)} · ${_roleName(profile)}',
          child: SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: onLogout,
              icon: const Icon(
                Icons.logout,
              ),
              label: const Text(
                'Log out securely',
              ),
            ),
          ),
        ),
      ],
    );
  }
}
