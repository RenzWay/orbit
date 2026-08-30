import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:orbit/core/theme/app_theme.dart';
import 'package:orbit/firebase_options.dart';
import 'package:orbit/service/device/orbit_device_service.dart';

Future<void> main() async {


  runApp(const OrbitApp());
}

class OrbitApp extends StatelessWidget {
  const OrbitApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Orbit',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark(),
      themeMode: ThemeMode.dark,
      home: const Scaffold(body: Center(child: Text('Orbit'))),
    );
  }
}
