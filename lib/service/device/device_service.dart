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
}
