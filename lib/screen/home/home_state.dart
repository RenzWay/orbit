import 'package:orbit/models/device.dart';
import 'package:orbit/models/staged_file.dart';

class HomeState {
  final List<Device> devices;
  final Device? selectedDevice;
  final List<StagedFile> stagedFiles;

  const HomeState({
    this.devices = const [],
    this.selectedDevice,
    this.stagedFiles = const [],
  });

  HomeState copyWith({
    List<Device>? devices,
    Device? selectedDevice,
    List<StagedFile>? stagedFiles,
  }) {
    return HomeState(
      devices: devices ?? this.devices,
      selectedDevice: selectedDevice ?? this.selectedDevice,
      stagedFiles: stagedFiles ?? this.stagedFiles,
    );
  }
}
