import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  static const String _apiKey = 'AIzaSyAmXGFQjrg5Y0fZFsmVveZmOsuFT2x0-fc';

  static const String _signInUrl =
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp';

  static const String _refreshUrl =
      'https://securetoken.googleapis.com/v1/token';

  static const String _idTokenKey = 'firebase_id_token';

  static const String _refreshTokenKey = 'firebase_refresh_token';

  static const String _localIdKey = 'firebase_local_id';

  static const String _displayNameKey = 'firebase_display_name';

  final SharedPreferencesAsync _preferences;

  AuthService({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  String? _idToken;
  String? _refreshToken;
  String? _localId;
  String? _displayName;

  String? get currentUserId => _localId;

  String? get currentUserName => _displayName;

  String? get idToken => _idToken;

  bool get isSignedIn =>
      _idToken != null && _refreshToken != null && _localId != null;

  Future<void> restoreSession() async {
    _idToken = await _preferences.getString(_idTokenKey);

    _refreshToken = await _preferences.getString(_refreshTokenKey);

    _localId = await _preferences.getString(_localIdKey);

    _displayName = await _preferences.getString(_displayNameKey);

    if (_refreshToken == null || _localId == null) {
      _clearSessionMemory();
      return;
    }

    try {
      await _refreshIdToken();
    } catch (_) {
      await signOut();
    }
  }

  Future<void> _refreshIdToken() async {
    final refreshToken = _refreshToken;

    if (refreshToken == null) {
      throw StateError('Refresh token is not available.');
    }

    final response = await http.post(
      Uri.parse('$_refreshUrl?key=$_apiKey'),
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: {'grant_type': 'refresh_token', 'refresh_token': refreshToken},
    );

    if (response.statusCode != 200) {
      throw StateError(
        'Failed to refresh Firebase session: '
        '${response.body}',
      );
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    final newIdToken = data['id_token'] as String?;

    final newRefreshToken = data['refresh_token'] as String?;

    final userId = data['user_id'] as String?;

    if (newIdToken == null || userId == null) {
      throw StateError('Firebase refresh response is incomplete.');
    }

    _idToken = newIdToken;
    _localId = userId;

    if (newRefreshToken != null) {
      _refreshToken = newRefreshToken;
    }

    await _preferences.setString(_idTokenKey, _idToken!);

    await _preferences.setString(_localIdKey, _localId!);

    if (_refreshToken != null) {
      await _preferences.setString(_refreshTokenKey, _refreshToken!);
    }
  }

  Future<void> signInWithGoogleIdToken(String googleIdToken) async {
    final response = await http.post(
      Uri.parse('$_signInUrl?key=$_apiKey'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'postBody':
            'id_token=${Uri.encodeComponent(googleIdToken)}'
            '&providerId=google.com',
        'requestUri': 'https://letter-26c71.firebaseapp.com/__/auth/handler',
        'returnSecureToken': true,
        'returnIdpCredential': true,
      }),
    );

    if (response.statusCode != 200) {
      throw StateError(
        'Firebase authentication failed: '
        '${response.body}',
      );
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    _idToken = data['idToken'] as String?;
    _refreshToken = data['refreshToken'] as String?;
    _localId = data['localId'] as String?;
    _displayName = data['displayName'] as String?;

    if (_idToken == null || _refreshToken == null || _localId == null) {
      throw StateError('Firebase authentication response is incomplete.');
    }

    await _preferences.setString(_idTokenKey, _idToken!);

    await _preferences.setString(_refreshTokenKey, _refreshToken!);

    await _preferences.setString(_localIdKey, _localId!);

    if (_displayName != null) {
      await _preferences.setString(_displayNameKey, _displayName!);
    }
  }

  Future<void> signOut() async {
    _clearSessionMemory();

    await _preferences.remove(_idTokenKey);

    await _preferences.remove(_refreshTokenKey);

    await _preferences.remove(_localIdKey);

    await _preferences.remove(_displayNameKey);
  }

  void _clearSessionMemory() {
    _idToken = null;
    _refreshToken = null;
    _localId = null;
    _displayName = null;
  }
}
