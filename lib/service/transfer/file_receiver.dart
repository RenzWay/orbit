import 'dart:typed_data';

class FileReceiver {
  String? _transferId;
  String? _fileName;
  int _expectedSize = 0;

  final List<Uint8List> _chunks = [];

  int _receivedBytes = 0;

  void start({
    required String transferId,
    required String fileName,
    required int fileSize,
  }) {
    _transferId = transferId;
    _fileName = fileName;
    _expectedSize = fileSize;

    _chunks.clear();
    _receivedBytes = 0;
  }

  void addChunk(Uint8List chunk) {
    if (_transferId == null) {
      throw StateError('No active file transfer.');
    }

    _chunks.add(chunk);
    _receivedBytes += chunk.length;
  }

  Uint8List complete() {
    if (_transferId == null) {
      throw StateError('No active file transfer.');
    }

    if (_receivedBytes != _expectedSize) {
      throw StateError('Received file size does not match expected size.');
    }

    final result = BytesBuilder();

    for (final chunk in _chunks) {
      result.add(chunk);
    }

    return result.takeBytes();
  }

  String get fileName {
    final name = _fileName;

    if (name == null) {
      throw StateError('No active file transfer.');
    }

    return name;
  }

  void reset() {
    _transferId = null;
    _fileName = null;
    _expectedSize = 0;

    _chunks.clear();
    _receivedBytes = 0;
  }
}
