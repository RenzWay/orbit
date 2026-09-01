import 'dart:async';

import 'package:orbit/models/staged_file.dart';
import 'package:orbit/service/device/device_service.dart';
import 'package:orbit/models/device.dart';

class HomeController {
  final DeviceService _deviceService;
  final List<StagedFile> _stagedFiles = [];

  HomeController({DeviceService? deviceService})
    : _deviceService = deviceService ?? DeviceService();

  StreamSubscription? _deviceSubscription;

  final StreamController<List<Device>> _devicesController =
      StreamController<List<Device>>.broadcast();

  Stream<List<Device>> get devicesStream => _devicesController.stream;

  List<StagedFile> get stagedFiles => List.unmodifiable(_stagedFiles);

  Future<void> registerCurrentDevice(String userId) async {
    await _deviceService.setOnline(userId: userId);
  }

  void watchDevices(String userId) {
    _deviceSubscription?.cancel();

    _deviceSubscription = _deviceService.watchDevices(userId).listen((devices) {
      _devicesController.add(devices);
    });
  }

  void addStagedFile(StagedFile file) {
    _stagedFiles.add(file);
    _notify();
  }

  void removeStagedFile(StagedFile file) {
    _stagedFiles.remove(file);
    _notify();
  }

  void clearStagedFiles() {
    _stagedFiles.clear();
    _notify();
  }

  void _notify() {
    _stateController.add(
      HomeState(
        devices: _devices,
        selectedDevice: _selectedDevice,
        stagedFiles: List.unmodifiable(_stagedFiles),
      ),
    );
  }

  Future<void> dispose() async {
    await _deviceSubscription?.cancel();
    await _devicesController.close();
  }
}
