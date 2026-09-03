import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _isLoading = false;

  void _handleLogin() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final uri = Uri.parse(
        'https://letter-26c71.firebaseapp.com/auth.html',
      );

      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );

      if (!launched) {
        throw 'Could not launch login page';
      }
      
      // We don't set _isLoading = false here because we expect the app 
      // to navigate to the home screen once the deep link is received.
      // If the user manually comes back without logging in, they can try again.
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

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
                      isLoading: _isLoading,
                      onLogin: _handleLogin,
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
  final bool isLoading;
  final VoidCallback onLogin;

  const _LoginContent({
    required this.isLoading,
    required this.onLogin,
  });

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
          ),
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
            width: 220,
            height: 38,
            child: FilledButton(
              onPressed: isLoading ? null : onLogin,
              child: isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Row(
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
