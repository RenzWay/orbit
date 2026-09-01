import 'package:flutter/material.dart';
import 'package:orbit/service/webrtc/webrtc_connection_state.dart';

class DeviceTitle extends StatelessWidget {
  final String? deviceName;
  final WebrtcConnectionState connectionState;

  const DeviceTitle({
    super.key,
    this.deviceName,
    required this.connectionState,
  });

  String _connectionText() {
    switch (connectionState) {
      case WebrtcConnectionState.idle:
        return 'Not Connected';
      case WebrtcConnectionState.connecting:
        return 'Connecting...';

      case WebrtcConnectionState.connected:
        return 'Connected';

      case WebrtcConnectionState.disconnected:
        return 'Disconnected';

      case WebrtcConnectionState.failed:
        return 'Connection failed';

      case WebrtcConnectionState.closed:
        return 'Connection closed';
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final title = deviceName == null ? 'No device selected' : deviceName!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          deviceName == null
              ? 'Select a device to continue'
              : 'Select file or drop file to send to this device',
          style: theme.textTheme.bodySmall,
        ),
        Text(_connectionText(), style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
