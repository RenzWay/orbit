import 'package:orbit/models/device.dart';
import 'package:orbit/service/device/device_identity_service.dart';
import 'package:orbit/service/device/device_info_service.dart';
import 'package:orbit/service/device/presence_service.dart';

class DeviceService {
  final DeviceIdentityService _identityService;
  final DeviceInfoService _infoService;
  final PresenceService _presenceService;

  DeviceService({
    DeviceIdentityService? identityService,
    DeviceInfoService? infoService,
    PresenceService? presenceService,
  }) : _identityService = identityService ?? DeviceIdentityService(),
       _infoService = infoService ?? DeviceInfoService(),
       _presenceService = presenceService ?? PresenceService();

  Future<String> getDeviceId() {
    return _identityService.getDeviceId();
  }

  Future<String> getDeviceName() {
    return _infoService.getDeviceName();
  }

  Future<void> setOnline({required String userId}) async {
    final deviceId = await _identityService.getDeviceId();
    final deviceName = await _infoService.getDeviceName();

    await _presenceService.setOnline(
      userId: userId,
      deviceId: deviceId,
      deviceName: deviceName,
    );
  }

  Future<void> removeDevice({required String userId}) async {
    final deviceId = await _identityService.getDeviceId();

    await _presenceService.removeDevice(userId: userId, deviceId: deviceId);
  }

  Stream<List<Device>> watchDevices(String userId) {
    return _presenceService.watchDevices(userId).map((event) {
      final value = event.snapshot.value;

      if (value == null || value is! Map) {
        return <Device>[];
      }

      final devices = <Device>[];

      for (final entry in value.entries) {
        final deviceId = entry.key.toString();
        final data = entry.value;

        if (data is! Map) {
          continue;
        }

        final status = data['status'] == 'online'
            ? DeviceStatus.online
            : DeviceStatus.offline;

        devices.add(
          Device(
            id: deviceId,
            deviceName: data['deviceName']?.toString() ?? 'Unknown Device',
            status: status,
          ),
        );
      }

      return devices;
    });
  }
}
