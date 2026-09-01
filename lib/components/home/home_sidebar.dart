import 'package:flutter/material.dart';
import 'package:orbit/components/home/device_card.dart';

class HomeSidebar extends StatelessWidget {
  const HomeSidebar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 150,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          right: BorderSide(
            color: Theme.of(context).dividerColor,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Devices',
            style: Theme.of(context)
                .textTheme
                .titleSmall
                ?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            'Choose your devices',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),

          const DeviceItem(
            name: 'User',
            deviceName: 'Windows',
            selected: true,
          ),
        ],
      ),
    );
  }
}