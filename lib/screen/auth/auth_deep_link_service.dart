import 'dart:async';

import 'package:app_links/app_links.dart';

class AuthDeepLinkService {
  static const String _scheme = 'orbit';
  static const String _host = 'auth-callback';

  final AppLinks _appLinks;

  StreamSubscription<Uri>? _subscription;

  AuthDeepLinkService({AppLinks? appLinks})
    : _appLinks = appLinks ?? AppLinks();

  Future<Uri?> getInitialLink() async {
    return _appLinks.getInitialLink();
  }

  void listen(void Function(String idToken) onTokenReceived) {
    _subscription?.cancel();

    _subscription = _appLinks.uriLinkStream.listen((uri) {
      _handleUri(uri, onTokenReceived);
    });
  }

  void _handleUri(
    Uri uri,
    void Function(String idToken) onTokenReceived,
  ) {
    if (uri.scheme != _scheme) {
      return;
    }

    if (uri.host != _host) {
      return;
    }

    final idToken = uri.queryParameters['idToken'];

    if (idToken == null || idToken.isEmpty) {
      return;
    }

    onTokenReceived(idToken);
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    _subscription = null;
  }
}