import 'package:flutter/material.dart';

import '../../update/data/preview_update_service.dart';

import '../../../core/network/native_api_client.dart';
import '../../../shared/presentation/ubuzima_brand_logo.dart';
import '../../auth/presentation/native_auth_controller.dart';
import '../../business/data/business_api_repository.dart';
import 'rc6_pwa_native_components.dart';

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
      _loadModule(
          'inventory_analytics', _business.loadInventoryAnalyticsSummary),
      _loadModule('inventory_locations', _business.loadInventoryLocations),
      _loadModule('inventory_batches', _business.loadInventoryBatches),
      _loadModule('suppliers', _business.loadSuppliers),
      _loadModule('purchase_orders', _business.loadPurchaseOrders),
      _loadModule('supplier_invoices', _business.loadSupplierInvoices),
      _loadModule('reports_overview', _business.loadReportsOverview),
      _loadModule('reports_sales', _business.loadReportsSalesSummary),
      _loadModule(
          'reports_procurement', _business.loadReportsProcurementSummary),
    ]);

    if (!mounted) {
      return;
    }

    setState(() {
      _loading = false;
    });
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

  Widget _home(BuildContext context) {
    return Rc6HomeView(
      profile: widget.profile,
      offline: widget.offline,
      payloads: _payloads,
      errors: _errors,
      tenantName: _tenantName() ?? 'Tenant',
      branchName: _branchName(),
      onRefresh: _refreshLiveData,
      onOpenSales: () {
        setState(() {
          _index = 1;
        });
      },
      onOpenInventory: () {
        setState(() {
          _index = 2;
        });
      },
      onOpenProcurement: () {
        setState(() {
          _index = 3;
        });
      },
    );
  }

  Widget _sales(BuildContext context) {
    return Rc6SalesView(
      profile: widget.profile,
      offline: widget.offline,
      business: _business,
      payloads: _payloads,
      errors: _errors,
      tenantName: _tenantName() ?? 'Tenant',
      branchName: _branchName(),
      onRefresh: _refreshLiveData,
    );
  }

  Widget _inventory(BuildContext context) {
    return Rc6InventoryView(
      profile: widget.profile,
      offline: widget.offline,
      business: _business,
      payloads: _payloads,
      errors: _errors,
      tenantName: _tenantName() ?? 'Tenant',
      branchName: _branchName(),
      onRefresh: _refreshLiveData,
    );
  }

  Widget _procurement(BuildContext context) {
    return Rc6ProcurementView(
      profile: widget.profile,
      offline: widget.offline,
      business: _business,
      payloads: _payloads,
      errors: _errors,
      tenantName: _tenantName() ?? 'Tenant',
      branchName: _branchName(),
      onRefresh: _refreshLiveData,
      onApprove: _approvePurchaseOrder,
      onCancel: _cancelPurchaseOrder,
    );
  }

  Widget _more(BuildContext context) {
    return Rc6MoreView(
      profile: widget.profile,
      offline: widget.offline,
      payloads: _payloads,
      errors: _errors,
      tenantName: _tenantName() ?? 'Tenant',
      branchName: _branchName(),
      onRefresh: _refreshLiveData,
      updateVersionName: _availableUpdate?.versionName,
      updateMandatory: _availableUpdate?.mandatory ?? false,
      updateNotice: _updateNotice,
      updateChecking: _updateChecking,
      updateBusy: _updateBusy,
      onCheckUpdate: () async {
        await _checkForUpdate(
          silent: false,
        );
      },
      onInstallUpdate: _availableUpdate == null
          ? null
          : () async {
              await _installPreviewUpdate(
                _availableUpdate!,
              );
            },
      onLogout: () {
        widget.controller.logout();
      },
    );
  }
}
