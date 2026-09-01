import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:orbit/app/app.dart';
import 'package:orbit/firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  runApp(const OrbitApp());
}
