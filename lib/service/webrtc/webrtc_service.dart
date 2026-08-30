import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:orbit/service/messaging/message_router.dart';
import 'package:orbit/service/webrtc/connection_service.dart';
import 'package:orbit/service/webrtc/connection_session.dart';
import 'package:orbit/service/webrtc/ice_candidate.dart';
import 'package:orbit/service/webrtc/rtc_config.dart';
import 'package:orbit/service/webrtc/session_description.dart';
import 'package:orbit/service/webrtc/webrtc_connection_state.dart';

class WebrtcService {
  final ConnectionService _connectionService;
  final router = MessageRouter();

  final List<IceCandidate> _candidateQueue = <IceCandidate>[];

  bool _remoteDescriptionSet = false;

  RTCPeerConnection? _peerConnection;
  RTCDataChannel? _dataChannel;

  StreamSubscription<SessionDescription>? _offerSubscription;
  StreamSubscription<SessionDescription>? _answerSubscription;
  StreamSubscription<IceCandidate>? _candidateSubscription;

  final StreamController<WebrtcConnectionState> _stateController =
      StreamController<WebrtcConnectionState>.broadcast();

  final StreamController<RTCDataChannelMessage> _messageController =
      StreamController<RTCDataChannelMessage>.broadcast();

  WebrtcConnectionState _state = WebrtcConnectionState.idle;

  WebrtcService({ConnectionService? connectionService})
    : _connectionService = connectionService ?? ConnectionService();

  WebrtcConnectionState get state => _state;

  Stream<WebrtcConnectionState> get stateStream => _stateController.stream;

  Stream<RTCDataChannelMessage> get messageStream => _messageController.stream;

  bool get isConnected {
    return _state == WebrtcConnectionState.connected &&
        _dataChannel?.state == RTCDataChannelState.RTCDataChannelOpen;
  }

  void _listenForCalleeCandidates(ConnectionSession session) {
    _candidateSubscription?.cancel();

    _candidateSubscription = _connectionService
        .watchCalleeCandidates(session)
        .listen((candidate) async {
          await _addRemoteCandidate(candidate);
        });
  }

  void _listenForCallerCandidates(ConnectionSession session) {
    _candidateSubscription?.cancel();

    _candidateSubscription = _connectionService
        .watchCallerCandidates(session)
        .listen((candidate) async {
          await _addRemoteCandidate(candidate);
        });
  }

  Future<void> _addRemoteCandidate(IceCandidate candidate) async {
    if (!_remoteDescriptionSet) {
      _candidateQueue.add(candidate);
      return;
    }

    final peerConnection = _requirePeerConnection();

    await peerConnection.addCandidate(
      RTCIceCandidate(
        candidate.candidate,
        candidate.sdpMid,
        candidate.sdpMLineIndex,
      ),
    );
  }

  Future<void> _flushPendingCandidates() async {
    _remoteDescriptionSet = true;

    final pendingCandidates = List<IceCandidate>.from(_candidateQueue);
    _candidateQueue.clear();

    for (final candidate in pendingCandidates) {
      await _addRemoteCandidate(candidate);
    }
  }

  Future<void> sendText(String message) async {
    final channel = _dataChannel;

    if (channel == null) {
      throw StateError('Data channel is not available.');
    }

    if (channel.state != RTCDataChannelState.RTCDataChannelOpen) {
      throw StateError('Data channel is not open.');
    }

    await channel.send(RTCDataChannelMessage(message));
  }

  Future<void> sendBinary(Uint8List data) async {
    final channel = _dataChannel;

    if (channel == null) {
      throw StateError('Data channel is not available.');
    }

    if (channel.state != RTCDataChannelState.RTCDataChannelOpen) {
      throw StateError('Data channel is not open.');
    }

    await channel.send(RTCDataChannelMessage.fromBinary(data));
  }

  Future<void> close({ConnectionSession? session}) async {
    await _offerSubscription?.cancel();
    await _answerSubscription?.cancel();
    await _candidateSubscription?.cancel();

    _offerSubscription = null;
    _answerSubscription = null;
    _candidateSubscription = null;

    await _dataChannel?.close();
    _dataChannel = null;

    final peerConnection = _peerConnection;

    if (peerConnection != null) {
      await peerConnection.close();
      await peerConnection.dispose();
    }

    _peerConnection = null;
    _candidateQueue.clear();
    _remoteDescriptionSet = false;
    if (session != null) {
      await _connectionService.closeSession(session);
    }

    _setState(WebrtcConnectionState.closed);
  }

  Future<void> dispose() async {
    await close();

    await router.dispose();

    await _stateController.close();
    await _messageController.close();
  }

  Future<void> initialize(ConnectionSession session) async {
    if (_peerConnection != null) {
      return;
    }

    _setState(WebrtcConnectionState.connecting);

    _peerConnection = await createPeerConnection(RtcConfig.peerConnection);

    _configurePeerConnection(session);

    if (session.isCaller) {
      await _createCallerDataChannel();
    }
  }

  void _configurePeerConnection(ConnectionSession session) {
    final peerConnection = _requirePeerConnection();

    peerConnection.onIceCandidate = (candidate) {
      _handleLocalIceCandidate(session, candidate);
    };

    peerConnection.onConnectionState = (state) {
      _handleConnectionState(state);
    };

    peerConnection.onDataChannel = (channel) {
      _setDataChannel(channel);
    };
  }

  Future<void> startCaller(ConnectionSession session) async {
    if (!session.isCaller) {
      throw StateError('Caller session required.');
    }

    await initialize(session);

    _listenForCalleeCandidates(session);
    _listenForAnswer(session);

    final peerConnection = _requirePeerConnection();

    final offer = await peerConnection.createOffer();

    await peerConnection.setLocalDescription(offer);

    await _connectionService.sendOffer(
      session: session,
      offer: SessionDescription(
        type: offer.type ?? 'offer',
        sdp: offer.sdp ?? '',
      ),
    );
  }

  void _listenForAnswer(ConnectionSession session) {
    _answerSubscription?.cancel();

    _answerSubscription = _connectionService.watchAnswer(session).listen((
      answer,
    ) async {
      final peerConnection = _requirePeerConnection();

      final description = RTCSessionDescription(answer.sdp, answer.type);

      await peerConnection.setRemoteDescription(description);

      _remoteDescriptionSet = true;

      await _flushPendingCandidates();
    });
  }

  Future<void> startCallee(ConnectionSession session) async {
    if (!session.isCallee) {
      throw StateError('Callee session required.');
    }

    await initialize(session);

    _listenForCallerCandidates(session);

    _offerSubscription?.cancel();

    _offerSubscription = _connectionService.watchOffer(session).listen((
      offer,
    ) async {
      await _handleOffer(session, offer);
    });
  }

  Future<void> _handleOffer(
    ConnectionSession session,
    SessionDescription offer,
  ) async {
    final peerConnection = _requirePeerConnection();

    final remoteDescription = RTCSessionDescription(offer.sdp, offer.type);

    await peerConnection.setRemoteDescription(remoteDescription);

    _remoteDescriptionSet = true;

    await _flushPendingCandidates();

    final answer = await peerConnection.createAnswer();

    await peerConnection.setLocalDescription(answer);

    await _connectionService.sendAnswer(
      session: session,
      answer: SessionDescription(
        type: answer.type ?? 'answer',
        sdp: answer.sdp ?? '',
      ),
    );
  }

  Future<void> _createCallerDataChannel() async {
    final peerConnection = _requirePeerConnection();

    final configuration = RTCDataChannelInit()..ordered = true;

    final channel = await peerConnection.createDataChannel(
      RtcConfig.dataChannelLabel,
      configuration,
    );

    _setDataChannel(channel);
  }

  void _setDataChannel(RTCDataChannel channel) {
    _dataChannel = channel;

    channel.onDataChannelState = (state) {
      if (state == RTCDataChannelState.RTCDataChannelOpen) {
        _setState(WebrtcConnectionState.connected);
      }

      if (state == RTCDataChannelState.RTCDataChannelClosed) {
        _setState(WebrtcConnectionState.closed);
      }
    };

    channel.onMessage = (message) {
      _messageController.add(message);

      if (!message.isBinary) {
        try {
          router.route(message.text);
        } catch (_) {
          // Bukan Orbit text message yang valid.
        }
      }
    };
  }

  Future<void> _handleLocalIceCandidate(
    ConnectionSession session,
    RTCIceCandidate candidate,
  ) async {
    final candidateValue = candidate.candidate;

    if (candidateValue == null || candidateValue.isEmpty) {
      return;
    }

    final iceCandidate = IceCandidate(
      candidate: candidateValue,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
    );

    if (session.isCaller) {
      await _connectionService.sendCallerCandidate(
        session: session,
        candidate: iceCandidate,
      );
    } else {
      await _connectionService.sendCalleeCandidate(
        session: session,
        candidate: iceCandidate,
      );
    }
  }

  Future<void> waitForBuffer() async {
    final channel = _dataChannel;

    if (channel == null) {
      throw StateError('Data channel is not available.');
    }

    while (channel.bufferedAmount! > RtcConfig.bufferedAmountLowThreshold) {
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
  }

  void _handleConnectionState(RTCPeerConnectionState state) {
    switch (state) {
      case RTCPeerConnectionState.RTCPeerConnectionStateNew:
      case RTCPeerConnectionState.RTCPeerConnectionStateConnecting:
        _setState(WebrtcConnectionState.connecting);

      case RTCPeerConnectionState.RTCPeerConnectionStateConnected:
        _setState(WebrtcConnectionState.connected);

      case RTCPeerConnectionState.RTCPeerConnectionStateDisconnected:
        _setState(WebrtcConnectionState.disconnected);

      case RTCPeerConnectionState.RTCPeerConnectionStateFailed:
        _setState(WebrtcConnectionState.failed);

      case RTCPeerConnectionState.RTCPeerConnectionStateClosed:
        _setState(WebrtcConnectionState.closed);
    }
  }

  void _setState(WebrtcConnectionState newState) {
    if (_state == newState) {
      return;
    }

    _state = newState;
    _stateController.add(newState);
  }

  RTCPeerConnection _requirePeerConnection() {
    final peerConnection = _peerConnection;

    if (peerConnection == null) {
      throw StateError('WebRTC has not been initialized.');
    }

    return peerConnection;
  }
}
