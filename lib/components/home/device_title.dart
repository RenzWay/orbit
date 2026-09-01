import 'package:flutter/material.dart';

class DeviceTitle extends StatelessWidget {
  final String? deviceName;

  const DeviceTitle({super.key, this.deviceName});

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
      ],
    );
  }
}
