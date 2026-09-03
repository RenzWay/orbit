import 'package:orbit/screen/auth/auth_service.dart';
import 'package:orbit/service/firebase/rest_realtime_database_service.dart';

class PresenceService {
  final RestRealtimeDatabaseService _database;

  PresenceService({RestRealtimeDatabaseService? database})
    : _database =
          database ?? RestRealtimeDatabaseService(authService: AuthService());

  String _devicePath(String userId, String deviceId) {
    return 'presence/$userId/$deviceId';
  }

  String _devicesPath(String userId) {
    return 'presence/$userId';
  }

  Future<void> setOnline({
    required String userId,
    required String deviceId,
    required String deviceName,
  }) async {
    await _database.put(_devicePath(userId, deviceId), {
      'deviceName': deviceName,
      'status': 'online',
      'lastSeen': DateTime.now().millisecondsSinceEpoch,
    });
  }

  Stream<Map<String, dynamic>> watchDevices(String userId) async* {
    final devices = <String, dynamic>{};

    await for (final event in _database.stream(_devicesPath(userId))) {
      final segments = event.path
          .split('/')
          .where((segment) => segment.isNotEmpty)
          .toList();

      if (segments.isEmpty) {
        devices.clear();
        final data = event.data;
        if (data is Map) {
          devices.addAll(
            data.map((key, value) => MapEntry(key.toString(), value)),
          );
        }
      } else {
        final deviceId = segments.first;
        if (segments.length == 1) {
          if (event.data == null) {
            devices.remove(deviceId);
          } else {
            devices[deviceId] = event.data;
          }
        } else {
          final existing = devices[deviceId];
          final merged = existing is Map
              ? Map<String, dynamic>.from(existing)
              : <String, dynamic>{};
          merged[segments[1]] = event.data;
          devices[deviceId] = merged;
        }
      }

      yield Map<String, dynamic>.from(devices);
    }
  }

  Future<void> removeDevice({
    required String userId,
    required String deviceId,
  }) async {
    await _database.delete(_devicePath(userId, deviceId));
  }

  void dispose() {
    _database.dispose();
  }
}
