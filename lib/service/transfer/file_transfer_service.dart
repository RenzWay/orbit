import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:orbit/service/transfer/file_metadata.dart';
import 'package:orbit/service/transfer/file_receiver.dart';
import 'package:orbit/service/transfer/transfer_config.dart';
import 'package:orbit/service/transfer/transfer_message.dart';
import 'package:orbit/service/transfer/transfer_protocol.dart';
import 'package:orbit/service/transfer/transfer_state.dart';
import 'package:orbit/service/webrtc/webrtc_service.dart';

class FileTransferService {
  final WebrtcService _webrtcService;

  final StreamController<TransferState> _stateController =
      StreamController<TransferState>.broadcast();

  TransferState? _currentTransfer;

  FileTransferService({required WebrtcService webRtcService})
    : _webrtcService = webRtcService;

  FileReceiver _receiver = FileReceiver();

  Stream<TransferState> get stateStream => _stateController.stream;

  TransferState? get currentTransfer => _currentTransfer;

  void initialize() {
    _webrtcService.messageStream.listen(_handleMessage);
  }

  void _handleMessage(RTCDataChannelMessage message) {
    if (message.isBinary) {
      _handleBinary(message.binary);

      return;
    }

    _handleText(message.text);
  }

  void _handleText(String value) {
    final message = TransferMessage.decode(value);

    switch (message.type) {
      case TransferProtocol.fileStart:
        _handleFileStart(message.data);
        break;

      case TransferProtocol.fileComplete:
        _handleFileComplete(message.data);
        break;

      case TransferProtocol.fileCancel:
        _handleFileCancel(message.data);
        break;
    }
  }

  void _handleFileStart(Map<String, dynamic> data) {
    final metadata = FileMetadata.fromMap(data);

    _receiver.reset();

    _updateState(
      TransferState(
        transferId: metadata.transferId,
        fileName: metadata.fileName,
        totalBytes: metadata.fileSize,
        transferredBytes: 0,
        status: TransferStatus.transfering,
      ),
    );
  }

  void _handleBinary(Uint8List chunk) {
    _receiver.addChunk(chunk);

    final state = _currentTransfer;

    if (state == null) {
      return;
    }

    _updateState(
      TransferState(
        transferId: state.transferId,
        fileName: state.fileName,
        totalBytes: state.totalBytes,
        transferredBytes: state.transferredBytes + chunk.length,
        status: TransferStatus.transfering,
      ),
    );
  }

  void _handleFileComplete(Map<String, dynamic> data) {
    final transferId = data['transferId'] as String;

    final state = _currentTransfer;

    if (state == null || state.transferId != transferId) {
      return;
    }

    final fileBytes = _receiver.complete();

    // Untuk sekarang hasilnya hanya tersedia
    // di memory.
    //
    // Milestone berikutnya kita simpan ke storage.

    _updateState(
      TransferState(
        transferId: state.transferId,
        fileName: state.fileName,
        totalBytes: state.totalBytes,
        transferredBytes: state.totalBytes,
        status: TransferStatus.completed,
      ),
    );

    _receiver.reset();

    print('Received ${fileBytes.length} bytes.');
  }

  void _handleFileCancel(Map<String, dynamic> data) {
    final state = _currentTransfer;

    if (state == null) {
      return;
    }

    _receiver.reset();

    _updateState(
      TransferState(
        transferId: state.transferId,
        fileName: state.fileName,
        totalBytes: state.totalBytes,
        transferredBytes: state.transferredBytes,
        status: TransferStatus.cancelled,
      ),
    );
  }

  Future<void> cancel() async {
    final state = _currentTransfer;

    if (state == null) {
      return;
    }

    await _webrtcService.sendText(
      TransferMessage(
        type: TransferProtocol.fileCancel,
        data: {'transferId': state.transferId},
      ).encode(),
    );

    _updateState(
      TransferState(
        transferId: state.transferId,
        fileName: state.fileName,
        totalBytes: state.totalBytes,
        transferredBytes: state.transferredBytes,
        status: TransferStatus.cancelled,
      ),
    );
  }

  Future<void> sendFile({
    required FileMetadata metadata,
    required Uint8List fileBytes,
  }) async {
    if (!_webrtcService.isConnected) {
      throw StateError('WebRTC connection is not ready.');
    }

    if (fileBytes.length != metadata.fileSize) {
      throw ArgumentError('File size does not match metadata.');
    }

    _updateState(
      TransferState(
        transferId: metadata.transferId,
        fileName: metadata.fileName,
        totalBytes: metadata.fileSize,
        transferredBytes: 0,
        status: TransferStatus.preparing,
      ),
    );

    final startMessage = TransferMessage(
      type: TransferProtocol.fileStart,
      data: metadata.toMap(),
    );

    await _webrtcService.sendText(startMessage.encode());

    _updateState(
      TransferState(
        transferId: metadata.transferId,
        fileName: metadata.fileName,
        totalBytes: metadata.fileSize,
        transferredBytes: 0,
        status: TransferStatus.transfering,
      ),
    );

    var offset = 0;

    while (offset < fileBytes.length) {
      final end = (offset + TransferConfig.chunkSize).clamp(
        0,
        fileBytes.length,
      );

      final chunk = fileBytes.sublist(offset, end);

      await _webrtcService.sendBinary(Uint8List.fromList(chunk));

      offset = end;

      _updateState(
        TransferState(
          transferId: metadata.transferId,
          fileName: metadata.fileName,
          totalBytes: metadata.fileSize,
          transferredBytes: offset,
          status: TransferStatus.transfering,
        ),
      );
    }

    final completeMessage = TransferMessage(
      type: TransferProtocol.fileComplete,
      data: {'transferId': metadata.transferId},
    );

    await _webrtcService.sendText(completeMessage.encode());

    _updateState(
      TransferState(
        transferId: metadata.transferId,
        fileName: metadata.fileName,
        totalBytes: metadata.fileSize,
        transferredBytes: metadata.fileSize,
        status: TransferStatus.completed,
      ),
    );
  }

  void _updateState(TransferState state) {
    _currentTransfer = state;
    _stateController.add(state);
  }

  Future<void> dispose() async {
    await _stateController.close();
  }
}
