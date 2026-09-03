import 'package:flutter/material.dart';
import 'package:orbit/components/home/device_card.dart';
import 'package:orbit/models/device.dart';

class HomeSidebar extends StatefulWidget {
  final List<Device> devices;
  final String? selectedDeviceId;
  final Future<void> Function(Device) onDeviceSelected;

  const HomeSidebar({
    super.key,
    required this.devices,
    required this.selectedDeviceId,
    required this.onDeviceSelected,
  });

  @override
  State<HomeSidebar> createState() => _HomeSidebarState();
}

class _HomeSidebarState extends State<HomeSidebar> {
  static const double _minWidth = 150;
  static const double _maxWidth = 400;

  double _width = 200;

  void _onDragUpdate(DragUpdateDetails details) {
    setState(() {
      _width = (_width + details.delta.dx).clamp(_minWidth, _maxWidth);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          width: _width,
          padding: const EdgeInsets.all(12),
          color: Theme.of(context).colorScheme.surface,
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
                  itemCount: widget.devices.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 6),
                  itemBuilder: (context, index) {
                    final device = widget.devices[index];

                    return DeviceCard(
                      device: device,
                      selected: device.id == widget.selectedDeviceId,
                      onTap: () => widget.onDeviceSelected(device),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        MouseRegion(
          cursor: SystemMouseCursors.resizeColumn,
          child: GestureDetector(
            behavior: HitTestBehavior.translucent,
            onHorizontalDragUpdate: _onDragUpdate,
            child: SizedBox(
              width: 8,
              child: Center(
                child: Container(
                  width: 1,
                  color: Theme.of(context).dividerColor,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
