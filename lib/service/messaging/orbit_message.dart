import 'dart:convert';

class OrbitMessage {
  final String type;
  final Map<String, dynamic> data;

  const OrbitMessage({required this.type, required this.data});

  String encode() {
    return jsonEncode({'type': type, 'data': data});
  }

  factory OrbitMessage.decoded(String value) {
    final decoded = jsonDecode(value);
    if (decoded is! Map) {
      throw const FormatException('Invalid Orbit message.');
    }

    final type = decoded['type'];

    if (type is! String) {
      throw const FormatException('Message type is missing.');
    }

    final rawData = decoded['data'];

    if (rawData is! Map) {
      throw const FormatException('Message data is invalid.');
    }

    return OrbitMessage(type: type, data: Map<String, dynamic>.from(rawData));
  }
}
