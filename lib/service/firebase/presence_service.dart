import 'dart:io';

import 'package:firebase_database/firebase_database.dart';

import '../firebase/rest_realtime_database_service.dart';

class PresenceService {
  final FirebaseDatabase? _database;
  final RestRealtimeDatabaseService? _restDatabase;

  PresenceService({
    FirebaseDatabase? database,
    RestRealtimeDatabaseService? restDatabase,
  }) : _database = Platform.isLinux
           ? null
           : (database ?? FirebaseDatabase.instance),
       _restDatabase = Platform.isLinux
           ? (restDatabase ?? RestRealtimeDatabaseService())
           : null;

  DatabaseReference _deviceReference(String userId, String deviceId) {
    return _database!.ref('presence/$userId/$deviceId');
  }

  String _devicePath(String userId, String deviceId) {
    return 'presence/$userId/$deviceId';
  }

  Future<void> setOnline({
    required String userId,
    required String deviceId,
    required String deviceName,
  }) async {
    final data = {
      'deviceName': deviceName,
      'status': 'online',
      'lastSeen': DateTime.now().millisecondsSinceEpoch,
    };

    if (Platform.isLinux) {
      await _restDatabase!.put(_devicePath(userId, deviceId), data);

      return;
    }

    final deviceReference = _deviceReference(userId, deviceId);

    await deviceReference.onDisconnect().set({
      'deviceName': deviceName,
      'status': 'offline',
      'lastSeen': ServerValue.timestamp,
    });

    await deviceReference.set({
      'deviceName': deviceName,
      'status': 'online',
      'lastSeen': ServerValue.timestamp,
    });
  }

  Stream<Map<String, dynamic>> watchDevices(String userId) {
    if (Platform.isLinux) {
      return _watchDevicesLinux(userId);
    }

    return _database!.ref('presence/$userId').onValue.map((event) {
      final value = event.snapshot.value;

      if (value == null || value is! Map) {
        return <String, dynamic>{};
      }

      return Map<String, dynamic>.from(
        value.map((key, value) => MapEntry(key.toString(), value)),
      );
    });
  }

  Stream<Map<String, dynamic>> _watchDevicesLinux(String userId) async* {
    await for (final event in _restDatabase!.stream('presence/$userId')) {
      final data = event.data;

      if (data == null || data is! Map) {
        yield <String, dynamic>{};
        continue;
      }

      yield Map<String, dynamic>.from(
        data.map((key, value) => MapEntry(key.toString(), value)),
      );
    }
  }

  Future<void> removeDevice({
    required String userId,
    required String deviceId,
  }) async {
    if (Platform.isLinux) {
      await _restDatabase!.delete(_devicePath(userId, deviceId));

      return;
    }

    await _deviceReference(userId, deviceId).remove();
  }

  void dispose() {
    _restDatabase?.dispose();
  }
}
