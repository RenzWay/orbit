enum ConnectionRole { caller, callee }

class ConnectionSession {
  final String connectionId;
  final String localDeviceId;
  final String remoteDeviceId;
  final String userId;
  final ConnectionRole role;

  const ConnectionSession({
    required this.connectionId,
    required this.localDeviceId,
    required this.remoteDeviceId,
    required this.userId,
    required this.role,
  });

  bool get isCaller {
    return role == ConnectionRole.caller;
  }

  bool get isCallee {
    return role == ConnectionRole.callee;
  }
}
