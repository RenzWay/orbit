import 'ice_candidate.dart';

class IceCandidateQueue {
  final List<IceCandidate> _pending = [];

  bool _remoteDescriptionSet = false;

  void add(IceCandidate candidate) {
    _pending.add(candidate);
  }

  void markRemoteDescriptionSet() {
    _remoteDescriptionSet = true;
  }

  List<IceCandidate> takePending() {
    if (!_remoteDescriptionSet) {
      return [];
    }

    final candidates = List<IceCandidate>.from(_pending);

    _pending.clear();

    return candidates;
  }

  void clear() {
    _pending.clear();
    _remoteDescriptionSet = false;
  }
}