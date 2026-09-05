import 'package:device_info_plus/device_info_plus.dart';

class DeviceInfoService {
  final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();

  Future<String> getDeviceName() async {
    if (await _deviceInfo.deviceInfo is WindowsDeviceInfo) {
      final info = await _deviceInfo.windowsInfo;
      return '${info.computerName} (Windows)';
    }

    if (await _deviceInfo.deviceInfo is LinuxDeviceInfo) {
      final info = await _deviceInfo.linuxInfo;
      return '${info.name} (Linux)';
    }

    if (await _deviceInfo.deviceInfo is AndroidDeviceInfo) {
      final info = await _deviceInfo.androidInfo;
      return '${info.model} (Android)';
    }

    if (await _deviceInfo.deviceInfo is MacOsDeviceInfo) {
      final info = await _deviceInfo.macOsInfo;
      return '${info.computerName} (macOS)';
    }

    if (await _deviceInfo.deviceInfo is IosDeviceInfo) {
      final info = await _deviceInfo.iosInfo;
      return '${info.model} (iOS)';
    }

    return 'Unknown Device';
  }
}
