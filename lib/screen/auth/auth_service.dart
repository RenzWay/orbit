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

  static const String _photoUrlKey = 'firebase_photo_url';

  String? _photoUrl;

  String? get currentUserPhotoUrl => _photoUrl;

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

    _photoUrl = await _preferences.getString(_photoUrlKey);

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
    print("FULL DATA FROM FIREBASE: $data");
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

    _idToken = data['id_token'] ?? data['idToken'];
    _refreshToken = data['refresh_token'] ?? data['refreshToken'];
    _localId = data['user_id'] ?? data['localId'];
    _displayName = data['displayName'] ?? data['fullName'];
    _photoUrl = data['photoUrl'];

    if (_displayName == null && data['email'] != null) {
      _displayName = (data['email'] as String).split('@')[0];
    }

    if (_idToken != null) {
      try {
        final parts = _idToken!.split('.');
        if (parts.length == 3) {
          // Decode bagian tengah JWT (payload)
          final payload = utf8.decode(
            base64.decode(base64.normalize(parts[1])),
          );
          final decoded = jsonDecode(payload);

          _displayName = decoded['name'];
          _photoUrl = decoded['picture']; // Link foto profil asli Google
        }
      } catch (e) {
        print("Gagal bongkar JWT: $e");
      }
    }

    if (_idToken == null || _refreshToken == null || _localId == null) {
      throw StateError('Firebase authentication response is incomplete.');
    }

    await _preferences.setString(_idTokenKey, _idToken!);

    await _preferences.setString(_refreshTokenKey, _refreshToken!);

    await _preferences.setString(_localIdKey, _localId!);

    if (_displayName != null) {
      await _preferences.setString(_displayNameKey, _displayName!);
    }

    if (_photoUrl != null) {
      await _preferences.setString(_photoUrlKey, _photoUrl!);
    }
  }

  Future<void> signOut() async {
    print("SIGN OUT CALLED");
    _clearSessionMemory();

    await _preferences.remove(_idTokenKey);
    await _preferences.remove(_refreshTokenKey);
    await _preferences.remove(_localIdKey);
    await _preferences.remove(_displayNameKey);
    await _preferences.remove(_photoUrlKey);
  }

  void _clearSessionMemory() {
    _idToken = null;
    _refreshToken = null;
    _localId = null;
    _displayName = null;
    _photoUrl = null;
  }
}
