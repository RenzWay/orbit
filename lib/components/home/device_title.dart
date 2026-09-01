import 'package:flutter/material.dart';

class DeviceTitle extends StatelessWidget {
  const DeviceTitle({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'User / Windows',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Select file or drop file to send to your device',
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }
}
