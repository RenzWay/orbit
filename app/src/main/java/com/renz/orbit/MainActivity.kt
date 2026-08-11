package com.renz.orbit

import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.google.firebase.auth.FirebaseAuth
import com.renz.orbit.service.AuthManager
import com.renz.orbit.service.Device
import com.renz.orbit.service.OrbitConnectionService
import com.renz.orbit.service.OrbitRuntime
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

                LaunchedEffect(currentUser) {
                    if (currentUser != null) {
                        OrbitConnectionService.start(context)
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
                                        val clip =
                                            ClipData.newPlainText("Orbit clipboard", payload)
                                        clipboard.setPrimaryClip(clip)
                                        Toast.makeText(
                                            context,
                                            "Clipboard tersinkron dari pc",
                                            Toast.LENGTH_SHORT
                                        ).show()
                                    }

                                    "file-meta" -> {
                                        val fileName = json.getString("name")
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
                                            Toast.makeText(
                                                context,
                                                "Menerima: $fileName",
                                                Toast.LENGTH_SHORT
                                            ).show()
                                        } catch (e: Exception) {
                                            Log.e(
                                                "MainActivity",
                                                "Gagal siapkan download: ${e.message}"
                                            )
                                        }
                                    }

                                    "file-complete" -> {
                                        currentOutputStream?.flush()
                                        currentOutputStream?.close()
                                        currentOutputStream = null
                                        Toast.makeText(
                                            context,
                                            "Selesai: $currentDownloadName",
                                            Toast.LENGTH_SHORT
                                        ).show()
                                        currentDownloadName = null
                                        webRtcManager.closeConnection()
                                        OrbitRuntime.setActiveConnection(null)
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
                                Log.d("MainActivity", "Menulis ${bytes.size} bytes ke file")
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
                        val webRtcManager = OrbitRuntime.webRtcManager
                        try {
                            // ON-DEMAND: cuma bikin koneksi baru kalau emang
                            // belum ada koneksi yang OPEN ke device ini.
                            // Kalau device ini yang barusan connect ke kita
                            // duluan (lewat listenForIncomingCalls di
                            // Service), koneksinya udah OPEN -> langsung
                            // kirim tanpa nego ulang.
                            if (!webRtcManager.isDataChannelOpen()) {
                                Toast.makeText(context, "Menyambungkan...", Toast.LENGTH_SHORT)
                                    .show()
                                OrbitRuntime.setActiveConnection(targetDevice.id)
                                webRtcManager.createPeerConnection(
                                    targetDeviceId = targetDevice.id,
                                    myDeviceId = OrbitRuntime.orbitPresence.deviceId,
                                    isInitiator = true
                                )
                                val connected = webRtcManager.awaitDataChannelOpen()
                                if (!connected) {
                                    Toast.makeText(
                                        context,
                                        "Gagal konek ke ${targetDevice.deviceName}",
                                        Toast.LENGTH_LONG
                                    ).show()
                                    return@launch
                                }
                            }

                            val cursor =
                                context.contentResolver.query(uri, null, null, null, null)
                            val nameIndex =
                                cursor?.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME)
                            cursor?.moveToFirst()
                            val fileName = nameIndex?.let { i -> cursor.getString(i) }
                                ?: "file_${System.currentTimeMillis()}"
                            cursor?.close()

                            val meta = JSONObject().apply {
                                put("type", "file-meta")
                                put("name", fileName)
                            }
                            webRtcManager.sendData(meta.toString())

                            context.contentResolver.openInputStream(uri)?.use { inputStream ->
                                val buffer = ByteArray(16384)
                                var bytesRead: Int
                                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                                    val chunk =
                                        if (bytesRead == buffer.size) buffer else buffer.copyOf(
                                            bytesRead
                                        )
                                    webRtcManager.sendBinary(chunk)
                                }
                            }

                            val complete = JSONObject().apply { put("type", "file-complete") }
                            webRtcManager.sendData(complete.toString())

                            Toast.makeText(
                                context,
                                "File '$fileName' terkirim!",
                                Toast.LENGTH_SHORT
                            ).show()

                            webRtcManager.closeConnection()
                            OrbitRuntime.setActiveConnection(null)
                        } catch (e: Exception) {
                            Log.e("MainActivity", "Gagal kirim file: ${e.message}")
                            webRtcManager.closeConnection()
                            OrbitRuntime.setActiveConnection(null)
                        }
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

                val isOrbitActive =
                    otherDevices.any { device -> device.status.lowercase() == "online" }

                if (currentUser == null) {
                    LoginPage(
                        onLoginClick = {
                            googleSignInLauncher.launch(
                                authManager.getGoogleSignInClient().signInIntent
                            )
                        }
                    )
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
                            val clipboard =
                                getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
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
                                        sendClipboardToDevice(context, targetDevice, clipboardText)
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
                                                            sendFilesToDevice(context, device, uris)
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
                                Surface(
                                    modifier = Modifier.clickable {
                                        pendingShareUris = emptyList()
                                    }
                                ) { Text("Batal", modifier = Modifier.padding(8.dp)) }
                            }
                        )
                    }

                }
            }
        }
    }


    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
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
                onSucess = {
                    Toast.makeText(this, "Login Berhasil!", Toast.LENGTH_SHORT).show()
                },
                onError = { e ->
                    Toast.makeText(this, "Login Gagal: ${e.message}", Toast.LENGTH_LONG).show()
                },
            )
        }
    }
}

private suspend fun sendFilesToDevice(context: Context, targetDevice: Device, uris: List<Uri>) {
    val webRtcManager = OrbitRuntime.webRtcManager
    try {
        if (!webRtcManager.isDataChannelOpen()) {
            Toast.makeText(
                context,
                "Menyambungkan ke ${targetDevice.deviceName}...",
                Toast.LENGTH_SHORT
            )
                .show()
            OrbitRuntime.setActiveConnection(targetDevice.id)
            webRtcManager.createPeerConnection(
                targetDeviceId = targetDevice.id,
                myDeviceId = OrbitRuntime.orbitPresence.deviceId,
                isInitiator = true
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

        for (uri in uris) {
            val cursor = context.contentResolver.query(uri, null, null, null, null)
            val nameIndex = cursor?.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME)
            cursor?.moveToFirst()
            val fileName = nameIndex?.let { i -> cursor.getString(i) }
                ?: "file_${System.currentTimeMillis()}"
            cursor?.close()

            val meta = JSONObject().apply {
                put("type", "file-meta")
                put("name", fileName)
            }
            webRtcManager.sendData(meta.toString())

            context.contentResolver.openInputStream(uri)?.use { inputStream ->
                val buffer = ByteArray(16384)
                var bytesRead: Int
                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    val chunk =
                        if (bytesRead == buffer.size) buffer else buffer.copyOf(bytesRead)
                    webRtcManager.sendBinary(chunk)
                }
            }

            val complete = JSONObject().apply { put("type", "file-complete") }
            webRtcManager.sendData(complete.toString())

            Toast.makeText(context, "'$fileName' terkirim!", Toast.LENGTH_SHORT).show()
        }

        webRtcManager.closeConnection()
        OrbitRuntime.setActiveConnection(null)
    } catch (e: Exception) {
        Log.e("MainActivity", "Gagal kirim file: ${e.message}")
        webRtcManager.closeConnection()
        OrbitRuntime.setActiveConnection(null)
    }
}

private suspend fun sendClipboardToDevice(context: Context, targetDevice: Device, text: String) {
    val webRtcManager = OrbitRuntime.webRtcManager
    try {
        if (!webRtcManager.isDataChannelOpen()) {
            OrbitRuntime.setActiveConnection(targetDevice.id)
            webRtcManager.createPeerConnection(
                targetDeviceId = targetDevice.id,
                myDeviceId = OrbitRuntime.orbitPresence.deviceId,
                isInitiator = true
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
        webRtcManager.closeConnection()
        OrbitRuntime.setActiveConnection(null)
    } catch (e: Exception) {
        Log.e("MainActivity", "Gagal kirim clipboard: ${e.message}")
        webRtcManager.closeConnection()
        OrbitRuntime.setActiveConnection(null)
    }
}
