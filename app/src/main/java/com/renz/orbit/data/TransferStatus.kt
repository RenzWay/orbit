package com.renz.orbit.data

data class TransferStatus(
    val fileName: String,
    val progress: Float,
    val isSending: Boolean
)

data class IncomingTransferStatus(
    val fileName: String,
    val totalSize: Long,
    val bytesReceived: Long = 0L,
    val notificationId: Int,
    val percent: Int = 0
)
