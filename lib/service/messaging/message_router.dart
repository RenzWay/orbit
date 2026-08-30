import 'dart:async';

import 'package:orbit/service/messaging/orbit_message.dart';

class MessageRouter {
   final Map<String, StreamController<OrbitMessage>>
      _controllers = {};

  Stream<OrbitMessage> register(String type) {
    final controller = _controllers.putIfAbsent(
      type,
      () => StreamController<OrbitMessage>.broadcast(),
    );

    return controller.stream;
  }

  void route(String value) {
    final message = OrbitMessage.decoded(value);

    final controller = _controllers[message.type];

    if (controller == null) {
      return;
    }

    controller.add(message);
  }

  Future<void> dispose() async {
    for (final controller in _controllers.values) {
      await controller.close();
    }

    _controllers.clear();
  }
}