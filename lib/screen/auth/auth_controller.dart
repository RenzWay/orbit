import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:orbit/screen/auth/auth_deep_link_service.dart';
import 'package:orbit/screen/auth/auth_service.dart';

class AuthController {
  final AuthService _authService;
  final AuthDeepLinkService _deepLinkService;

  AuthController({
    AuthService? authService,
    AuthDeepLinkService? deepLinkService,
  }) : _authService = authService ?? AuthService(),
       _deepLinkService = deepLinkService ?? AuthDeepLinkService();

  AuthService get authService => _authService;

  Future<void> initialize({required void Function() onLoginSuccess}) async {
    await _authService.restoreSession();

    if (_authService.isSignedIn) {
      final nativeOk = await _ensureNativeFirebaseAuth();
      if (nativeOk) {
        onLoginSuccess();
      }
      return;
    }

    _deepLinkService.listen((idToken) async {
      await _authService.signInWithGoogleIdToken(idToken);
      await _signInNativeFirebaseAuth(idToken);

      onLoginSuccess();
    });

    final initialUri = await _deepLinkService.getInitialLink();

    if (initialUri == null) {
      return;
    }

    final idToken = initialUri.queryParameters['idToken'];

    if (initialUri.scheme != 'orbit' ||
        initialUri.host != 'auth-callback' ||
        idToken == null ||
        idToken.isEmpty) {
      return;
    }

    await _authService.signInWithGoogleIdToken(idToken);
    await _signInNativeFirebaseAuth(idToken);

    onLoginSuccess();
  }

  Future<void> _signInNativeFirebaseAuth(String googleIdToken) async {
    if (Platform.isLinux) return;

    try {
      final credential = fb_auth.GoogleAuthProvider.credential(
        idToken: googleIdToken,
      );
      await fb_auth.FirebaseAuth.instance.signInWithCredential(credential);
    } catch (e) {
      print('Gagal sign-in native FirebaseAuth: $e');
    }
  }

  Future<bool> _ensureNativeFirebaseAuth() async {
    if (Platform.isLinux) return true;

    if (fb_auth.FirebaseAuth.instance.currentUser != null) return true;

    print('Native FirebaseAuth belum ke-set, paksa logout dulu.');
    await signOut();
    return false;
  }

  Future<void> signOut() async {
    await _authService.signOut();

    if (!Platform.isLinux) {
      try {
        await fb_auth.FirebaseAuth.instance.signOut();
      } catch (_) {}
    }
  }

  Future<void> dispose() async {
    await _deepLinkService.dispose();
  }
}
