import 'dart:async';

import 'package:clipboard/clipboard.dart';
import 'package:flutter/material.dart';
import 'package:flutter/widgets.dart';
import 'package:orbit/service/clipboard/clipboard_service.dart';

class ClipboardDialog extends StatefulWidget {
  final ClipboardService clipboardService;

  const ClipboardDialog({super.key, required this.clipboardService});

  @override
  State<StatefulWidget> createState() => _ClipboardDialogState();
}

class _ClipboardDialogState extends State<ClipboardDialog> {
  String _localText = '';
  String _receivedText = '';
  bool _loading = true;
  bool _sending = false;

  StreamSubscription<String>? _receivedSubscription;

  @override
  void initState() {
    super.initState();

    _loadClipboard();

    _receivedSubscription = widget.clipboardService.receivedStream.listen((
      text,
    ) {
      if (!mounted) {
        return;
      }

      setState(() {
        _receivedText = text;
      });
    });
  }

  Future<void> _loadClipboard() async {
    try {
      final text = await FlutterClipboard.paste();

      if (!mounted) {
        return;
      }

      setState(() {
        _localText = text;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _sendClipboard() async {
    if (_localText.trim().isEmpty || _sending) {
      return;
    }

    setState(() {
      _sending = true;
    });

    try {
      await widget.clipboardService.sendText(_localText);

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Clipboard sent')));
    } catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to send clipboard: $error')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _receivedSubscription?.cancel();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Clipboard'),
      content: _loading
          ? const SizedBox(
              height: 100,
              child: Center(child: CircularProgressIndicator()),
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Text(
                  'Your Clipboard',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),

                Container(
                  width: double.infinity,
                  constraints: const BoxConstraints(maxHeight: 180),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    border: Border.all(color: Theme.of(context).dividerColor),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: SingleChildScrollView(
                    child: SelectableText(
                      _localText.isEmpty ? 'Clipboard is empty' : _localText,
                    ),
                  ),
                ),

                const SizedBox(height: 20),

                const Text(
                  'Received',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),

                Container(
                  width: double.infinity,
                  constraints: const BoxConstraints(maxHeight: 180),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    border: Border.all(color: Theme.of(context).dividerColor),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: SingleChildScrollView(
                    child: SelectableText(
                      _receivedText.isEmpty
                          ? 'No clipboard received'
                          : _receivedText,
                    ),
                  ),
                ),
              ],
            ),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.of(context).pop();
          },
          child: const Text('Close'),
        ),
        FilledButton.icon(
          onPressed: _localText.trim().isEmpty || _sending
              ? null
              : _sendClipboard,
          icon: _sending
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.send),
          label: const Text('Send'),
        ),
      ],
    );
  }
}
