import 'package:flutter/material.dart';

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
      return branch['name']?.toString();
    }

    final assignments = widget.profile['tenant_assignments'];

    if (assignments is List && assignments.isNotEmpty) {
      final first = assignments.first;

      if (first is Map && first['branch'] is Map) {
        return (first['branch'] as Map)['name']?.toString();
      }
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Ubuzima+',
        ),
        actions: [
          IconButton(
            tooltip: 'Log out',
            onPressed: widget.controller.logout,
            icon: const Icon(
              Icons.logout,
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: _index == 0
            ? _home(context)
            : _modulePlaceholder(
                context,
                _labels[_index],
              ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) {
          setState(
            () {
              _index = index;
            },
          );
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(
              Icons.home_outlined,
            ),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(
              Icons.point_of_sale_outlined,
            ),
            label: 'POS & Sales',
          ),
          NavigationDestination(
            icon: Icon(
              Icons.inventory_2_outlined,
            ),
            label: 'Inventory',
          ),
          NavigationDestination(
            icon: Icon(
              Icons.local_shipping_outlined,
            ),
            label: 'Procurement',
          ),
          NavigationDestination(
            icon: Icon(
              Icons.grid_view_outlined,
            ),
            label: 'More',
          ),
        ],
      ),
    );
  }

  Widget _home(
    BuildContext context,
  ) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        18,
        16,
        18,
        24,
      ),
      children: [
        Text(
          '360 BUSINESS VIEW',
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w900,
                letterSpacing: 1.1,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          'Welcome, ${_userName()}',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        if (_branchName() != null)
          Padding(
            padding: const EdgeInsets.only(
              top: 4,
            ),
            child: Text(
              _branchName()!,
            ),
          ),
        if (widget.offline)
          Container(
            margin: const EdgeInsets.only(
              top: 16,
            ),
            padding: const EdgeInsets.all(
              12,
            ),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.secondaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'Offline mode: showing your secured local session. Live business data will resume when connectivity returns.',
            ),
          ),
        const SizedBox(height: 22),
        _NativeStatusCard(
          icon: Icons.verified_user,
          title: 'Secure native session',
          description:
              'Authentication is running directly through the Ubuzima+ API with device-secured token storage.',
        ),
        const SizedBox(height: 12),
        _NativeStatusCard(
          icon: Icons.phone_android,
          title: 'Native mobile foundation',
          description:
              'This interface is rendered locally by the Ubuzima+ mobile application.',
        ),
        const SizedBox(height: 22),
        Text(
          'Native modules',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: 8),
        const Text(
          'POS & Sales, Inventory and Procurement will be connected to their production APIs in the next migration stages. No fake business figures are shown while those API contracts are being mapped.',
        ),
      ],
    );
  }

  Widget _modulePlaceholder(
    BuildContext context,
    String module,
  ) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.construction_outlined,
              size: 48,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: 16),
            Text(
              module,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Native migration is in progress. This R1 screen intentionally does not open the web application.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
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
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              icon,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(
                    height: 4,
                  ),
                  Text(description),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
