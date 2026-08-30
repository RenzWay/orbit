class RtcConfig {
  static const Map<String, dynamic> peerConnection = {
    'iceServer': [
      {
        'urls': [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
        ],
      },
    ],
  };

  static const String dataChannelLabel = 'orbit';
  static const int bufferedAmountLowThreshold =
    256 * 1024;
}
