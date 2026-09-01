import 'package:orbit/service/webrtc/connection_id_generator.dart';
import 'package:orbit/service/webrtc/connection_session.dart';
import 'package:orbit/service/webrtc/ice_candidate.dart';
import 'package:orbit/service/webrtc/session_description.dart';
import 'package:orbit/service/webrtc/signaling_service.dart';

class ConnectionService {
  final ConnectionIdGenerator _idGenerator;
  final SignalingService _signalingService;

  ConnectionService({
    ConnectionIdGenerator? idGenerator,
    SignalingService? signalingService,
  }) : _idGenerator = idGenerator ?? ConnectionIdGenerator(),
       _signalingService = signalingService ?? SignalingService();

  Stream<SessionDescription> watchOffer(ConnectionSession session) {
    return _signalingService
        .watchOffer(userId: session.userId, connectionId: session.connectionId)
        .where((event) => event.snapshot.exists)
        .map((event) {
          final data = event.snapshot.value;

          if (data is! Map) {
            throw StateError('Invalid offer data.');
          }

          return SessionDescription.fromMap(data);
        });
  }

  Stream<SessionDescription> watchAnswer(ConnectionSession session) {
    return _signalingService
        .watchAnswer(userId: session.userId, connectionId: session.connectionId)
        .where((event) => event.snapshot.exists)
        .map((event) {
          final data = event.snapshot.value;

          if (data is! Map) {
            throw StateError('Invalid answer data.');
          }

          return SessionDescription.fromMap(data);
        });
  }

  Stream<IceCandidate> watchCallerCandidates(ConnectionSession session) {
    return _signalingService
        .watchCallerCandidates(
          userId: session.userId,
          connectionId: session.connectionId,
        )
        .where((event) => event.snapshot.exists)
        .map((event) {
          final data = event.snapshot.value;

          if (data is! Map) {
            throw StateError('Invalid caller candidate data.');
          }

          return IceCandidate.fromMap(data);
        });
  }

  Stream<IceCandidate> watchCalleeCandidates(ConnectionSession session) {
    return _signalingService
        .watchCalleeCandidates(
          userId: session.userId,
          connectionId: session.connectionId,
        )
        .where((event) => event.snapshot.exists)
        .map((event) {
          final data = event.snapshot.value;

          if (data is! Map) {
            throw StateError('Invalid callee candidate data.');
          }

          return IceCandidate.fromMap(data);
        });
  }

  Stream<ConnectionSession> watchIncomingSessions({
  required String userId,
  required String localDeviceId,
}) {
  return _signalingService
      .watchConnections(userId)
      .map((event) {
        final value = event.snapshot.value;

        if (value == null || value is! Map) {
          return <ConnectionSession>[];
        }

        final sessions = <ConnectionSession>[];

        for (final entry in value.entries) {
          final connectionId = entry.key.toString();
          final data = entry.value;

          if (data is! Map) {
            continue;
          }

          final remoteDeviceId =
              data['remoteDeviceId']?.toString();

          final callerDeviceId =
              data['callerDeviceId']?.toString();

          if (remoteDeviceId != localDeviceId ||
              callerDeviceId == null) {
            continue;
          }

          sessions.add(
            ConnectionSession(
              connectionId: connectionId,
              localDeviceId: localDeviceId,
              remoteDeviceId: callerDeviceId,
              userId: userId,
              role: ConnectionRole.callee,
            ),
          );
        }

        return sessions;
      })
      .expand((sessions) => sessions);
}

  Future<void> sendCallerCandidate({
    required ConnectionSession session,
    required IceCandidate candidate,
  }) async {
    await _signalingService.addCallerCandidate(
      userId: session.userId,
      connectionId: session.connectionId,
      candidate: candidate.toMap(),
    );
  }

  Future<void> sendCalleeCandidate({
    required ConnectionSession session,
    required IceCandidate candidate,
  }) async {
    await _signalingService.addCalleeCandidate(
      userId: session.userId,
      connectionId: session.connectionId,
      candidate: candidate.toMap(),
    );
  }

  Future<ConnectionSession> createCallerSession({
    required String userId,
    required String localDeviceId,
    required String remoteDeviceId,
  }) async {
    final connectionId = _idGenerator.generate();

    await _signalingService.createConnection(
      userId: userId,
      connectionId: connectionId,
      callerDeviceId: localDeviceId,
      remoteDeviceId: remoteDeviceId,
    );

    return ConnectionSession(
      connectionId: connectionId,
      localDeviceId: localDeviceId,
      remoteDeviceId: remoteDeviceId,
      userId: userId,
      role: ConnectionRole.caller,
    );
  }

  Future<void> sendOffer({
    required ConnectionSession session,
    required SessionDescription offer,
  }) async {
    await _signalingService.sendOffer(
      userId: session.userId,
      connectionId: session.connectionId,
      offer: offer.toMap(),
    );
  }

  Future<void> sendAnswer({
    required ConnectionSession session,
    required SessionDescription answer,
  }) async {
    await _signalingService.sendAnswer(
      userId: session.userId,
      connectionId: session.connectionId,
      answer: answer.toMap(),
    );
  }

  Future<void> closeSession(ConnectionSession session) async {
    await _signalingService.deleteConnection(
      userId: session.userId,
      connectionId: session.connectionId,
    );
  }
}
