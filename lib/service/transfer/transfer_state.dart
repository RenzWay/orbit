enum TransferStatus { preparing, transfering, completed, failed, cancelled }

class TransferState {
  final String transferId;
  final String fileName;
  final int totalBytes;
  final int transferredBytes;
  final TransferStatus status;

  const TransferState({
    required this.transferId,
    required this.fileName,
    required this.totalBytes,
    required this.transferredBytes,
    required this.status,
  });

  double get progress {
    if (totalBytes <= 0) {
      return 0;
    }

    return transferredBytes / totalBytes;
  }
}
