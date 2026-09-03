import 'dart:async';

import 'package:flutter/material.dart';
import 'package:orbit/core/theme/app_theme.dart';
import 'package:orbit/screen/auth/auth_controller.dart';
import 'package:orbit/screen/auth/login_screen.dart';
import 'package:orbit/screen/home/home_screen.dart';

class OrbitApp extends StatefulWidget {
  const OrbitApp({super.key});

  @override
  State<OrbitApp> createState() => _OrbitAppState();
}

class _OrbitAppState extends State<OrbitApp> {
  final AuthController _authController = AuthController();
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  StreamSubscription<bool>? _loginSubscription;

  bool _isInitializing = true;

  @override
  void initState() {
    super.initState();
    _initializeAuth();
  }

  Future<void> _initializeAuth() async {
    await _authController.initialize(
      onLoginSuccess: () {
        _navigatorKey.currentState?.pushReplacementNamed('/home');
      },
    );

    if (mounted) {
      setState(() {
        _isInitializing = false;
      });

      if (_authController.authService.isSignedIn) {
        Future.microtask(() {
          _navigatorKey.currentState?.pushReplacementNamed('/home');
        });
      }
    }
  }

  @override
  void dispose() {
    _loginSubscription?.cancel();
    _authController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: _navigatorKey,
      // <-- tambahin ini
      title: 'Orbit',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.dark,
      home: _isInitializing
          ? const Scaffold(
              backgroundColor: Color(0xFF0E1117),
              body: Center(child: CircularProgressIndicator()),
            )
          : (_authController.authService.isSignedIn
                ? const HomeScreen()
                : const LoginScreen()),
      // initialRoute: _isInitializing
      //     ? null
      //     : (_authController.authService.isSignedIn ? '/home' : '/login'),
      routes: {
        '/login': (context) => const LoginScreen(),
        '/home': (context) => const HomeScreen(),
      },
    );
  }
}
