import 'package:flutter/material.dart';
import 'package:orbit/models/staged_file.dart';

class TransferPanel extends StatelessWidget {
  final List<StagedFile> files;
  final ValueChanged<StagedFile> onRemoveFile;
  final VoidCallback onPickFiles;

  const TransferPanel({
    super.key,
    required this.files,
    required this.onRemoveFile,
    required this.onPickFiles,
  });

  String _formatFileSize(int size) {
    if (size < 1024) {
      return '$size B';
    }

    if (size < 1024 * 1024) {
      return '${(size / 1024).toStringAsFixed(1)} KB';
    }

    if (size < 1024 * 1024 * 1024) {
      return '${(size / (1024 * 1024)).toStringAsFixed(1)} MB';
    }

    return '${(size / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
  }

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
      child: files.isEmpty
          ? Center(
              child: TextButton(
                onPressed: onPickFiles,
                child: const Text('Drop file here or Browse'),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: files.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final file = files[index];

                return ListTile(
                  dense: true,
                  leading: const Icon(Icons.insert_drive_file_outlined),
                  title: Text(
                    file.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text(_formatFileSize(file.size)),
                  trailing: IconButton(
                    onPressed: () => onRemoveFile,
                    icon: const Icon(Icons.close, size: 18),
                    tooltip: 'remove',
                  ),
                );
              },
            ),
    );
  }
}
