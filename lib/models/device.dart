enum DeviceStatus { online, offline }

class Device {
  final String id;
  final String deviceName;
  final DeviceStatus status;

  const Device({
    required this.id,
    required this.deviceName,
    required this.status,
  });
}
