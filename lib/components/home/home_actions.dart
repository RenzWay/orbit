import 'package:flutter/material.dart';

class HomeActions extends StatelessWidget {
  const HomeActions({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: FilledButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.send, size: 16),
            label: const Text('Send Files'),
          ),
        ),

        const SizedBox(width: 8),

        Expanded(
          child: OutlinedButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.content_copy, size: 16),
            label: const Text('Clipboard'),
          ),
        ),

        const SizedBox(width: 8),

        IconButton(
          onPressed: () {},
          icon: const Icon(Icons.refresh),
          tooltip: 'Refresh connection',
        ),
      ],
    );
  }
}
