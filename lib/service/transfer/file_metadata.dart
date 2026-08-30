class FileMetadata {
  final String transferId;
  final String fileName;
  final int fileSize;
  final String mimeType;

  const FileMetadata({
    required this.transferId,
    required this.fileName,
    required this.fileSize,
    required this.mimeType,
  });

  Map<String, dynamic> toMap() {
    return {
      'type': 'file_start',
      'transferId': transferId,
      'fileName': fileName,
      'fileSize': fileSize,
      'mimeType': mimeType,
    };
  }

  factory FileMetadata.fromMap(Map<String, dynamic> map) {
    return FileMetadata(
      transferId: map['transferId'] as String,
      fileName: map['fileName'] as String,
      fileSize: map['fileSize'] as int,
      mimeType: map['mimeType'] as String,
    );
  }
}
