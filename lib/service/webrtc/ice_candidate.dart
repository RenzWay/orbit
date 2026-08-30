class IceCandidate {
  final String candidate;
  final String? sdpMid;
  final int? sdpMLineIndex;

  const IceCandidate({
    required this.candidate,
    this.sdpMid,
    this.sdpMLineIndex,
  });

  Map<String, dynamic> toMap() {
    return {
      'candidate': candidate,
      'sdpMid': sdpMid,
      'sdpMLineIndex': sdpMLineIndex,
    };
  }

  factory IceCandidate.fromMap(Map<dynamic, dynamic> map) {
    return IceCandidate(
      candidate: map['candidate'] as String,
      sdpMid: map['sdpMid'] as String?,
      sdpMLineIndex: map['sdpMLineIndex'] as int?,
    );
  }
}
