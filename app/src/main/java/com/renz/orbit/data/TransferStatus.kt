package com.renz.orbit.data

data class TransferStatus(
    val fileName: String,
    val progress: Float,
    val isSending: Boolean
)