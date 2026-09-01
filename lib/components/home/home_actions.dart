import 'package:flutter/material.dart';
import 'package:orbit/screen/home/clipboard_dialog.dart';
import 'package:orbit/service/clipboard/clipboard_service.dart';

class HomeActions extends StatelessWidget {
  final VoidCallback onPickFiles;
  final Future<void> Function() onSendFiles;
  final ClipboardService clipboardService;

  const HomeActions({
    super.key,
    required this.onPickFiles,
    required this.onSendFiles,
    required this.clipboardService,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: FilledButton.icon(
            onPressed: onPickFiles,
            icon: const Icon(Icons.send, size: 16),
            label: const Text('Send Files'),
          ),
        ),

        const SizedBox(width: 8),

        Expanded(
          child: OutlinedButton.icon(
            onPressed: () {
              showDialog(
                context: context,
                builder: (_) =>
                    ClipboardDialog(clipboardService: clipboardService),
              );
            },
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
