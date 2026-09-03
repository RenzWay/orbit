import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:orbit/screen/auth/auth_service.dart';

class RestDatabaseEvent {
  final String event;
  final String path;
  final dynamic data;

  const RestDatabaseEvent({
    required this.event,
    required this.path,
    required this.data,
  });
}

class RestRealtimeDatabaseService {
  static const String _databaseUrl =
      'https://letter-26c71-default-rtdb.asia-southeast1.firebasedatabase.app';

  final AuthService _authService;
  final http.Client _client;

  RestRealtimeDatabaseService({AuthService? authService, http.Client? client})
    : _authService = authService ?? AuthService(),
      _client = client ?? http.Client();

  Future _uri(String path) async {
    await _authService.restoreSession();

    final token = _authService.idToken;

    if (token == null || token.isEmpty) {
      throw StateError('Firebase ID token is not available.');
    }

    return Uri.parse(
      '$_databaseUrl/${path.replaceFirst(RegExp(r'^/'), '')}.json'
      '?auth=${Uri.encodeQueryComponent(token)}',
    );
  }

  Future<dynamic> get(String path) async {
    final response = await _client.get(await _uri(path));

    if (response.statusCode != 200) {
      throw StateError(
        'Firebase REST GET failed: '
        '${response.statusCode} ${response.body}',
      );
    }

    return jsonDecode(response.body);
  }

  Future<void> put(String path, dynamic data) async {
    final response = await _client.put(
      await _uri(path),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(data),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(
        'Firebase REST PUT failed: '
        '${response.statusCode} ${response.body}',
      );
    }
  }

  Future<void> patch(String path, Map<String, dynamic> data) async {
    final response = await _client.patch(
      await _uri(path),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(data),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(
        'Firebase REST PATCH failed: '
        '${response.statusCode} ${response.body}',
      );
    }
  }

  Future<void> delete(String path) async {
    final response = await _client.delete(await _uri(path));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError(
        'Firebase REST DELETE failed: '
        '${response.statusCode} ${response.body}',
      );
    }
  }

  Stream<RestDatabaseEvent> stream(String path) async* {
    final response = await _client.send(
      http.Request('GET', await _uri(path))..headers['Accept'] = 'text/event-stream',
    );

    if (response.statusCode != 200) {
      final body = await response.stream.bytesToString();

      throw StateError(
        'Firebase REST stream failed: '
        '${response.statusCode} $body',
      );
    }

    String? eventName;
    final dataLines = <String>[];

    await for (final line
        in utf8.decoder.bind(response.stream).transform(const LineSplitter())) {
      if (line.isEmpty) {
        if (eventName != null && dataLines.isNotEmpty) {
          final payload =
              jsonDecode(dataLines.join('\n')) as Map<String, dynamic>;

          yield RestDatabaseEvent(
            event: eventName,
            path: payload['path']?.toString() ?? '/',
            data: payload['data'],
          );
        }

        eventName = null;
        dataLines.clear();
        continue;
      }

      if (line.startsWith(':')) {
        continue;
      }

      if (line.startsWith('event:')) {
        eventName = line.substring(6).trim();
        continue;
      }

      if (line.startsWith('data:')) {
        dataLines.add(line.substring(5).trimLeft());
      }
    }
  }

  void dispose() {
    _client.close();
  }
}
