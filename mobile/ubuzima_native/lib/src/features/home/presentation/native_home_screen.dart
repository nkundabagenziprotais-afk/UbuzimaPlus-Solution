import 'package:flutter/material.dart';

import '../../../core/theme/ubuzima_brand.dart';
import '../../../shared/presentation/ubuzima_brand_logo.dart';
import '../../auth/presentation/native_auth_controller.dart';

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

class _NativeHomeScreenState extends State<NativeHomeScreen> {
  int _index = 0;

  static const _labels = [
    'Home',
    'POS & Sales',
    'Inventory',
    'Procurement',
    'More',
  ];

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
            tooltip: 'Log out',
            onPressed: widget.controller.logout,
            icon: const Icon(Icons.logout_rounded),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: SafeArea(
        child: _index == 0
            ? _home(context)
            : _modulePlaceholder(context, _labels[_index]),
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
    final branch = _branchName();

    return ListView(
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
        if (branch != null) ...[
          const SizedBox(height: 5),
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
        if (widget.offline) ...[
          const SizedBox(height: 16),
          Container(
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
                    'You are currently offline. Your secure session remains available while live information reconnects.',
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 22),
        _NativeStatusCard(
          icon: Icons.health_and_safety_outlined,
          title: 'Secure access',
          description:
              'Your Ubuzima+ session is protected on this device and connected securely to your workspace.',
        ),
        const SizedBox(height: 12),
        _NativeStatusCard(
          icon: Icons.phone_android_rounded,
          title: 'Built for mobile',
          description:
              'A focused experience designed for quick everyday business actions.',
        ),
        const SizedBox(height: 24),
        Text('Your workspace', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 7),
        Text(
          'Live business information will appear here as each mobile workflow becomes ready.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }

  Widget _modulePlaceholder(BuildContext context, String module) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 30, 20, 30),
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 26),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: UbuzimaBrand.border),
          ),
          child: Column(
            children: [
              Container(
                width: 62,
                height: 62,
                decoration: const BoxDecoration(
                  color: UbuzimaBrand.surfaceSoft,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.mobile_friendly_rounded,
                  size: 31,
                  color: UbuzimaBrand.greenDark,
                ),
              ),
              const SizedBox(height: 18),
              Text(
                module,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 9),
              Text(
                'This workspace is being prepared for the Ubuzima+ mobile experience. Your secure Home remains available while this section is activated.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 22),
              OutlinedButton.icon(
                onPressed: () {
                  setState(() {
                    _index = 0;
                  });
                },
                icon: const Icon(Icons.home_outlined),
                label: const Text('Back to Home'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _NativeStatusCard extends StatelessWidget {
  const _NativeStatusCard({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
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
            child: Icon(icon, color: UbuzimaBrand.greenDark, size: 22),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontSize: 14),
                ),
                const SizedBox(height: 4),
                Text(description, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
