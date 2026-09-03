import 'package:flutter/material.dart';

import '../../screen/auth/auth_service.dart';

class HomeHeader extends StatefulWidget {
  const HomeHeader({super.key});

  @override
  State<StatefulWidget> createState() => _HomeHeaderState();
}

class _HomeHeaderState extends State<HomeHeader> {
  String _displayName = '';
  String? _photoUrl;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final authService = AuthService();
    await authService.restoreSession();

    print("USER NAME: ${authService.currentUserName}");
    print("PHOTO URL: ${authService.currentUserPhotoUrl}");

    if (mounted) {
      setState(() {
        _displayName = authService.currentUserName ?? "User";
        _photoUrl = authService.currentUserPhotoUrl;
      });
    }
  }

  void _handleLogout(BuildContext context) async {
    final authService = AuthService();
    await authService.signOut();

    if (context.mounted) {
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final String initial = _displayName.isNotEmpty
        ? _displayName[0].toUpperCase()
        : '?';

    return SizedBox(
      height: 44,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            Text(
              'Orbit',
              style: Theme.of(context).textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const Spacer(),
            TextButton(onPressed: () {}, child: const Text('Settings')),
            const SizedBox(width: 4),
            PopupMenuButton<int>(
              offset: const Offset(0, 40),
              onSelected: (value) {
                if (value == 0) {
                  _handleLogout(context);
                }
              },
              itemBuilder: (context) => [
                const PopupMenuItem(
                  value: 0,
                  child: Row(
                    children: [
                      Icon(Icons.logout, size: 20, color: Colors.red),
                      SizedBox(width: 8),
                      Text('Logout'),
                    ],
                  ),
                ),
              ],
              child: CircleAvatar(
                radius: 14,
                backgroundColor: Theme.of(context).primaryColor,
                backgroundImage: _photoUrl != null && _photoUrl!.isNotEmpty
                    ? NetworkImage(_photoUrl!)
                    : null,
                child: (_photoUrl == null || _photoUrl!.isEmpty)
                    ? Text(
                        initial,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      )
                    : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
