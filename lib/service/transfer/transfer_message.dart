import 'dart:convert';

class TransferMessage {
  final String type;
  final Map<String, dynamic> data;

  const TransferMessage({required this.type, required this.data});
  String encode() {
    return jsonEncode({'type': type, 'data': data});
  }

  factory TransferMessage.decode(String value) {
    final decoded = jsonDecode(value);

    if (decoded is! Map) {
      throw FormatException('Invalid transfer message.');
    }

    return TransferMessage(
      type: decoded['type'] as String,
      data: Map<String, dynamic>.from(decoded['data'] as Map),
    );
  }
}
