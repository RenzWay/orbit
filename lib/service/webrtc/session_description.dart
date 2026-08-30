class SessionDescription {
  final String type;
  final String sdp;

  const SessionDescription({required this.type, required this.sdp});

  Map<String, dynamic> toMap() {
    return {"type": type, "sdp": sdp};
  }

  factory SessionDescription.fromMap(Map<dynamic, dynamic> map) {
    return SessionDescription(
      type: map['type'] as String,
      sdp: map['sdp'] as String,
    );
  }
}
