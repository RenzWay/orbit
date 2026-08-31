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

    _deepLinkService.listen((idToken) async {
      await _authService.signInWithGoogleIdToken(idToken);

      onLoginSuccess();
    });
  }

  Future<void> dispose() async {
    await _deepLinkService.dispose();
  }
}
