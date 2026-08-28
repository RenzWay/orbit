import 'package:firebase_database/firebase_database.dart';

class PresenceService {
  final FirebaseDatabase _database;

  PresenceService({FirebaseDatabase? database})
    : _database = database ?? FirebaseDatabase.instance;

  DatabaseReference _deviceReference(String userId, String deviceId) {
    return _database.ref('presence/$userId/$deviceId');
  }

  DatabaseReference _connectionReference() {
    return _database.ref('.info/connected');
  }

  Stream<bool> connectionState() {
    return _connectionReference().onValue.map((event) {
      return event.snapshot.value == true;
    });
  }

  Future<void> setOnline({
    required String userId,
    required String deviceId,
    required String deviceName,
  }) async {
    final connection = _connectionReference();

    final connectedEvent = await connection.once();

    if (connectedEvent.snapshot.value != true) {
      throw StateError('Firebase is not connected.');
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

  Stream<DatabaseEvent> watchDevices(String userId) {
    return _database.ref('presence/$userId').onValue;
  }

  Future<void> removeDevice({
    required String userId,
    required String deviceId,
  }) async {
    await _deviceReference(userId, deviceId).remove();
  }
}
