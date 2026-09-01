import 'package:orbit/models/device.dart';
import 'package:orbit/models/staged_file.dart';
import 'package:orbit/service/webrtc/webrtc_connection_state.dart';

class HomeState {
  final List<Device> devices;
  final Device? selectedDevice;
  final List<StagedFile> stagedFiles;
  final WebrtcConnectionState connectionState;

  const HomeState({
    this.devices = const [],
    this.selectedDevice,
    this.stagedFiles = const [],
    this.connectionState = WebrtcConnectionState.idle,
  });

  HomeState copyWith({
    List<Device>? devices,
    Device? selectedDevice,
    List<StagedFile>? stagedFiles,
    WebrtcConnectionState? connectionState,
  }) {
    return HomeState(
      devices: devices ?? this.devices,
      selectedDevice: selectedDevice ?? this.selectedDevice,
      stagedFiles: stagedFiles ?? this.stagedFiles,
      connectionState: connectionState ?? this.connectionState,
    );
  }
}
