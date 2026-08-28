import 'package:device_info_plus/device_info_plus.dart';

class DeviceInfoService {
  final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();

  Future<String> getDeviceName() async {
    if (await _deviceInfo.deviceInfo is LinuxDeviceInfo) {
      final info = await _deviceInfo.linuxInfo;
      return info.prettyName;
    }

    if (await _deviceInfo.deviceInfo is WindowsDeviceInfo) {
      final info = await _deviceInfo.windowsInfo;
      return info.computerName;
    }

    if (await _deviceInfo.deviceInfo is AndroidDeviceInfo) {
      final info = await _deviceInfo.androidInfo;
      return info.model;
    }

    if (await _deviceInfo.deviceInfo is MacOsDeviceInfo) {
      final info = await _deviceInfo.macOsInfo;
      return info.computerName;
    }

    if (await _deviceInfo.deviceInfo is IosDeviceInfo) {
      final info = await _deviceInfo.iosInfo;
      return info.model;
    }

    return 'Unknown Devices';
  }
}
