import 'package:flutter/material.dart';
import 'package:orbit/components/home/device_title.dart';
import 'package:orbit/components/home/home_actions.dart';
import 'package:orbit/components/home/transfer_panel.dart';
import 'package:orbit/models/staged_file.dart';
import 'package:orbit/service/clipboard/clipboard_service.dart';
import 'package:orbit/service/webrtc/webrtc_connection_state.dart';

class HomeWorkspace extends StatelessWidget {
  final String? selectedDeviceName;
  final List<StagedFile> files;
  final ValueChanged<StagedFile> onRemoveFile;
  final VoidCallback onPickFiles;
  final Future<void> Function() onSendFiles;
  final ClipboardService clipboardService;
  final WebrtcConnectionState connectionState;

  const HomeWorkspace({
    super.key,
    required this.selectedDeviceName,
    required this.onSendFiles,
    required this.files,
    required this.onRemoveFile,
    required this.onPickFiles,
    required this.clipboardService,
    required this.connectionState,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DeviceTitle(
            deviceName: selectedDeviceName,
            connectionState: connectionState,
          ),
          const SizedBox(height: 16),
          Expanded(
            child: TransferPanel(
              files: files,
              onRemoveFile: onRemoveFile,
              onPickFiles: onPickFiles,
            ),
          ),
          const SizedBox(height: 12),
          HomeActions(
            onSendFiles: onSendFiles,
            onPickFiles: onPickFiles,
            clipboardService: clipboardService,
          ),
        ],
      ),
    );
  }
}
