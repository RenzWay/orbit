import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:orbit/models/device.dart';
import 'package:orbit/models/staged_file.dart';
import 'package:orbit/screen/home/home_state.dart';
import 'package:orbit/service/device/device_service.dart';
import 'package:orbit/service/transfer/file_metadata.dart';
import 'package:orbit/service/transfer/file_transfer_service.dart';
import 'package:orbit/service/transfer/transfer_id.dart';
import 'package:orbit/service/webrtc/webrtc_service.dart';
import 'package:orbit/service/clipboard/clipboard_service.dart';

class HomeController {
  final DeviceService _deviceService;
  final WebrtcService _webrtcService;
  late final ClipboardService _clipboardService;
  late final FileTransferService _fileTransferService;

  HomeController({DeviceService? deviceService, WebrtcService? webrtcService})
    : _deviceService = deviceService ?? DeviceService(),
      _webrtcService = webrtcService ?? WebrtcService(),
      _clipboardService = ClipboardService(
        webRtcService: webrtcService ?? WebrtcService(),
        router: (webrtcService ?? WebrtcService()).router,
      ) {
    _fileTransferService = FileTransferService(webRtcService: _webrtcService);

    _fileTransferService.initialize();

    _clipboardService = ClipboardService(
      webRtcService: _webrtcService,
      router: _webrtcService.router,
    );

    _clipboardService.initialize();
  }

  final StreamController<HomeState> _stateController =
      StreamController<HomeState>.broadcast();

  StreamSubscription<List<Device>>? _deviceSubscription;

  HomeState _state = const HomeState();

  Stream<HomeState> get stateStream => _stateController.stream;

  HomeState get state => _state;

  ClipboardService get clipboardService =>
    _clipboardService;

  Future<void> registerCurrentDevice(String userId) async {
    await _deviceService.setOnline(userId: userId);
  }

  void watchDevices(String userId) {
    _deviceSubscription?.cancel();

    _deviceSubscription = _deviceService.watchDevices(userId).listen((devices) {
      Device? selectedDevice = _state.selectedDevice;

      if (selectedDevice == null && devices.isNotEmpty) {
        selectedDevice = devices.first;
      } else if (selectedDevice != null) {
        final stillExists = devices.any(
          (device) => device.id == selectedDevice!.id,
        );

        if (!stillExists) {
          selectedDevice = devices.isNotEmpty ? devices.first : null;
        }
      }

      _updateState(
        _state.copyWith(devices: devices, selectedDevice: selectedDevice),
      );
    });
  }

  Future<void> pickFiles() async {
    final files = await FilePicker.pickFiles(allowMultiple: true);

    if (files.isEmpty) return;

    final newFiles = await Future.wait(
      files
          .where((file) => file.path != null)
          .map(
            (file) async => StagedFile(
              name: file.name,
              path: file.path!,
              size: await file.length(),
            ),
          ),
    );

    if (newFiles.isEmpty) {
      return;
    }

    _updateState(
      _state.copyWith(stagedFiles: [..._state.stagedFiles, ...newFiles]),
    );
  }

  Future<void> sendStagedFiles() async {
    final selectedDevice = _state.selectedDevice;

    if (selectedDevice == null) {
      throw StateError('No device selected.');
    }

    if (_state.stagedFiles.isEmpty) {
      return;
    }

    for (final stagedFile in _state.stagedFiles) {
      final file = File(stagedFile.path);
      final bytes = await file.readAsBytes();

      final metadata = FileMetadata(
        transferId: TransferId.generate(),
        fileName: stagedFile.name,
        fileSize: bytes.length,
        mimeType: 'application/octet-stream',
      );

      await _fileTransferService.sendFile(metadata: metadata, fileBytes: bytes);
    }

    clearStagedFiles();
  }

  void selectDevice(Device device) {
    _updateState(_state.copyWith(selectedDevice: device));
  }

  void addStagedFile(StagedFile file) {
    final files = [..._state.stagedFiles, file];

    _updateState(_state.copyWith(stagedFiles: files));
  }

  void removeStagedFile(StagedFile file) {
    final files = [..._state.stagedFiles];

    files.remove(file);

    _updateState(_state.copyWith(stagedFiles: files));
  }

  void clearStagedFiles() {
    _updateState(_state.copyWith(stagedFiles: const []));
  }

  void _updateState(HomeState state) {
    _state = state;

    if (!_stateController.isClosed) {
      _stateController.add(_state);
    }
  }

  Future<void> dispose() async {
    await _deviceSubscription?.cancel();
    await _clipboardService.dispose();
    await _stateController.close();
  }
}
