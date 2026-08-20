package com.renz.orbit

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.google.firebase.auth.FirebaseAuth
import com.renz.orbit.notification.NotificationHelper
import com.renz.orbit.service.AuthManager
import com.renz.orbit.service.Device
import com.renz.orbit.service.OrbitConnectionService
import com.renz.orbit.service.OrbitRuntime
import com.renz.orbit.service.TransferManager
import com.renz.orbit.ui.components.ClipboardModal
import com.renz.orbit.ui.screen.HomeScreen
import com.renz.orbit.ui.screen.LoginPage
import com.renz.orbit.ui.theme.OrbitTheme
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream

class MainActivity : ComponentActivity() {
    private lateinit var authManager: AuthManager
    private var pendingShareUrisState: ((List<Uri>) -> Unit)? = null

    private fun extractShareUris(intent: Intent?): List<Uri> {
        if (intent == null) return emptyList()
        return when (intent.action) {
            Intent.ACTION_SEND -> {
                val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
                }
                if (uri != null) listOf(uri) else emptyList()
            }

            Intent.ACTION_SEND_MULTIPLE -> {
                val uris = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
                }
                uris ?: emptyList()
            }

            else -> emptyList()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        OrbitRuntime.init(this)
        authManager = AuthManager(this)
        val initialShareUris = extractShareUris(intent)
        handleIntent(intent)
        setContent {
            OrbitTheme {
                val context = LocalContext.current
                val scope = rememberCoroutineScope()
                var currentUser by remember { mutableStateOf(FirebaseAuth.getInstance().currentUser) }
                val otherDevices by OrbitRuntime.devices.collectAsState()
                var showClipboardModal by remember { mutableStateOf(false) }
                var clipboardText by remember { mutableStateOf("") }
                var clipboardTargetDevice by remember { mutableStateOf<Device?>(null) }
                var currentDownloadName by remember { mutableStateOf<String?>(null) }
                var currentOutputStream by remember { mutableStateOf<OutputStream?>(null) }
                var currentDownloadTotalSize by remember { mutableLongStateOf(0L) }
                var currentDownloadBytesReceived by remember { mutableLongStateOf(0L) }
                var currentDownloadNotifId by remember { mutableIntStateOf(0) }
                var lastReportedPercent by remember { mutableIntStateOf(-1) }
                var pendingSendTarget by remember { mutableStateOf<Device?>(null) }
                var pendingShareUris by remember { mutableStateOf(initialShareUris) }

                pendingShareUrisState = { uris -> pendingShareUris = uris }

                DisposableEffect(Unit) {
                    val authStateListener = FirebaseAuth.AuthStateListener { firebaseAuth ->
                        currentUser = firebaseAuth.currentUser
                    }
                    FirebaseAuth.getInstance().addAuthStateListener(authStateListener)
                    onDispose {
                        FirebaseAuth.getInstance().removeAuthStateListener(authStateListener)
                    }
                }
                val notificationPermissionLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.RequestPermission()
                ) { }
                LaunchedEffect(currentUser) {
                    if (currentUser != null) {
                        OrbitConnectionService.start(context)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            val alreadyGranted = ContextCompat.checkSelfPermission(
                                context, Manifest.permission.POST_NOTIFICATIONS
                            ) == PackageManager.PERMISSION_GRANTED
                            if (!alreadyGranted) {
                                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                            }
                        }
                    }
                }
                LaunchedEffect(Unit) {
                    val webRtcManager = OrbitRuntime.webRtcManager
                    webRtcManager.onDataReceived = { textData: String ->
                        scope.launch {
                            try {
                                val json = JSONObject(textData)
                                when (json.getString("type")) {
                                    "clipboard" -> {
                                        val payload = json.getString("payload")
                                        val clipboard =
                                            getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
                                        val clip = ClipData.newPlainText("Orbit clipboard", payload)
                                        clipboard.setPrimaryClip(clip)
                                        Toast.makeText(
                                            context,
                                            "Clipboard tersinkron dari pc",
                                            Toast.LENGTH_SHORT
                                        ).show()
                                    }

                                    "file-meta" -> {
                                        val fileName = json.getString("name")
                                        val fileSize = json.optLong("size", 0L)
                                        currentDownloadTotalSize = fileSize
                                        currentDownloadBytesReceived = 0L
                                        lastReportedPercent = -1
                                        currentDownloadNotifId = NotificationHelper.newTransferId()
                                        try {
                                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                                val values = ContentValues().apply {
                                                    put(
                                                        MediaStore.MediaColumns.DISPLAY_NAME,
                                                        fileName
                                                    )
                                                    put(
                                                        MediaStore.MediaColumns.RELATIVE_PATH,
                                                        Environment.DIRECTORY_DOWNLOADS
                                                    )
                                                }
                                                val fileUri = context.contentResolver.insert(
                                                    MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                                                    values
                                                )
                                                currentOutputStream = fileUri?.let {
                                                    context.contentResolver.openOutputStream(it)
                                                }
                                            } else {
                                                @Suppress("DEPRECATION")
                                                val downloadDir =
                                                    Environment.getExternalStoragePublicDirectory(
                                                        Environment.DIRECTORY_DOWNLOADS
                                                    )
                                                val file = File(downloadDir, fileName)
                                                currentOutputStream = FileOutputStream(file)
                                            }
                                            currentDownloadName = fileName
                                            NotificationHelper.showTransferProgress(
                                                context,
                                                currentDownloadNotifId,
                                                fileName,
                                                0,
                                                false
                                            )
                                        } catch (e: Exception) {
                                            Log.e(
                                                "MainActivity",
                                                "Gagal siapkan download: ${e.message}"
                                            )
                                            NotificationHelper.showTransferResult(
                                                context,
                                                currentDownloadNotifId,
                                                fileName,
                                                isSending = false,
                                                success = false,
                                                errorMessage = "Gagal menyiapkan file: ${e.message}"
                                            )
                                        }
                                    }

                                    "file-complete" -> {
                                        val fileName = currentDownloadName ?: "file"
                                        try {
                                            currentOutputStream?.flush()
                                            currentOutputStream?.close()
                                            currentOutputStream = null
                                            NotificationHelper.showTransferResult(
                                                context,
                                                currentDownloadNotifId,
                                                fileName,
                                                isSending = false,
                                                success = true
                                            )
                                        } catch (e: Exception) {
                                            Log.e(
                                                "MainActivity",
                                                "Gagal finalisasi file: ${e.message}"
                                            )
                                            NotificationHelper.showTransferResult(
                                                context,
                                                currentDownloadNotifId,
                                                fileName,
                                                isSending = false,
                                                success = false,
                                                errorMessage = e.message
                                            )
                                        }
                                        currentDownloadName = null
                                    }
                                }
                            } catch (e: Exception) {
                                Log.e("MainActivity", "Error parsing data: ${e.message}")
                            }
                        }
                    }
                    webRtcManager.onBinaryReceived = { bytes ->
                        scope.launch {
                            try {
                                currentOutputStream?.write(bytes)
                                currentDownloadBytesReceived += bytes.size
                                if (currentDownloadTotalSize > 0) {
                                    val percent =
                                        ((currentDownloadBytesReceived * 100) / currentDownloadTotalSize).toInt()
                                            .coerceIn(0, 100)
                                    if (percent != lastReportedPercent) {
                                        lastReportedPercent = percent
                                        NotificationHelper.showTransferProgress(
                                            context,
                                            currentDownloadNotifId,
                                            currentDownloadName ?: "file",
                                            percent,
                                            false
                                        )
                                    }
                                }
                            } catch (e: Exception) {
                                Log.e("MainActivity", "Gagal tulis file: ${e.message}")
                            }
                        }
                    }
                }
                val filePickerLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.GetContent()
                ) { uri: Uri? ->
                    val targetDevice = pendingSendTarget
                    if (uri == null || targetDevice == null) return@rememberLauncherForActivityResult
                    scope.launch {
                        TransferManager.sendFilesToDevice(context, targetDevice, listOf(uri))
                    }
                }
                val googleSignInLauncher =
                    rememberLauncherForActivityResult(contract = ActivityResultContracts.StartActivityForResult()) { result ->
                        scope.launch {
                            try {
                                authManager.firebaseAuthWithGoogleSignInResult(result.data)
                                Toast.makeText(context, "Login Berhasil!", Toast.LENGTH_SHORT)
                                    .show()
                            } catch (e: Exception) {
                                Log.e("MainActivity", "Login Google gagal: ${e.message}")
                                Toast.makeText(
                                    context,
                                    "Login gagal: ${e.message}",
                                    Toast.LENGTH_LONG
                                ).show()
                            }
                        }
                    }
                val isOrbitActive = otherDevices.any { it.status.lowercase() == "online" }
                if (currentUser == null) {
                    LoginPage(onLoginClick = { googleSignInLauncher.launch(authManager.getGoogleSignInClient().signInIntent) })
                } else {
                    HomeScreen(
                        devices = otherDevices,
                        isOrbitActive = isOrbitActive,
                        onSendFile = { device ->
                            pendingSendTarget = device
                            filePickerLauncher.launch("*/*")
                        },
                        onSyncClipboard = { device ->
                            clipboardTargetDevice = device
                            val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
                            val clipData = clipboard.primaryClip
                            if (clipData != null && clipData.itemCount > 0) {
                                clipboardText = clipData.getItemAt(0).text?.toString() ?: ""
                            }
                            showClipboardModal = true
                        },
                        onUnsyncDevice = { device ->
                            OrbitRuntime.orbitPresence.removeDevice(device.id)
                            if (OrbitRuntime.activeConnectionDeviceId.value == device.id) {
                                OrbitRuntime.webRtcManager.closeConnection()
                                OrbitRuntime.setActiveConnection(null)
                            }
                        },
                        modifier = Modifier
                    )
                    if (showClipboardModal) {
                        ClipboardModal(
                            clipboardText = clipboardText,
                            onTextChange = { clipboardText = it },
                            onSend = {
                                val targetDevice = clipboardTargetDevice
                                showClipboardModal = false
                                if (clipboardText.isNotEmpty() && targetDevice != null) {
                                    scope.launch {
                                        TransferManager.sendClipboardToDevice(
                                            context,
                                            targetDevice,
                                            clipboardText
                                        )
                                    }
                                }
                            },
                            onDismiss = { showClipboardModal = false }
                        )
                    }
                    if (pendingShareUris.isNotEmpty()) {
                        val onlineDevices =
                            otherDevices.filter { it.status.lowercase() == "online" }
                        AlertDialog(
                            onDismissRequest = { pendingShareUris = emptyList() },
                            title = { Text("Upload to device?") },
                            text = {
                                Column {
                                    if (onlineDevices.isEmpty()) {
                                        Text("Ga ada device yang online sekarang. Buka Orbit di device tujuan dulu.")
                                    } else {
                                        onlineDevices.forEach { device ->
                                            Surface(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .clickable {
                                                        val uris = pendingShareUris
                                                        pendingShareUris = emptyList()
                                                        scope.launch {
                                                            TransferManager.sendFilesToDevice(
                                                                context,
                                                                device,
                                                                uris
                                                            )
                                                        }
                                                    }
                                                    .padding(vertical = 12.dp)
                                            ) {
                                                Text(device.deviceName)
                                            }
                                        }
                                    }
                                }
                            },
                            confirmButton = {},
                            dismissButton = {
                                Surface(modifier = Modifier.clickable {
                                    pendingShareUris = emptyList()
                                }) {
                                    Text("Batal", modifier = Modifier.padding(8.dp))
                                }
                            }
                        )
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        if (intent == null) return
        val shareUris = extractShareUris(intent)
        if (shareUris.isNotEmpty()) {
            pendingShareUrisState?.invoke(shareUris)
            return
        }
        intent.data?.let { uri ->
            authManager.handleDeepLinkIntent(
                uri = uri,
                onSuccess = { Toast.makeText(this, "Login Berhasil!", Toast.LENGTH_SHORT).show() },
                onError = { e ->
                    Toast.makeText(
                        this,
                        "Login Gagal: ${e.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            )
        }
    }
}