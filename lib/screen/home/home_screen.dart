import 'dart:async';

import 'package:flutter/material.dart';
import 'package:orbit/components/home/home_header.dart';
import 'package:orbit/components/home/home_sidebar.dart';
import 'package:orbit/components/home/home_workspace.dart';
import 'package:orbit/models/device.dart';
import 'package:orbit/screen/home/home_controller.dart';

import '../auth/auth_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final HomeController _controller = HomeController();
  final AuthService _authService = AuthService();

  StreamSubscription<List<Device>>? _devicesSubscription;

  List<Device> _devices = [];
  Device? _selectedDevice;

  @override
  void initState() {
    super.initState();

    _initializeDevices();
  }

  Future<void> _initializeDevices() async {
    final userId = _authService.currentUserId;

    if (userId == null) {
      return;
    }

    _devicesSubscription = _controller.devicesStream.listen((devices) {
      if (!mounted) {
        return;
      }

      setState(() {
        _devices = devices;

        if (_selectedDevice == null && devices.isNotEmpty) {
          _selectedDevice = devices.first;
        }

        final selectedStillExists = devices.any(
          (device) => device.id == _selectedDevice,
        );

        if (!selectedStillExists) {
          _selectedDevice = devices.isNotEmpty ? devices.first : null;
        }
      });
    });

    _controller.watchDevices(userId);

    await _controller.registerCurrentDevice(userId);
  }

  void _selectDevice(Device device) {
    setState(() {
      _selectedDevice = device;
    });
  }

  @override
  void dispose() {
    _devicesSubscription?.cancel();
    _controller.dispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            const HomeHeader(),
            Expanded(
              child: Row(
                children: [
                  HomeSidebar(
                    devices: _devices,
                    selectedDeviceId: _selectedDevice?.id,
                    onDeviceSelected: _selectDevice,
                  ),
                  Expanded(
                    child: HomeWorkspace(
                      selectedDeviceName: _selectedDevice?.deviceName,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
