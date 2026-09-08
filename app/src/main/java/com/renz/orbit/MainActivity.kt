package com.renz.orbit

import android.Manifest
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.viewmodel.compose.viewModel
import com.renz.orbit.notification.NotificationHelper
import com.renz.orbit.service.AuthManager
import com.renz.orbit.service.OrbitConnectionService
import com.renz.orbit.service.OrbitRuntime
import com.renz.orbit.ui.components.ClipboardModal
import com.renz.orbit.ui.components.NotificationAccessDialog
import com.renz.orbit.ui.components.ShareSheetDialog
import com.renz.orbit.ui.navigation.Screen
import com.renz.orbit.ui.screen.HomeScreen
import com.renz.orbit.ui.screen.LoginPage
import com.renz.orbit.ui.screen.ProfileScreen
import com.renz.orbit.ui.screen.SettingScreen
import com.renz.orbit.ui.theme.OrbitTheme
import com.renz.orbit.ui.viewmodel.MainViewModel
import kotlinx.coroutines.launch
import java.util.Locale

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
        installSplashScreen()
        super.onCreate(savedInstanceState)

        updateLocale()

        OrbitRuntime.init(this)
        authManager = AuthManager(this)
        val initialShareUris = extractShareUris(intent)
        handleIntent(intent)

        setContent {
            val viewModel: MainViewModel = viewModel()

            val isdark = when (viewModel.themeSetting) {
                "dark" -> true
                "light" -> false
                else -> isSystemInDarkTheme()
            }

            // Sync initial share URIs with ViewModel
            LaunchedEffect(initialShareUris) {
                if (initialShareUris.isNotEmpty()) {
                    viewModel.pendingShareUris = initialShareUris
                }
            }

            OrbitTheme(darkTheme = isdark) {
                val context = LocalContext.current
                val scope = rememberCoroutineScope()
                val otherDevices by OrbitRuntime.devices.collectAsState()
                val isInitialLoading by OrbitRuntime.isInitialLoading.collectAsState()

                pendingShareUrisState = { uris -> viewModel.pendingShareUris = uris }

                val notificationPermissionLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.RequestPermission()
                ) { }

                LaunchedEffect(viewModel.currentUser) {
                    val user = viewModel.currentUser
                    if (user != null) {
                        OrbitConnectionService.start(context)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            val alreadyGranted = ContextCompat.checkSelfPermission(
                                context, Manifest.permission.POST_NOTIFICATIONS
                            ) == PackageManager.PERMISSION_GRANTED
                            if (!alreadyGranted) {
                                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                            }
                        }
                        if (!NotificationHelper.isNotificationListenerEnabled(context)) {
                            viewModel.showNotifAccessDialog = true
                        }
                    }
                }

                val filePickerLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.GetContent()
                ) { uri: Uri? ->
                    val targetDevice = viewModel.pendingSendTarget
                    if (uri != null && targetDevice != null) {
                        viewModel.sendFiles(targetDevice, listOf(uri))
                    }
                }

                val googleSignInLauncher =
                    rememberLauncherForActivityResult(contract = ActivityResultContracts.StartActivityForResult()) { result ->
                        scope.launch {
                            try {
                                authManager.firebaseAuthWithGoogleSignInResult(result.data)
                                Toast.makeText(
                                    context,
                                    getString(R.string.msg_login_success),
                                    Toast.LENGTH_SHORT
                                ).show()
                            } catch (e: Exception) {
                                Log.e("MainActivity", "Login Google gagal: ${e.message}")
                                Toast.makeText(
                                    context,
                                    getString(R.string.msg_login_failed, e.message),
                                    Toast.LENGTH_LONG
                                ).show()
                            }
                        }
                    }

                val isOrbitActive = otherDevices.any { it.status.lowercase() == "online" }

                if (viewModel.currentUser == null) {
                    LoginPage(onLoginClick = { googleSignInLauncher.launch(authManager.getGoogleSignInClient().signInIntent) })
                } else {
                    when (viewModel.currentScreen) {
                        is Screen.Home ->
                            HomeScreen(
                                devices = otherDevices,
                                isInitialLoading = isInitialLoading,
                                isOrbitActive = isOrbitActive,
                                onSendFile = { device ->
                                    viewModel.pendingSendTarget = device
                                    filePickerLauncher.launch("*/*")
                                },
                                onSyncClipboard = { device ->
                                    viewModel.clipboardTargetDevice = device
                                    val clipboard =
                                        getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
                                    val clipData = clipboard.primaryClip
                                    if (clipData != null && clipData.itemCount > 0) {
                                        viewModel.clipboardText =
                                            clipData.getItemAt(0).text?.toString() ?: ""
                                    }
                                    viewModel.showClipboardModal = true
                                },
                                onUnsyncDevice = { device ->
                                    OrbitRuntime.orbitPresence.removeDevice(device.id)
                                    if (OrbitRuntime.activeConnectionDeviceId.value == device.id) {
                                        OrbitRuntime.webRtcManager.closeConnection()
                                        OrbitRuntime.setActiveConnection(null)
                                    }
                                },
                                onAccountClick = { viewModel.currentScreen = Screen.Profile },
                                onSettingClick = { viewModel.currentScreen = Screen.Setting },
                                onCancelTransfer = { viewModel.cancelTransfer() },
                                transferStatus = viewModel.transferStatus,
                                modifier = Modifier,
                                networkStatus = viewModel.networkStatus
                            )

                        is Screen.Setting -> {
                            SettingScreen(
                                onBack = { viewModel.currentScreen = Screen.Home },
                                onThemeChange = { newTheme -> viewModel.updateTheme(newTheme) })
                        }

                        is Screen.Profile -> {
                            ProfileScreen(onBack = { viewModel.currentScreen = Screen.Home })
                        }

                        else -> {
                            Text(stringResource(R.string.undifiend_page))
                        }
                    }

                    if (viewModel.showNotifAccessDialog) {
                        NotificationAccessDialog(
                            onDismiss = { viewModel.showNotifAccessDialog = false },
                            onConfirm = {
                                viewModel.showNotifAccessDialog = false
                                NotificationHelper.openNotificationListenerSettings(context)
                            }
                        )
                    }

                    if (viewModel.showClipboardModal) {
                        ClipboardModal(
                            clipboardText = viewModel.clipboardText,
                            onTextChange = { viewModel.clipboardText = it },
                            onSend = {
                                val targetDevice = viewModel.clipboardTargetDevice
                                if (targetDevice != null) {
                                    viewModel.sendClipboard(targetDevice, viewModel.clipboardText)
                                }
                            },
                            onDismiss = { viewModel.showClipboardModal = false }
                        )
                    }

                    if (viewModel.pendingShareUris.isNotEmpty()) {
                        val onlineDevices =
                            otherDevices.filter { it.status.lowercase() == "online" }
                        ShareSheetDialog(
                            onlineDevices = onlineDevices,
                            onDismiss = { viewModel.clearPendingShare() },
                            onDeviceSelect = { device ->
                                viewModel.sendFiles(device, viewModel.pendingShareUris)
                                viewModel.clearPendingShare()
                            },
                            pendingShareUris = viewModel.pendingShareUris,
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

    private fun updateLocale() {
        val pref = getSharedPreferences("Settings", MODE_PRIVATE)
        val lang = pref.getString("lang", "en") ?: "en"

        val locale = Locale(lang)
        Locale.setDefault(locale)

        val config = resources.configuration
        config.setLocale(locale)

        resources.updateConfiguration(config, resources.displayMetrics)
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
                onSuccess = {
                    Toast.makeText(this, getString(R.string.msg_login_success), Toast.LENGTH_SHORT)
                        .show()
                },
                onError = { e ->
                    Toast.makeText(
                        this,
                        getString(R.string.msg_login_failed, e.message),
                        Toast.LENGTH_LONG
                    ).show()
                }
            )
        }
    }
}
