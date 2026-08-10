package com.renz.orbit

import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.google.firebase.auth.FirebaseAuth
import com.renz.orbit.service.AuthManager
import com.renz.orbit.service.Device
import com.renz.orbit.service.OrbitPresence
import com.renz.orbit.service.WebRtcManager
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
    private lateinit var orbitPresence: OrbitPresence

    private fun getRealDeviceName(): String {
        val manufacturer = Build.MANUFACTURER
        val model = Build.MODEL

        return if (model.lowercase().startsWith(manufacturer.lowercase())) {
            model.replaceFirstChar { it.uppercase() }
        } else {
            "${manufacturer.replaceFirstChar { it.uppercase() }} $model"
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        authManager = AuthManager(this)
        orbitPresence = OrbitPresence(this)

        handleIntent(intent)

        setContent {
            OrbitTheme {
                val context = LocalContext.current
                val scope = rememberCoroutineScope()
                var currentUser by remember { mutableStateOf(FirebaseAuth.getInstance().currentUser) }
                var otherDevices by remember { mutableStateOf<List<Device>>(emptyList()) }

                var showClipboardModal by remember { mutableStateOf(false) }
                var clipboardText by remember { mutableStateOf("") }

                val webRtcManager = remember { WebRtcManager(context) }
                var isConnectedToPeer by remember { mutableStateOf(false) }
                var connectedToDeviceId by remember { mutableStateOf<String?>(null) }

                var currentDownloadName by remember { mutableStateOf<String?>(null) }
                var currentOutputStream by remember { mutableStateOf<OutputStream?>(null) }

                DisposableEffect(Unit) {
                    val authStateListener = FirebaseAuth.AuthStateListener { firebaseAuth ->
                        currentUser = firebaseAuth.currentUser
                    }
                    FirebaseAuth.getInstance().addAuthStateListener(authStateListener)
                    onDispose {
                        webRtcManager.close()
                    }
                }

                val filePickerLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.GetContent()
                ) { uri: Uri? ->
                    uri?.let {
                        scope.launch {
                            try {
                                val cursor =
                                    context.contentResolver.query(it, null, null, null, null)
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

                                context.contentResolver.openInputStream(it)?.use { inputStream ->
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
                            } catch (e: Exception) {
                                Log.e("MainActivity", "Gagal kirim file: ${e.message}")
                            }
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

                LaunchedEffect(Unit) {
                    webRtcManager.onConnectionStateChanged = { connected: Boolean ->
                        scope.launch {
                            isConnectedToPeer = connected
                        }
                    }

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

                LaunchedEffect(currentUser) {
                    if (currentUser != null) {
                        orbitPresence.setDeviceOnline(getRealDeviceName())
                        orbitPresence.listenToOtherDevices { devices ->
                            otherDevices = devices

                            val pcDevice = devices.firstOrNull { it.status.lowercase() == "online" }
                            if (pcDevice != null && pcDevice.id != connectedToDeviceId) {
                                connectedToDeviceId = pcDevice.id
                                webRtcManager.createPeerConnection(
                                    targetDeviceId = pcDevice.id,
                                    myDeviceId = orbitPresence.deviceId,
                                    isInitiator = false
                                )
                            } else if (pcDevice == null) {
                                connectedToDeviceId = null
                            }
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
                        onSendFile = {
                            filePickerLauncher.launch("*/*")
                        },
                        onSyncClipboard = {
                            val clipboard =
                                getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
                            val clipData = clipboard.primaryClip
                            if (clipData != null && clipData.itemCount > 0) {
                                clipboardText = clipData.getItemAt(0).text?.toString() ?: ""
                            }
                            showClipboardModal = true
                        },
                        onUnsyncDevice = { device ->
                            orbitPresence.removeDevice(device.id)
                            if (connectedToDeviceId == device.id) {
                                connectedToDeviceId = null
                            }
                        },
                        modifier = Modifier
                    )

                    if (showClipboardModal) {
                        ClipboardModal(
                            clipboardText = clipboardText,
                            onTextChange = { clipboardText = it },
                            onSend = {
                                if (clipboardText.isNotEmpty()) {
                                    webRtcManager.sendClipboard(clipboardText)
                                    Toast.makeText(
                                        context,
                                        "Clipboard terkirim ke PC!",
                                        Toast.LENGTH_SHORT
                                    ).show()
                                }
                                showClipboardModal = false
                            },
                            onDismiss = { showClipboardModal = false }
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
        intent?.data?.let { uri ->
            authManager.handleDeepLinkIntent(
                uri = uri,
                onSucess = {
                    Toast.makeText(this, "Login Berhasil!", Toast.LENGTH_SHORT).show()
                    //recreate()
                },
                onError = { e ->
                    Toast.makeText(this, "Login Gagal: ${e.message}", Toast.LENGTH_LONG).show()
                },
            )
        }
    }
}
