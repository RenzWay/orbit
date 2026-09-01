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
import 'package:orbit/service/webrtc/webrtc_connection_state.dart';
import 'package:orbit/service/webrtc/webrtc_service.dart';
import 'package:orbit/service/clipboard/clipboard_service.dart';
import 'package:orbit/service/webrtc/connection_service.dart';
import 'package:orbit/service/webrtc/connection_session.dart';

class HomeController {
  final DeviceService _deviceService;
  final WebrtcService _webrtcService;
  late final ClipboardService _clipboardService;
  late final FileTransferService _fileTransferService;
  final ConnectionService _connectionService;

  StreamSubscription<ConnectionSession>? _incomingConnectionSubscription;
  StreamSubscription<WebrtcConnectionState>? _webrtcStateSubscription;

  ConnectionSession? _currentSession;

  HomeController({
    DeviceService? deviceService,
    WebrtcService? webrtcService,
    ConnectionService? connectionService,
  }) : _deviceService = deviceService ?? DeviceService(),
       _webrtcService = webrtcService ?? WebrtcService(),
       _connectionService = connectionService ?? ConnectionService() {
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

  ClipboardService get clipboardService => _clipboardService;

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

  Future<void> connectToDevice({
    required String userId,
    required Device device,
  }) async {
    final localDeviceId = await _deviceService.getDeviceId();

    await _webrtcService.close(session: _currentSession);

    _currentSession = await _connectionService.createCallerSession(
      userId: userId,
      localDeviceId: localDeviceId,
      remoteDeviceId: device.id,
    );

    _webrtcStateSubscription?.cancel();

    _webrtcStateSubscription = _webrtcService.stateStream.listen((state) {
      _updateState(_state.copyWith(connectionState: state));
    });

    await _webrtcService.startCaller(_currentSession!);
  }

  Future<void> watchIncomingConnections(String userId) async {
    final localDeviceId = await _deviceService.getDeviceId();

    _incomingConnectionSubscription?.cancel();

    _incomingConnectionSubscription = _connectionService
        .watchIncomingSessions(userId: userId, localDeviceId: localDeviceId)
        .listen((session) async {
          if (_currentSession != null) {
            return;
          }

          _currentSession = session;

          await _webrtcService.startCallee(session);
        });
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
    await _incomingConnectionSubscription?.cancel();
    await _webrtcStateSubscription?.cancel();

    await _clipboardService.dispose();
    await _webrtcService.close();
    await _stateController.close();
  }
}
