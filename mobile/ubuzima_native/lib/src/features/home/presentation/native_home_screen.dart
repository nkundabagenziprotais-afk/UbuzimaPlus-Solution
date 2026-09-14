import 'package:flutter/material.dart';

import '../../update/data/preview_update_service.dart';

import '../../../core/network/native_api_client.dart';
import '../../../core/theme/ubuzima_brand.dart';
import '../../../shared/presentation/ubuzima_brand_logo.dart';
import '../../auth/presentation/native_auth_controller.dart';
import '../../business/data/business_api_repository.dart';

class NativeHomeScreen extends StatefulWidget {
  const NativeHomeScreen({
    required this.controller,
    required this.profile,
    required this.offline,
    super.key,
  });

  final NativeAuthController controller;
  final Map<String, dynamic> profile;
  final bool offline;

  @override
  State<NativeHomeScreen> createState() => _NativeHomeScreenState();
}

class _NativeHomeScreenState extends State<NativeHomeScreen>
    with WidgetsBindingObserver {
  late final BusinessApiRepository _business;

  final Map<String, Map<String, dynamic>> _payloads =
      <String, Map<String, dynamic>>{};
  final Map<String, String> _errors = <String, String>{};

  int _index = 0;
  bool _loading = false;
  String? _actionBusy;

  final PreviewUpdateService _updateService = const PreviewUpdateService();

  bool _updateChecking = false;
  bool _updateBusy = false;
  PreviewUpdateManifest? _availableUpdate;
  String? _updateNotice;
  String? _preparedUpdatePath;
  String? _preparedUpdateSha;
  int? _preparedVersionCode;
  int? _lastPromptedVersionCode;

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addObserver(this);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _checkForUpdate(silent: true);
      }
    });

    _business = BusinessApiRepository(
      readTenantSlug: _tenantSlug,
    );

    if (!widget.offline) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _refreshLiveData();
      });
    }
  }

  String _userName() {
    final user = widget.profile['user'];

    if (user is Map) {
      final name = user['name']?.toString().trim();

      if (name != null && name.isNotEmpty) {
        return name;
      }
    }

    return 'Team member';
  }

  String? _tenantSlug() {
    String? clean(dynamic value) {
      final text = value?.toString().trim();

      if (text == null || text.isEmpty) {
        return null;
      }

      return text;
    }

    final direct = clean(widget.profile['tenant_slug']) ??
        clean(widget.profile['tenantSlug']);

    if (direct != null) {
      return direct;
    }

    final currentTenant = widget.profile['current_tenant'];

    if (currentTenant is Map) {
      final slug = clean(currentTenant['slug']);

      if (slug != null) {
        return slug;
      }
    }

    final scope = widget.profile['scope'];

    if (scope is Map) {
      final scopeSlug =
          clean(scope['tenant_slug']) ?? clean(scope['tenantSlug']);

      if (scopeSlug != null) {
        return scopeSlug;
      }

      final scopeTenant = scope['tenant'];

      if (scopeTenant is Map) {
        final slug = clean(scopeTenant['slug']);

        if (slug != null) {
          return slug;
        }
      }
    }

    final tenant = widget.profile['tenant'];

    if (tenant is Map) {
      final slug = clean(tenant['slug']);

      if (slug != null) {
        return slug;
      }
    }

    final assignments = widget.profile['tenant_assignments'];

    if (assignments is List) {
      final candidates = <String>{};

      for (final assignment in assignments) {
        if (assignment is! Map) {
          continue;
        }

        final assignmentTenant = assignment['tenant'];

        if (assignmentTenant is! Map) {
          continue;
        }

        final slug = clean(assignmentTenant['slug']);

        if (slug == null) {
          continue;
        }

        final status = clean(assignment['status'])?.toLowerCase();

        if (status == 'active') {
          return slug;
        }

        candidates.add(slug);
      }

      if (candidates.length == 1) {
        return candidates.single;
      }
    }

    return null;
  }

  String? _tenantName() {
    final tenant = widget.profile['tenant'];

    if (tenant is Map) {
      final name = tenant['name']?.toString().trim();

      if (name != null && name.isNotEmpty) {
        return name;
      }
    }

    final assignments = widget.profile['tenant_assignments'];

    if (assignments is List && assignments.isNotEmpty) {
      final first = assignments.first;

      if (first is Map && first['tenant'] is Map) {
        final name = (first['tenant'] as Map)['name']?.toString().trim();

        if (name != null && name.isNotEmpty) {
          return name;
        }
      }
    }

    return null;
  }

  String? _branchName() {
    final branch = widget.profile['branch'];

    if (branch is Map) {
      final name = branch['name']?.toString().trim();

      if (name != null && name.isNotEmpty) {
        return name;
      }
    }

    final assignments = widget.profile['tenant_assignments'];

    if (assignments is List && assignments.isNotEmpty) {
      final first = assignments.first;

      if (first is Map && first['branch'] is Map) {
        final name = (first['branch'] as Map)['name']?.toString().trim();

        if (name != null && name.isNotEmpty) {
          return name;
        }
      }
    }

    return null;
  }

  Future<void> _loadModule(
    String key,
    Future<Map<String, dynamic>> Function() loader,
  ) async {
    try {
      final response = await loader();

      _payloads[key] = response;
      _errors.remove(key);
    } on ApiException catch (error) {
      if (error.statusCode == 403) {
        _errors[key] =
            'Your current role does not have permission to view this area.';
      } else if (error.statusCode == 401) {
        _errors[key] = 'Your secure session has expired. Please sign in again.';
      } else {
        _errors[key] = error.message;
      }
    } catch (_) {
      _errors[key] = 'Live information could not be loaded. Please try again.';
    }
  }

  Future<void> _refreshLiveData() async {
    if (widget.offline) {
      if (mounted) {
        setState(() {});
      }
      return;
    }

    if (mounted) {
      setState(() {
        _loading = true;
      });
    }

    await Future.wait(<Future<void>>[
      _loadModule('sales', _business.loadSales),
      _loadModule('products', _business.loadProducts),
      _loadModule('inventory', _business.loadInventorySummary),
      _loadModule('suppliers', _business.loadSuppliers),
      _loadModule('purchase_orders', _business.loadPurchaseOrders),
    ]);

    if (!mounted) {
      return;
    }

    setState(() {
      _loading = false;
    });
  }

  List<Map<String, dynamic>> _rows(String module, String key) {
    final raw = _payloads[module]?[key];

    if (raw is! List) {
      return const <Map<String, dynamic>>[];
    }

    return raw
        .whereType<Map>()
        .map(
          (row) =>
              row.map((key, dynamic value) => MapEntry(key.toString(), value)),
        )
        .toList();
  }

  Map<String, dynamic> _map(String module, String key) {
    final raw = _payloads[module]?[key];

    if (raw is Map<String, dynamic>) {
      return raw;
    }

    if (raw is Map) {
      return raw.map((key, dynamic value) => MapEntry(key.toString(), value));
    }

    return const <String, dynamic>{};
  }

  String _text(
    Map<String, dynamic> row,
    List<String> keys, {
    String fallback = '—',
  }) {
    for (final key in keys) {
      final value = row[key];

      if (value != null && value.toString().trim().isNotEmpty) {
        return value.toString().trim();
      }
    }

    return fallback;
  }

  String _nestedText(
    Map<String, dynamic> row,
    String key,
    List<String> childKeys, {
    String fallback = '—',
  }) {
    final nested = row[key];

    if (nested is Map) {
      final normalized = nested.map(
        (key, dynamic value) => MapEntry(key.toString(), value),
      );

      return _text(normalized, childKeys, fallback: fallback);
    }

    return fallback;
  }

  num? _number(dynamic value) {
    if (value is num) {
      return value;
    }

    if (value == null) {
      return null;
    }

    return num.tryParse(value.toString());
  }

  String _money(dynamic value) {
    final amount = _number(value);

    if (amount == null) {
      return '—';
    }

    return 'RWF ${amount.toStringAsFixed(0)}';
  }

  String _count(String module, String key) {
    if (!_payloads.containsKey(module)) {
      return '—';
    }

    return _rows(module, key).length.toString();
  }

  Future<bool> _confirm(String title, String message, String action) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Keep'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(action),
            ),
          ],
        );
      },
    );

    return confirmed ?? false;
  }

  Future<void> _approvePurchaseOrder(Map<String, dynamic> purchaseOrder) async {
    final id = purchaseOrder['id'];

    if (id == null) {
      return;
    }

    final poNumber = _text(
        purchaseOrder,
        <String>[
          'po_number',
          'number',
        ],
        fallback: 'this purchase order');

    final confirmed = await _confirm(
      'Approve purchase order?',
      'Approve $poNumber using your current authenticated role?',
      'Approve',
    );

    if (!confirmed || !mounted) {
      return;
    }

    setState(() {
      _actionBusy = 'approve-$id';
    });

    try {
      final response = await _business.approvePurchaseOrder(id);

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            response['message']?.toString() ??
                'Purchase order approved successfully.',
          ),
        ),
      );

      await _refreshLiveData();
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) {
        setState(() {
          _actionBusy = null;
        });
      }
    }
  }

  Future<void> _cancelPurchaseOrder(Map<String, dynamic> purchaseOrder) async {
    final id = purchaseOrder['id'];

    if (id == null) {
      return;
    }

    final poNumber = _text(
        purchaseOrder,
        <String>[
          'po_number',
          'number',
        ],
        fallback: 'this purchase order');

    final confirmed = await _confirm(
      'Cancel purchase order?',
      'Cancel $poNumber? This action is recorded by the server audit trail.',
      'Cancel order',
    );

    if (!confirmed || !mounted) {
      return;
    }

    setState(() {
      _actionBusy = 'cancel-$id';
    });

    try {
      final response = await _business.cancelPurchaseOrder(id);

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            response['message']?.toString() ??
                'Purchase order cancelled successfully.',
          ),
        ),
      );

      await _refreshLiveData();
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) {
        setState(() {
          _actionBusy = null;
        });
      }
    }
  }

  Widget _selectedBody(BuildContext context) {
    switch (_index) {
      case 0:
        return _home(context);
      case 1:
        return _sales(context);
      case 2:
        return _inventory(context);
      case 3:
        return _procurement(context);
      default:
        return _more(context);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(
    AppLifecycleState state,
  ) {
    if (state == AppLifecycleState.resumed) {
      _checkForUpdate(silent: true);
    }
  }

  Future<void> _checkForUpdate({
    required bool silent,
  }) async {
    if (_updateChecking || _updateBusy) {
      return;
    }

    setState(() {
      _updateChecking = true;

      if (!silent) {
        _updateNotice = 'Checking for updates...';
      }
    });

    try {
      final check = await _updateService.check();

      if (!mounted) {
        return;
      }

      final available = check.available;

      setState(() {
        _availableUpdate = available;

        if (available != null) {
          _updateNotice = '${available.versionName} is available.';
        } else if (check.notPublished) {
          _updateNotice = 'The Preview update channel is not published yet.';
        } else if (check.unsupportedPlatform) {
          _updateNotice = 'APK updates are available on Android Preview only.';
        } else {
          _updateNotice = 'Ubuzima+ Preview is up to date.';
        }
      });

      if (available == null) {
        if (!silent) {
          _showUpdateMessage(
            _updateNotice!,
          );
        }

        return;
      }

      if (available.mandatory) {
        return;
      }

      final shouldPrompt =
          !silent || _lastPromptedVersionCode != available.versionCode;

      if (shouldPrompt) {
        _lastPromptedVersionCode = available.versionCode;

        await _showOptionalUpdateDialog(
          available,
        );
      }
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _updateNotice = 'Update check could not be completed.';
      });

      if (!silent) {
        _showUpdateMessage(
          'Unable to check for updates right now. '
          'Your workspace is still available.',
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _updateChecking = false;
        });
      }
    }
  }

  Future<void> _showOptionalUpdateDialog(
    PreviewUpdateManifest update,
  ) async {
    if (!mounted) {
      return;
    }

    final shouldInstall = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Update available'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Ubuzima+ Preview '
                  '${update.versionName} is ready.',
                ),
                if (update.releaseNotes.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Text(
                    'What changed',
                    style: Theme.of(dialogContext).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 6),
                  ...update.releaseNotes.take(5).map(
                        (note) => Padding(
                          padding: const EdgeInsets.only(
                            bottom: 5,
                          ),
                          child: Text('• $note'),
                        ),
                      ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(
                  dialogContext,
                ).pop(false);
              },
              child: const Text('Later'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.of(
                  dialogContext,
                ).pop(true);
              },
              child: const Text('Update'),
            ),
          ],
        );
      },
    );

    if (shouldInstall == true && mounted) {
      await _installPreviewUpdate(
        update,
      );
    }
  }

  Future<bool> _installPreviewUpdate(
    PreviewUpdateManifest update,
  ) async {
    if (_updateBusy) {
      return false;
    }

    setState(() {
      _updateBusy = true;

      _updateNotice = 'Preparing ${update.versionName} securely...';
    });

    try {
      String path;

      if (_preparedVersionCode == update.versionCode &&
          _preparedUpdatePath != null &&
          _preparedUpdateSha == update.sha256) {
        path = _preparedUpdatePath!;
      } else {
        final prepared = await _updateService.prepare(
          update,
        );

        if (!mounted) {
          return false;
        }

        path = prepared.path;

        setState(() {
          _preparedUpdatePath = prepared.path;

          _preparedUpdateSha = update.sha256;

          _preparedVersionCode = update.versionCode;

          _updateNotice = 'Update verified. Opening Android installer...';
        });
      }

      final status = await _updateService.installPrepared(
        path: path,
        sha256: update.sha256,
      );

      if (!mounted) {
        return false;
      }

      if (status == 'installer_started') {
        setState(() {
          _updateNotice = 'Android Package Installer opened. '
              'Confirm the update to continue.';
        });

        return true;
      }

      if (status == 'permission_required') {
        final openSettings = await showDialog<bool>(
          context: context,
          builder: (dialogContext) {
            return AlertDialog(
              title: const Text(
                'Allow Preview updates',
              ),
              content: const Text(
                'Android needs permission to install '
                'verified updates from Ubuzima+ Preview. '
                'Open settings, allow this app, then '
                'return and tap Update again.',
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    Navigator.of(
                      dialogContext,
                    ).pop(false);
                  },
                  child: const Text(
                    'Not now',
                  ),
                ),
                FilledButton(
                  onPressed: () {
                    Navigator.of(
                      dialogContext,
                    ).pop(true);
                  },
                  child: const Text(
                    'Open settings',
                  ),
                ),
              ],
            );
          },
        );

        if (openSettings == true && mounted) {
          await _updateService.openInstallPermission();
        }

        return false;
      }

      throw StateError(
        'Android returned an unknown installer state.',
      );
    } catch (_) {
      if (mounted) {
        setState(() {
          _updateNotice = 'The update could not be prepared safely.';
        });

        _showUpdateMessage(
          'Update stopped before installation. '
          'No existing app data was changed.',
        );
      }

      return false;
    } finally {
      if (mounted) {
        setState(() {
          _updateBusy = false;
        });
      }
    }
  }

  void _showUpdateMessage(
    String message,
  ) {
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
      ),
    );
  }

  Widget _mandatoryUpdatePanel(
    BuildContext context,
  ) {
    final update = _availableUpdate!;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          24,
          32,
          24,
          32,
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            maxWidth: 520,
          ),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(
                24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.system_update_alt_rounded,
                    size: 42,
                  ),
                  const SizedBox(
                    height: 16,
                  ),
                  Text(
                    'Update required',
                    style: Theme.of(context).textTheme.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(
                    height: 10,
                  ),
                  Text(
                    'Ubuzima+ Preview '
                    '${update.versionName} is required '
                    'before this workspace can continue.',
                    textAlign: TextAlign.center,
                  ),
                  if (update.releaseNotes.isNotEmpty) ...[
                    const SizedBox(
                      height: 16,
                    ),
                    ...update.releaseNotes.take(5).map(
                          (note) => Padding(
                            padding: const EdgeInsets.only(
                              bottom: 5,
                            ),
                            child: Text(
                              '• $note',
                            ),
                          ),
                        ),
                  ],
                  const SizedBox(
                    height: 20,
                  ),
                  FilledButton.icon(
                    onPressed: _updateBusy
                        ? null
                        : () => _installPreviewUpdate(
                              update,
                            ),
                    icon: const Icon(
                      Icons.download_rounded,
                    ),
                    label: Text(
                      _updateBusy ? 'Preparing update...' : 'Update now',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 18,
        title: const UbuzimaBrandLogo(
          width: 118,
          alignment: Alignment.centerLeft,
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh live data',
            onPressed: _loading ? null : _refreshLiveData,
            icon: const Icon(Icons.refresh_rounded),
          ),
          IconButton(
            tooltip: 'Log out',
            onPressed: widget.controller.logout,
            icon: const Icon(Icons.logout_rounded),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: _availableUpdate?.mandatory == true
          ? SafeArea(
              child: _mandatoryUpdatePanel(context),
            )
          : SafeArea(
              child: Column(
                children: [
                  if (_loading) const LinearProgressIndicator(minHeight: 2),
                  Expanded(child: _selectedBody(context)),
                ],
              ),
            ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) {
          setState(() {
            _index = index;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.point_of_sale_outlined),
            selectedIcon: Icon(Icons.point_of_sale_rounded),
            label: 'POS & Sales',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2_rounded),
            label: 'Inventory',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_shipping_outlined),
            selectedIcon: Icon(Icons.local_shipping_rounded),
            label: 'Procurement',
          ),
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view_rounded),
            label: 'More',
          ),
        ],
      ),
    );
  }

  Widget _offlineNotice() {
    if (!widget.offline) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E6),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF3D89A)),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.cloud_off_outlined, size: 20),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'You are offline. Cached identity is available, but live business data requires a connection.',
            ),
          ),
        ],
      ),
    );
  }

  Widget _errorCard(String module) {
    final message = _errors[module];

    if (message == null) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF5F3),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFFC8BF)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline_rounded, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(message)),
          IconButton(
            tooltip: 'Retry',
            onPressed: _loading ? null : _refreshLiveData,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
    );
  }

  Widget _sectionHeader(BuildContext context, String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 4),
        Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }

  Widget _metricCard(
    BuildContext context, {
    required String label,
    required String value,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: UbuzimaBrand.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: UbuzimaBrand.greenDark),
          const Spacer(),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 3),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }

  Widget _home(BuildContext context) {
    final inventory = _map('inventory', 'summary');
    final tenant = _tenantName();
    final branch = _branchName();

    final stockValue = _payloads.containsKey('inventory')
        ? _money(
            inventory['estimated_stock_retail_value'] ??
                inventory['estimated_stock_value'],
          )
        : '—';

    final lowStock = _payloads.containsKey('inventory')
        ? (inventory['low_stock_products_count'] ?? 0).toString()
        : '—';

    return RefreshIndicator(
      onRefresh: _refreshLiveData,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 28),
        children: [
          Text(
            '360 BUSINESS VIEW',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: UbuzimaBrand.greenDark,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.05,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Welcome, ${_userName()}',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          if (tenant != null) ...[
            const SizedBox(height: 5),
            Text(tenant, style: Theme.of(context).textTheme.titleSmall),
          ],
          if (branch != null) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(
                  Icons.location_on_outlined,
                  size: 17,
                  color: UbuzimaBrand.textSecondary,
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    branch,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ],
          if (widget.offline) ...[const SizedBox(height: 16), _offlineNotice()],
          const SizedBox(height: 22),
          LayoutBuilder(
            builder: (context, constraints) {
              final columns = constraints.maxWidth >= 720 ? 4 : 2;

              return GridView.count(
                crossAxisCount: columns,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1.35,
                children: [
                  _metricCard(
                    context,
                    label: 'Sales',
                    value: _count('sales', 'sales'),
                    icon: Icons.receipt_long_outlined,
                  ),
                  _metricCard(
                    context,
                    label: 'Products',
                    value: _count('products', 'products'),
                    icon: Icons.medication_outlined,
                  ),
                  _metricCard(
                    context,
                    label: 'Stock value',
                    value: stockValue,
                    icon: Icons.inventory_2_outlined,
                  ),
                  _metricCard(
                    context,
                    label: 'Low stock',
                    value: lowStock,
                    icon: Icons.warning_amber_rounded,
                  ),
                  _metricCard(
                    context,
                    label: 'Suppliers',
                    value: _count('suppliers', 'suppliers'),
                    icon: Icons.local_shipping_outlined,
                  ),
                  _metricCard(
                    context,
                    label: 'Purchase orders',
                    value: _count('purchase_orders', 'purchase_orders'),
                    icon: Icons.assignment_outlined,
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 18),
          _errorCard('sales'),
          _errorCard('products'),
          _errorCard('inventory'),
          _errorCard('suppliers'),
          _errorCard('purchase_orders'),
          if (!_loading &&
              !widget.offline &&
              _payloads.isEmpty &&
              _errors.isEmpty)
            _emptyCard(context, 'No live data has been returned yet.'),
        ],
      ),
    );
  }

  Widget _sales(BuildContext context) {
    final sales = _rows('sales', 'sales');

    return RefreshIndicator(
      onRefresh: _refreshLiveData,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
        children: [
          _sectionHeader(
            context,
            'POS & Sales',
            'Live sales from your authenticated Ubuzima+ workspace.',
          ),
          const SizedBox(height: 16),
          _errorCard('sales'),
          if (!_payloads.containsKey('sales') &&
              !_errors.containsKey('sales') &&
              _loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(30),
                child: CircularProgressIndicator(),
              ),
            )
          else if (sales.isEmpty && !_errors.containsKey('sales'))
            _emptyCard(context, 'No sales were returned for this tenant.')
          else
            ...sales.take(40).map((sale) {
              final customer = _nestedText(
                  sale,
                  'customer',
                  <String>[
                    'name',
                    'full_name',
                  ],
                  fallback: 'Walk-in customer');

              return _businessCard(
                context,
                title: _text(
                    sale,
                    <String>[
                      'sale_number',
                      'invoice_number',
                      'reference',
                    ],
                    fallback: 'Sale #${sale['id'] ?? '—'}'),
                subtitle: customer,
                leading: Icons.receipt_long_outlined,
                trailing: _money(
                  sale['total_amount'] ??
                      sale['grand_total'] ??
                      sale['net_amount'],
                ),
                badges: <String>[
                  _text(sale, <String>['status'], fallback: 'unknown'),
                  _text(
                      sale,
                      <String>[
                        'payment_status',
                      ],
                      fallback: 'payment n/a'),
                ],
              );
            }),
        ],
      ),
    );
  }

  Widget _inventory(BuildContext context) {
    final products = _rows('products', 'products');
    final summary = _map('inventory', 'summary');

    final productsCount = _payloads.containsKey('inventory')
        ? (summary['products_count'] ?? products.length).toString()
        : '—';

    final quantity = _payloads.containsKey('inventory')
        ? (summary['total_quantity_on_hand'] ?? '—').toString()
        : '—';

    final locations = _payloads.containsKey('inventory')
        ? (summary['stock_locations_count'] ?? '—').toString()
        : '—';

    final batches = _payloads.containsKey('inventory')
        ? (summary['stock_batches_count'] ?? '—').toString()
        : '—';

    return RefreshIndicator(
      onRefresh: _refreshLiveData,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
        children: [
          _sectionHeader(
            context,
            'Inventory',
            'Current product and stock information from the live tenant.',
          ),
          const SizedBox(height: 16),
          _errorCard('inventory'),
          _errorCard('products'),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.45,
            children: [
              _metricCard(
                context,
                label: 'Products',
                value: productsCount,
                icon: Icons.medication_outlined,
              ),
              _metricCard(
                context,
                label: 'Quantity on hand',
                value: quantity,
                icon: Icons.inventory_outlined,
              ),
              _metricCard(
                context,
                label: 'Locations',
                value: locations,
                icon: Icons.warehouse_outlined,
              ),
              _metricCard(
                context,
                label: 'Batches',
                value: batches,
                icon: Icons.layers_outlined,
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text('Products', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          if (products.isEmpty && !_errors.containsKey('products'))
            _emptyCard(context, 'No active products were returned.')
          else
            ...products.take(60).map((product) {
              return _businessCard(
                context,
                title: _text(product, <String>['name', 'product_name']),
                subtitle: _text(
                    product,
                    <String>[
                      'sku',
                      'barcode',
                    ],
                    fallback: 'No SKU'),
                leading: Icons.medication_liquid_outlined,
                trailing: '${_text(product, <String>[
                      'total_quantity_on_hand'
                    ], fallback: '0')} on hand',
                badges: <String>[
                  _text(product, <String>['status'], fallback: 'active'),
                  _text(product, <String>['product_type'], fallback: 'product'),
                ],
              );
            }),
        ],
      ),
    );
  }

  Widget _procurement(BuildContext context) {
    final suppliers = _rows('suppliers', 'suppliers');
    final purchaseOrders = _rows('purchase_orders', 'purchase_orders');

    return RefreshIndicator(
      onRefresh: _refreshLiveData,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
        children: [
          _sectionHeader(
            context,
            'Procurement',
            'Live suppliers and purchase orders with server-enforced approvals.',
          ),
          const SizedBox(height: 16),
          _errorCard('suppliers'),
          _errorCard('purchase_orders'),
          Row(
            children: [
              Expanded(
                child: _metricCard(
                  context,
                  label: 'Suppliers',
                  value: _count('suppliers', 'suppliers'),
                  icon: Icons.local_shipping_outlined,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _metricCard(
                  context,
                  label: 'Purchase orders',
                  value: _count('purchase_orders', 'purchase_orders'),
                  icon: Icons.assignment_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            'Purchase orders',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 10),
          if (purchaseOrders.isEmpty && !_errors.containsKey('purchase_orders'))
            _emptyCard(context, 'No purchase orders were returned.')
          else
            ...purchaseOrders.take(40).map((purchaseOrder) {
              final id = purchaseOrder['id'];
              final status = _text(
                  purchaseOrder,
                  <String>[
                    'status',
                  ],
                  fallback: 'unknown');

              final supplier = _nestedText(
                  purchaseOrder,
                  'supplier',
                  <String>[
                    'name',
                    'legal_name',
                  ],
                  fallback: 'Supplier not available');

              final canApprove = status == 'draft';
              final canCancel = status != 'received' && status != 'cancelled';

              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(15),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: UbuzimaBrand.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.assignment_outlined,
                          color: UbuzimaBrand.greenDark,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _text(
                                    purchaseOrder,
                                    <String>[
                                      'po_number',
                                      'number',
                                    ],
                                    fallback: 'Purchase order #${id ?? '—'}'),
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 3),
                              Text(
                                supplier,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                        Text(
                          _money(purchaseOrder['total_amount']),
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    _badge(status),
                    if (canApprove || canCancel) ...[
                      const Divider(height: 24),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          if (canApprove)
                            FilledButton.icon(
                              onPressed: _actionBusy == 'approve-$id'
                                  ? null
                                  : () => _approvePurchaseOrder(purchaseOrder),
                              icon: const Icon(Icons.check_circle_outline),
                              label: const Text('Approve'),
                            ),
                          if (canCancel)
                            OutlinedButton.icon(
                              onPressed: _actionBusy == 'cancel-$id'
                                  ? null
                                  : () => _cancelPurchaseOrder(purchaseOrder),
                              icon: const Icon(Icons.cancel_outlined),
                              label: const Text('Cancel'),
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
              );
            }),
          const SizedBox(height: 18),
          Text('Suppliers', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          if (suppliers.isEmpty && !_errors.containsKey('suppliers'))
            _emptyCard(context, 'No suppliers were returned.')
          else
            ...suppliers.take(40).map((supplier) {
              return _businessCard(
                context,
                title: _text(supplier, <String>['name', 'legal_name']),
                subtitle: _text(
                    supplier,
                    <String>[
                      'phone',
                      'email',
                      'supplier_code',
                    ],
                    fallback: 'No contact details'),
                leading: Icons.local_shipping_outlined,
                trailing: _text(
                    supplier,
                    <String>[
                      'supplier_code',
                    ],
                    fallback: ''),
                badges: <String>[
                  _text(supplier, <String>['status'], fallback: 'unknown'),
                  _text(
                      supplier,
                      <String>[
                        'supplier_type',
                      ],
                      fallback: 'supplier'),
                ],
              );
            }),
        ],
      ),
    );
  }

  Widget _more(BuildContext context) {
    final tenant = _tenantName();
    final branch = _branchName();

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
      children: [
        _sectionHeader(
          context,
          'Workspace',
          'Your authenticated Ubuzima+ mobile context.',
        ),
        const SizedBox(height: 18),
        _businessCard(
          context,
          title: _userName(),
          subtitle: tenant ?? 'Tenant not available',
          leading: Icons.person_outline_rounded,
          trailing: branch ?? '',
          badges: <String>[widget.offline ? 'offline session' : 'live session'],
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _loading ? null : _refreshLiveData,
          icon: const Icon(Icons.sync_rounded),
          label: const Text('Refresh live workspace'),
        ),
        const SizedBox(height: 10),
        if (_availableUpdate != null)
          _businessCard(
            context,
            title: _availableUpdate!.mandatory
                ? 'Update required'
                : 'Update available',
            subtitle: 'Ubuzima+ Preview '
                '${_availableUpdate!.versionName}',
            leading: Icons.system_update_alt_rounded,
            trailing: '',
            badges: <String>[
              _availableUpdate!.mandatory ? 'required' : 'optional',
            ],
          ),
        if (_updateNotice != null) ...[
          const SizedBox(height: 2),
          _emptyCard(
            context,
            _updateNotice!,
          ),
          const SizedBox(height: 10),
        ],
        OutlinedButton.icon(
          onPressed: _updateChecking || _updateBusy
              ? null
              : () => _checkForUpdate(
                    silent: false,
                  ),
          icon: const Icon(
            Icons.system_update_alt_rounded,
          ),
          label: Text(
            _updateChecking ? 'Checking for updates...' : 'Check for updates',
          ),
        ),
        if (_availableUpdate != null) ...[
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: _updateBusy
                ? null
                : () => _installPreviewUpdate(
                      _availableUpdate!,
                    ),
            icon: const Icon(
              Icons.download_rounded,
            ),
            label: Text(
              _updateBusy
                  ? 'Preparing update...'
                  : 'Update to '
                      '${_availableUpdate!.versionName}',
            ),
          ),
        ],
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: widget.controller.logout,
          icon: const Icon(Icons.logout_rounded),
          label: const Text('Log out securely'),
        ),
      ],
    );
  }

  Widget _emptyCard(BuildContext context, String message) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: UbuzimaBrand.border),
      ),
      child: Row(
        children: [
          const Icon(Icons.inbox_outlined, color: UbuzimaBrand.textSecondary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }

  Widget _businessCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData leading,
    required String trailing,
    required List<String> badges,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: UbuzimaBrand.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: UbuzimaBrand.surfaceSoft,
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(leading, color: UbuzimaBrand.greenDark, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                if (badges.isNotEmpty) ...[
                  const SizedBox(height: 9),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: badges
                        .where((badge) => badge.trim().isNotEmpty)
                        .map(_badge)
                        .toList(),
                  ),
                ],
              ],
            ),
          ),
          if (trailing.trim().isNotEmpty) ...[
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                trailing,
                textAlign: TextAlign.right,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelLarge,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _badge(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: UbuzimaBrand.surfaceSoft,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: UbuzimaBrand.greenDark,
        ),
      ),
    );
  }
}
