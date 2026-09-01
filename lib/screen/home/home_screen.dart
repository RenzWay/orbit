import 'package:flutter/material.dart';
import 'package:orbit/components/home/home_header.dart';
import 'package:orbit/components/home/home_sidebar.dart';
import 'package:orbit/components/home/home_workspace.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

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
                  const HomeSidebar(),
                  const Expanded(child: HomeWorkspace()),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
