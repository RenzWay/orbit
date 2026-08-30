import 'package:uuid/uuid.dart';

class ConnectionIdGenerator {
  final Uuid _uuid;

  ConnectionIdGenerator({Uuid? uuid}) : _uuid = uuid ?? const Uuid();

  String generate() {
    return _uuid.v4();
  }
}
