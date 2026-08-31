
import 'package:orbit/service/messaging/orbit_message.dart';

class ClipboardMessage {
  final String text;

  const ClipboardMessage({required this.text});

  OrbitMessage toOrbitMessage() {
    return OrbitMessage(type: 'clipboard', data: {'text': text});
  }

  factory ClipboardMessage.fromOrbitMessage(OrbitMessage message) {
    return ClipboardMessage(text: message.data['text'] as String);
  }
}
