import 'package:flutter/material.dart';
import 'package:orbit/components/home/device_card.dart';
import 'package:orbit/models/device.dart';

class HomeSidebar extends StatelessWidget {
  final List<Device> devices;
  final String? selectedDeviceId;
  final ValueChanged<Device> onDeviceSelected;

  const HomeSidebar({
    super.key,
    required this.devices,
    required this.selectedDeviceId,
    required this.onDeviceSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 150,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          right: BorderSide(color: Theme.of(context).dividerColor),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Devices',
            style: Theme.of(context).textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            'Choose your devices',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),

          Expanded(
            child: ListView.separated(
              itemCount: devices.length,
              separatorBuilder: (_, _) => const SizedBox(height: 6),
              itemBuilder: (context, index) {
                final device = devices[index];

                return DeviceCard(
                  device: device,
                  selected: device.id == selectedDeviceId,
                  onTap: () => onDeviceSelected(device),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
