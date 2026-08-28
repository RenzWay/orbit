import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

class DeviceIdentityService {
  static const String _deviceIdKey = "device_id";

  final SharedPreferencesAsync _preferences;
  final Uuid _uuid;

  DeviceIdentityService({SharedPreferencesAsync? preferences, Uuid? uuid})
    : _preferences = preferences ?? SharedPreferencesAsync(),
      _uuid = uuid ?? const Uuid();

  Future<String> getDeviceId() async {
    final existingId = await _preferences.getString(_deviceIdKey);

    if (existingId != null && existingId.isNotEmpty) {
      return existingId;
    }

    final newId = _uuid.v4();

    await _preferences.setString(_deviceIdKey, newId);

    return newId;
  }
}
