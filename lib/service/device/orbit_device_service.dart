import 'package:orbit/service/auth/auth_service.dart';
import 'package:orbit/service/device/device_service.dart';

class OrbitDeviceService {
  final AuthService _authService;
  final DeviceService _deviceService;

  OrbitDeviceService({AuthService? authService, DeviceService? deviceService})
    : _authService = authService ?? AuthService(),
      _deviceService = deviceService ?? DeviceService();

  Future<void> registerCurrentDevice() async {
    final user = _authService.currentUser;

    if (user == null) {
      throw StateError('User is not authenticated');
    }

    await _deviceService.setOnline(userId: user.uid);
  }

  Future<void> removeCurrentDevice() async {
    final user = _authService.currentUser;

    if (user == null) {
      return;
    }

    await _deviceService.removeDevice(userId: user.uid);
  }
}
