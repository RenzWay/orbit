package com.renz.orbit.ui.viewmodel

import android.app.Application
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.widget.Toast
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.edit
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.renz.orbit.R
import com.renz.orbit.data.IncomingTransferStatus
import com.renz.orbit.data.TransferStatus
import com.renz.orbit.notification.NotificationHelper
import com.renz.orbit.service.Device
import com.renz.orbit.service.OrbitRuntime
import com.renz.orbit.service.TransferManager
import com.renz.orbit.ui.navigation.Screen
import com.renz.orbit.util.NetworkObserver
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val context = application.applicationContext
    private val prefs = application.getSharedPreferences("Settings", Context.MODE_PRIVATE)
    private val networkObserver = NetworkObserver(context)
    
    private val authStateListener = FirebaseAuth.AuthStateListener { firebaseAuth ->
        currentUser = firebaseAuth.currentUser
    }

    // Auth & Navigation
    var currentUser by mutableStateOf(FirebaseAuth.getInstance().currentUser)
    var currentScreen by mutableStateOf<Screen>(Screen.Home)

    // Theme State
    var themeSetting by mutableStateOf(prefs.getString("theme", "system") ?: "system")
        private set

    // Connectivity State
    var networkStatus by mutableStateOf(NetworkObserver.Status.Available)
        private set

    // Transfer States
    var transferStatus by mutableStateOf<TransferStatus?>(null)
    var currentTransferJob by mutableStateOf<Job?>(null)

    // Share & Send States
    var pendingShareUris by mutableStateOf<List<Uri>>(emptyList())
    var pendingSendTarget by mutableStateOf<Device?>(null)

    // Clipboard States
    var showClipboardModal by mutableStateOf(false)
    var clipboardText by mutableStateOf("")
    var clipboardTargetDevice by mutableStateOf<Device?>(null)

    // Download States (Encapsulated)
    var incomingTransfer by mutableStateOf<IncomingTransferStatus?>(null)
        private set
    var currentOutputStream: OutputStream? = null
    private var lastReportedPercent = -1

    // Dialog States
    var showNotifAccessDialog by mutableStateOf(false)

    init {
        FirebaseAuth.getInstance().addAuthStateListener(authStateListener)
        setupWebRtcHandlers()
        
        networkObserver.observe.onEach {
            networkStatus = it
        }.launchIn(viewModelScope)
    }

    override fun onCleared() {
        super.onCleared()
        FirebaseAuth.getInstance().removeAuthStateListener(authStateListener)
    }

    private fun setupWebRtcHandlers() {
        val webRtcManager = OrbitRuntime.webRtcManager
        webRtcManager.onDataReceived = { textData ->
            viewModelScope.launch {
                handleIncomingData(textData)
            }
        }
        webRtcManager.onBinaryReceived = { bytes ->
            viewModelScope.launch {
                handleIncomingBinary(bytes)
            }
        }
    }

    private fun handleIncomingData(textData: String) {
        try {
            val json = JSONObject(textData)
            when (json.getString("type")) {
                "clipboard" -> {
                    val payload = json.getString("payload")
                    val clipboard =
                        context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    val clip = ClipData.newPlainText("Orbit clipboard", payload)
                    clipboard.setPrimaryClip(clip)
                    Toast.makeText(
                        context,
                        context.getString(R.string.msg_clipboard_synced),
                        Toast.LENGTH_SHORT
                    ).show()
                }

                "file-meta" -> {
                    val fileName = json.getString("name")
                    val fileSize = json.optLong("size", 0L)
                    val notifId = NotificationHelper.newTransferId()
                    
                    lastReportedPercent = -1
                    incomingTransfer = IncomingTransferStatus(
                        fileName = fileName,
                        totalSize = fileSize,
                        notificationId = notifId
                    )
                    
                    try {
                        transferStatus = TransferStatus(fileName, 0f, false)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            val values = ContentValues().apply {
                                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                                put(
                                    MediaStore.MediaColumns.RELATIVE_PATH,
                                    Environment.DIRECTORY_DOWNLOADS
                                )
                            }
                            val fileUri = context.contentResolver.insert(
                                MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                                values
                            )
                            currentOutputStream =
                                fileUri?.let { context.contentResolver.openOutputStream(it) }
                        } else {
                            @Suppress("DEPRECATION")
                            val downloadDir =
                                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                            val file = File(downloadDir, fileName)
                            currentOutputStream = FileOutputStream(file)
                        }
                        NotificationHelper.showTransferProgress(
                            context,
                            notifId,
                            fileName,
                            0,
                            false
                        )
                    } catch (e: Exception) {
                        Log.e("MainViewModel", "Gagal siapkan download: ${e.message}")
                        NotificationHelper.showTransferResult(
                            context, notifId, fileName,
                            isSending = false,
                            success = false,
                            errorMessage = context.getString(
                                R.string.msg_download_prepared_failed,
                                e.message
                            )
                        )
                    }
                }

                "file-complete" -> {
                    val status = incomingTransfer ?: return
                    val fileName = status.fileName
                    try {
                        currentOutputStream?.flush()
                        currentOutputStream?.close()
                        currentOutputStream = null
                        NotificationHelper.showTransferResult(
                            context,
                            status.notificationId,
                            fileName,
                            isSending = false,
                            success = true
                        )
                        transferStatus = null
                    } catch (e: Exception) {
                        Log.e("MainViewModel", "Gagal finalisasi file: ${e.message}")
                        NotificationHelper.showTransferResult(
                            context,
                            status.notificationId,
                            fileName,
                            isSending = false,
                            success = false,
                            errorMessage = e.message
                        )
                    }
                    incomingTransfer = null
                }

                "file-cancel" -> {
                    val status = incomingTransfer
                    currentOutputStream = null
                    transferStatus = null
                    if (status != null) {
                        NotificationHelper.cancel(context, status.notificationId)
                    }
                    incomingTransfer = null
                    Toast.makeText(
                        context,
                        context.getString(R.string.msg_transfer_cancelled),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        } catch (e: Exception) {
            Log.e("MainViewModel", "Error parsing data: ${e.message}")
        }
    }

    private fun handleIncomingBinary(bytes: ByteArray) {
        val status = incomingTransfer ?: return
        try {
            currentOutputStream?.write(bytes)
            val newBytesReceived = status.bytesReceived + bytes.size
            if (status.totalSize > 0) {
                val percent =
                    ((newBytesReceived * 100) / status.totalSize).toInt()
                        .coerceIn(0, 100)
                
                incomingTransfer = status.copy(
                    bytesReceived = newBytesReceived,
                    percent = percent
                )

                if (percent != lastReportedPercent) {
                    lastReportedPercent = percent
                    NotificationHelper.showTransferProgress(
                        context,
                        status.notificationId,
                        status.fileName,
                        percent,
                        false
                    )
                    transferStatus =
                        TransferStatus(status.fileName, percent / 100f, false)
                }
            } else {
                incomingTransfer = status.copy(bytesReceived = newBytesReceived)
            }
        } catch (e: Exception) {
            Log.e("MainViewModel", "Gagal tulis file: ${e.message}")
        }
    }

    fun sendFiles(device: Device, uris: List<Uri>) {
        currentTransferJob = viewModelScope.launch {
            TransferManager.sendFilesToDevice(
                context,
                device,
                uris,
                onProgress = { transferStatus = it })
            currentTransferJob = null
        }
    }

    fun cancelTransfer() {
        currentTransferJob?.cancel()
        currentTransferJob = null
        transferStatus = null

        viewModelScope.launch {
            val cancelMsg = JSONObject().apply { put("type", "file-cancel") }
            OrbitRuntime.webRtcManager.sendData(cancelMsg.toString())
        }
    }

    fun sendClipboard(device: Device, text: String) {
        showClipboardModal = false
        if (text.isNotEmpty()) {
            viewModelScope.launch {
                TransferManager.sendClipboardToDevice(context, device, text)
            }
        }
    }

    fun clearPendingShare() {
        pendingShareUris = emptyList()
    }

    fun updateTheme(newTheme: String) {
        themeSetting = newTheme
        prefs.edit { putString("theme", newTheme) }
    }
}
