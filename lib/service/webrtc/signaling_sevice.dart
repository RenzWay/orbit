import 'package:firebase_database/firebase_database.dart';

class SignalingSevice {
  final FirebaseDatabase _database;

  SignalingSevice({FirebaseDatabase? database})
    : _database = database ?? FirebaseDatabase.instance;

  DatabaseReference _connectionReference({
    required String userId,
    required String connectionId,
  }) {
    return _database.ref('signaling/$userId/$connectionId');
  }

  Future<void> createConnection({
    required String userId,
    required String connectionId,
  }) async {
    await _connectionReference(
      userId: userId,
      connectionId: connectionId,
    ).set({'createAt': ServerValue.timestamp});
  }

  Future<void> sendOffer({
    required String userId,
    required String connectionId,
    required Map<String, dynamic> offer,
  }) async {
    await _connectionReference(
      userId: userId,
      connectionId: connectionId,
    ).child('offer').set(offer);
  }

  Future<void> sendAnswer({
    required String userId,
    required String connectionId,
    required Map<String, dynamic> answer,
  }) async {
    await _connectionReference(
      userId: userId,
      connectionId: connectionId,
    ).child('answer').set(answer);
  }

  Future<void> addCallerCandidate({
    required String userId,
    required String connectionId,
    required Map<String, dynamic> candidate,
  }) async {
    await _connectionReference(
      userId: userId,
      connectionId: connectionId,
    ).child('callerCandidates').push().set(candidate);
  }

  Future<void> addCalleeCandidate({
    required String userId,
    required String connectionId,
    required Map<String, dynamic> candidate,
  }) async {
    await _connectionReference(
      userId: userId,
      connectionId: connectionId,
    ).child('calleeCandidates').push().set(candidate);
  }

  Future<void> deleteConnection({
    required String userId,
    required String connectionId,
  }) async {
    await _connectionReference(
      userId: userId,
      connectionId: connectionId,
    ).remove();
  }

  Stream<DatabaseEvent> watchOffer({
    required String userId,
    required String connectionId,
  }) {
    return _connectionReference(
      userId: userId,
      connectionId: connectionId,
    ).child('offer').onValue;
  }

  Stream<DatabaseEvent> watchAnswer({
    required String userId,
    required String connectionId,
  }) {
    return _connectionReference(
      userId: userId,
      connectionId: connectionId,
    ).child('answer').onValue;
  }

  Stream<DatabaseEvent> watchCallerCandidates({
    required String userId,
    required String connectionId,
  }) {
    return _connectionReference(
      userId: userId,
      connectionId: connectionId,
    ).child('callerCandidates').onChildAdded;
  }

  Stream<DatabaseEvent> watchCalleeCandidates({
    required String userId,
    required String connectionId,
  }) {
    return _connectionReference(
      userId: userId,
      connectionId: connectionId,
    ).child('calleeCandidates').onChildAdded;
  }
}
