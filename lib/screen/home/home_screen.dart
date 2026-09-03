import 'dart:async';

import 'package:flutter/material.dart';
import 'package:orbit/components/home/home_header.dart';
import 'package:orbit/components/home/home_sidebar.dart';
import 'package:orbit/components/home/home_workspace.dart';
import 'package:orbit/models/device.dart';
import 'package:orbit/screen/auth/auth_controller.dart';
import 'package:orbit/screen/home/home_controller.dart';
import 'package:orbit/screen/home/home_state.dart';

import '../auth/auth_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final AuthController _authController = AuthController();
  final HomeController _controller = HomeController();
  final AuthService _authService = AuthService();

  StreamSubscription<HomeState>? _stateSubscription;

  HomeState _state = const HomeState();

  @override
  void initState() {
    super.initState();

    _stateSubscription = _controller.stateStream.listen((state) {
      if (!mounted) {
        return;
      }

      setState(() {
        _state = state;
      });
    });

    _initialize();
  }

  Future<void> _initialize() async {
    await _authService.restoreSession();

    final userId = _authService.currentUserId;

    if (userId == null) {
      return;
    }

    _controller.watchDevices(userId);

    await _controller.watchIncomingConnections(userId);
    await _controller.registerCurrentDevice(userId);
  }

  Future<void> _selectDevice(Device device) async {
    _controller.selectDevice(device);

    final userId = _authService.currentUserId;

    if (userId == null) {
      return;
    }

    await _controller.connectToDevice(userId: userId, device: device);
  }

  @override
  void dispose() {
    _stateSubscription?.cancel();
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
            HomeHeader(authController: _authController),
            Expanded(
              child: Row(
                children: [
                  HomeSidebar(
                    devices: _state.devices,
                    selectedDeviceId: _state.selectedDevice?.id,
                    onDeviceSelected: _selectDevice,
                  ),
                  Expanded(
                    child: HomeWorkspace(
                      selectedDeviceName: _state.selectedDevice?.deviceName,
                      connectionState: _state.connectionState,
                      files: _state.stagedFiles,
                      onRemoveFile: _controller.removeStagedFile,
                      onPickFiles: _controller.pickFiles,
                      onSendFiles: _controller.sendStagedFiles,
                      clipboardService: _controller.clipboardService,
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
