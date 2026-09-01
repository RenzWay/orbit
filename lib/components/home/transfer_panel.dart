import 'package:flutter/material.dart';

class TransferPanel extends StatelessWidget {
  const TransferPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border.all(color: theme.dividerColor),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Center(
        child: Text(
          'Drop file here or Browse',
          style: theme.textTheme.bodySmall,
        ),
      ),
    );
  }
}
