import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  static const String _apiKey = 'AIzaSyAmXGFQjrg5Y0fZFsmVveZmOsuFT2x0-fc';

  static const String _authUrl =
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp';

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

  bool get isSignedIn => _idToken != null;

  Future<void> restoreSession() async {
    _idToken = await _preferences.getString(_idTokenKey);

    _refreshToken = await _preferences.getString(_refreshTokenKey);

    _localId = await _preferences.getString(_localIdKey);

    _displayName = await _preferences.getString(_displayNameKey);
  }

  Future<void> signInWithGoogleIdToken(String googleIdToken) async {
    final response = await http.post(
      Uri.parse('$_authUrl?key=$_apiKey'),
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

    if (_idToken == null || _localId == null) {
      throw StateError('Firebase authentication response is incomplete.');
    }

    await _preferences.setString(_idTokenKey, _idToken!);

    if (_refreshToken != null) {
      await _preferences.setString(_refreshTokenKey, _refreshToken!);
    }

    await _preferences.setString(_localIdKey, _localId!);

    if (_displayName != null) {
      await _preferences.setString(_displayNameKey, _displayName!);
    }
  }

  Future<void> signOut() async {
    _idToken = null;
    _refreshToken = null;
    _localId = null;
    _displayName = null;

    await _preferences.remove(_idTokenKey);
    await _preferences.remove(_refreshTokenKey);
    await _preferences.remove(_localIdKey);
    await _preferences.remove(_displayNameKey);
  }
}
