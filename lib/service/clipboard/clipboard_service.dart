import 'dart:async';

import 'package:orbit/service/messaging/orbit_message.dart';

import '../messaging/message_router.dart';
import '../webrtc/webrtc_service.dart';
import 'clipboard_message.dart';

class ClipboardService {
  final WebrtcService _webRtcService;
  final MessageRouter _router;

  final StreamController<String> _receivedController =
      StreamController<String>.broadcast();

  StreamSubscription? _subscription;

  ClipboardService({
    required this._webRtcService,
    required MessageRouter router,
  }) : _router = router;

  Stream<String> get receivedStream => _receivedController.stream;

  void initialize() {
    _subscription = _router.register('clipboard').listen(_handleMessage);
  }

  Future<void> sendText(String text) async {
    if (!_webRtcService.isConnected) {
      throw StateError('WebRTC connection is not ready.');
    }

    final message = ClipboardMessage(text: text);

    await _webRtcService.sendText(message.toOrbitMessage().encode());
  }

  void _handleMessage(OrbitMessage message) {
    final clipboardMessage = ClipboardMessage.fromOrbitMessage(message);

    _receivedController.add(clipboardMessage.text);
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    await _receivedController.close();
  }
}
