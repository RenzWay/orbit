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
  StreamSubscription<bool>? _loginSubcription;

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
  }

  @override
  void dispose() {
    _loginSubcription?.cancel();
    _authController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: _navigatorKey, // <-- tambahin ini
      title: 'Orbit',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.dark,
      initialRoute: '/login',
      routes: {
        '/login': (context) => const LoginScreen(),
        '/home': (context) => const HomeScreen(),
      },
    );
  }
}
