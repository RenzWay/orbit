import 'package:flutter/material.dart';
import 'package:orbit/components/home/device_title.dart';
import 'package:orbit/components/home/home_actions.dart';
import 'package:orbit/components/home/transfer_panel.dart';

class HomeWorkspace extends StatelessWidget {
  const HomeWorkspace({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const DeviceTitle(),
          const SizedBox(height: 16),
          const Expanded(
            child: TransferPanel(),
          ),
          const SizedBox(height: 12),
          const HomeActions(),
        ],
      ),
    );
  }
}