import 'package:flutter/material.dart';
import 'package:orbit/screen/auth/auth_controller.dart';
import 'package:url_launcher/url_launcher.dart';

class LoginScreen extends StatelessWidget {
  LoginScreen({super.key});

  final AuthController _authController = AuthController();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720, maxHeight: 360),
            child: Container(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(10),
                boxShadow: [
                  BoxShadow(
                    blurRadius: 20,
                    spreadRadius: 2,
                    color: Colors.black.withValues(alpha: 0.15),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Row(
                children: [
                  Expanded(
                    flex: 5,
                    child: _LoginContent(
                      onLogin: () async {
                        final uri = Uri.parse(
                          'https://letter-26c71.firebaseapp.com/auth.html',
                        );

                        await launchUrl(
                          uri,
                          mode: LaunchMode.externalApplication,
                        );
                      },
                    ),
                  ),
                  Expanded(
                    flex: 5,
                    child: Image.asset(
                      'assets/background.jpg',
                      fit: BoxFit.cover,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LoginContent extends StatelessWidget {
  final VoidCallback onLogin;

  const _LoginContent({required this.onLogin});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Image.asset(
            'assets/ic_orbit.png',
            height: 30,
            width: 30,
            colorBlendMode: BlendMode.clear,
          ),
          // Icon(
          //   Icons.all_inclusive,
          //   size: 34,
          //   color: Theme.of(context).colorScheme.primary,
          // ),

          const SizedBox(height: 14),
          Text(
            'Welcome To Orbit',
            style: Theme.of(context).textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.bold),
          ),

          const SizedBox(height: 2),
          Text(
            'Please login first to use Orbit',
            style: Theme.of(context).textTheme.bodySmall,
          ),

          const SizedBox(height: 20),
          SizedBox(
            width: 180,
            height: 38,
            child: FilledButton(
              onPressed: onLogin,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 20,
                    height: 20,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Image.asset(
                      'assets/ic_google.png',
                      colorBlendMode: BlendMode.srcIn,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text('Login with Google'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
