package com.renz.orbit.service

import android.content.Context
import android.net.Uri
import android.provider.MediaStore
import android.util.Log
import android.widget.Toast
import com.renz.orbit.data.TransferStatus
import com.renz.orbit.notification.NotificationHelper
import org.json.JSONObject
import kotlin.time.Duration.Companion.milliseconds

/**
 * Orchestrates file and clipboard transfers without owning the WebRTC connection.
 *
 * [OrbitRuntime] remains the single source of truth for the active connection.
 * This object only keeps transfer-specific I/O and notification logic out of the UI.
 */
object TransferManager {

    suspend fun sendFilesToDevice(
        context: Context,
        targetDevice: Device,
        uris: List<Uri>,
        onProgress: (TransferStatus?) -> Unit = {}
    ) {
        val webRtcManager = OrbitRuntime.webRtcManager
        val connectNotifId = NotificationHelper.newTransferId()
        try {
            if (!webRtcManager.isDataChannelOpen()) {
                Toast.makeText(
                    context,
                    "Menyambungkan ke ${targetDevice.deviceName}...",
                    Toast.LENGTH_SHORT
                ).show()
                OrbitRuntime.setActiveConnection(targetDevice.id)
                webRtcManager.createPeerConnection(
                    targetDevice.id,
                    OrbitRuntime.orbitPresence.deviceId,
                    true
                )
                val connected = webRtcManager.awaitDataChannelOpen()
                if (!connected) {
                    NotificationHelper.showTransferResult(
                        context,
                        connectNotifId,
                        if (uris.size == 1) "file" else "${uris.size} file",
                        isSending = true,
                        success = false,
                        errorMessage = "Gagal konek ke ${targetDevice.deviceName}"
                    )
                    OrbitRuntime.setActiveConnection(null)
                    return
                }
            }
            for (uri in uris) {
                val notifId = NotificationHelper.newTransferId()
                var fileName = "file_${System.currentTimeMillis()}"
                var fileSize = 0L
                try {
                    val cursor = context.contentResolver.query(uri, null, null, null, null)
                    cursor?.use {
                        val nameIndex = it.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME)
                        val sizeIndex = it.getColumnIndex(MediaStore.MediaColumns.SIZE)
                        if (it.moveToFirst()) {
                            if (nameIndex >= 0) fileName = it.getString(nameIndex) ?: fileName
                            if (sizeIndex >= 0) fileSize = it.getLong(sizeIndex)
                        }
                    }
                    val meta = JSONObject().apply {
                        put("type", "file-meta")
                        put("name", fileName)
                        put("size", fileSize)
                    }
                    webRtcManager.sendData(meta.toString())
                    NotificationHelper.showTransferProgress(context, notifId, fileName, 0, true)
                    onProgress(TransferStatus(fileName, 0f, true))

                    var bytesSent = 0L
                    var lastReportedPercent = -1
                    context.contentResolver.openInputStream(uri)?.use { inputStream ->
                        val buffer = ByteArray(16384)
                        var bytesRead: Int
                        while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                            val chunk =
                                if (bytesRead == buffer.size) buffer else buffer.copyOf(bytesRead)
                            webRtcManager.sendBinary(chunk)
                            bytesSent += bytesRead

                            while (webRtcManager.getBufferedAmount() > 256 * 1024) {
                                kotlinx.coroutines.delay(10.milliseconds)
                            }

                            if (fileSize > 0) {
                                val progress = bytesSent.toFloat() / fileSize.toFloat()
                                val percent = (progress * 100).toInt().coerceIn(0, 100)
                                if (percent != lastReportedPercent) {
                                    lastReportedPercent = percent
                                    NotificationHelper.showTransferProgress(
                                        context,
                                        notifId,
                                        fileName,
                                        percent,
                                        true
                                    )
                                    onProgress(TransferStatus(fileName, progress, true))
                                }
                            }
                        }
                    }
                    val complete = JSONObject().apply { put("type", "file-complete") }
                    webRtcManager.sendData(complete.toString())
                    NotificationHelper.showTransferResult(
                        context, notifId, fileName,
                        isSending = true,
                        success = true
                    )
                } catch (e: Exception) {
                    Log.e("TransferManager", "Gagal kirim '$fileName': ${e.message}")
                    NotificationHelper.showTransferResult(
                        context,
                        notifId,
                        fileName,
                        isSending = true,
                        success = false,
                        errorMessage = e.message
                    )
                }
            }
            webRtcManager.awaitBufferedAmountDrained()
            onProgress(null)
        } catch (e: Exception) {
            Log.e("TransferManager", "Gagal kirim file: ${e.message}")
            webRtcManager.closeConnection()
            OrbitRuntime.setActiveConnection(null)
            onProgress(null)
        }
    }

    suspend fun sendClipboardToDevice(context: Context, targetDevice: Device, text: String) {
        val webRtcManager = OrbitRuntime.webRtcManager
        try {
            if (!webRtcManager.isDataChannelOpen()) {
                OrbitRuntime.setActiveConnection(targetDevice.id)
                webRtcManager.createPeerConnection(
                    targetDevice.id,
                    OrbitRuntime.orbitPresence.deviceId,
                    true
                )
                val connected = webRtcManager.awaitDataChannelOpen()
                if (!connected) {
                    Toast.makeText(
                        context,
                        "Gagal konek ke ${targetDevice.deviceName}",
                        Toast.LENGTH_LONG
                    ).show()
                    OrbitRuntime.setActiveConnection(null)
                    return
                }
            }
            webRtcManager.sendClipboard(text)
            Toast.makeText(context, "Clipboard terkirim!", Toast.LENGTH_SHORT).show()
            webRtcManager.awaitBufferedAmountDrained()
        } catch (e: Exception) {
            Log.e("TransferManager", "Gagal kirim clipboard: ${e.message}")
            webRtcManager.closeConnection()
            OrbitRuntime.setActiveConnection(null)
        }
    }
}
