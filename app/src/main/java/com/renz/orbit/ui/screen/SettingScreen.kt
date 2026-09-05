package com.renz.orbit.ui.screen

import android.app.Activity
import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.edit
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.renz.orbit.R
import com.renz.orbit.notification.NotificationHelper
import com.renz.orbit.service.OrbitConnectionService
import com.renz.orbit.service.OrbitRuntime
import com.renz.orbit.ui.components.AutoStartBtn
import com.renz.orbit.ui.components.DialogLang
import com.renz.orbit.ui.components.LanguageOption
import com.renz.orbit.ui.components.SwitchTheme
import com.renz.orbit.ui.theme.OrbitTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingScreen(
    onBack: () -> Unit,
    onThemeChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val activity = context as? Activity
    var showDialog by remember { mutableStateOf(false) }
    val pref = remember { context.getSharedPreferences("Settings", Context.MODE_PRIVATE) }
    var currentTheme by remember { mutableStateOf(pref.getString("theme", "system") ?: "system") }

    var isNotifAccessEnabled by remember {
        mutableStateOf(NotificationHelper.isNotificationListenerEnabled(context))
    }

    var isBatteryIgnored by remember {
        mutableStateOf(NotificationHelper.isBatteryOptimizationIgnored(context))
    }

    var isAutoStartEnabled by remember {
        mutableStateOf(pref.getBoolean("auto_start", false))
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                isNotifAccessEnabled = NotificationHelper.isNotificationListenerEnabled(context)
                isBatteryIgnored = NotificationHelper.isBatteryOptimizationIgnored(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    BackHandler {
        onBack()
    }

    Scaffold(topBar = {
        TopAppBar(
            title = { Text(stringResource(R.string.desc_settings)) },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                    )
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.surfaceContainer,
                titleContentColor = MaterialTheme.colorScheme.onBackground,
            )
        )
    }) { innderPadding ->
        Column(
            modifier = modifier
                .padding(innderPadding)
                .padding(16.dp)
        ) {
            Text(
                text = stringResource(R.string.theme_title),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier
                    .align(Alignment.Start)
                    .padding(bottom = 12.dp)
            )

            SwitchTheme(
                currentTheme = currentTheme,
                onThemeSelected = { newTheme ->
                    currentTheme = newTheme
                    pref.edit { putString("theme", newTheme) }
                    onThemeChange(newTheme)
                }
            )

            Spacer(modifier = Modifier.height(32.dp))

            Text(
                text = stringResource(R.string.language),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier
                    .align(Alignment.Start)
                    .padding(bottom = 12.dp)
            )

            Button(modifier = Modifier.fillMaxWidth(), onClick = { showDialog = true }) {
                Text(stringResource(R.string.change_language))
            }

            if (showDialog) {
                val lang = pref.getString("lang", "en") ?: "en"
                DialogLang(onDismissRequest = { showDialog = false }) {
                    Text(
                        text = stringResource(R.string.choose_language),
                        color = MaterialTheme.colorScheme.onBackground,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 20.dp)
                    )

                    LanguageOption(
                        title = "Bahasa Indonesia",
                        isSelected = lang == "in",
                        onSelect = {
                            pref.edit { putString("lang", "in") }
                            OrbitConnectionService.start(context)
                            activity?.recreate()
                        }
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    LanguageOption(
                        title = "English",
                        isSelected = lang == "en",
                        onSelect = {
                            pref.edit { putString("lang", "en") }
                            OrbitConnectionService.start(context)
                            activity?.recreate()
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            // HANYA SATU TOMBOL UNTUK SEMUA
            AutoStartBtn(
                title = stringResource(R.string.setting_always_on_title),
                text = stringResource(R.string.setting_always_on_desc),
                isAutoStartEnabled = isAutoStartEnabled, // Pake state auto_start
                onAutoStartChange = { enabled ->
                    isAutoStartEnabled = enabled
                    // 1. Simpan settingan Startup
                    pref.edit { putBoolean("auto_start", enabled) }

                    // 2. Kalau dinyalain, sekalian minta izin Baterai (Popup)
                    if (enabled) {
                        NotificationHelper.requestIgnoreBatteryOptimizations(context)
                    }
                }
            )

//            // 1. Tombol MULAI OTOMATIS (Startup)
//            AutoStartBtn(
//                title = stringResource(R.string.setting_startup_title),
//                text = stringResource(R.string.setting_startup_desc),
//                isAutoStartEnabled = isAutoStartEnabled,
//                onAutoStartChange = { enabled ->
//                    isAutoStartEnabled = enabled
//                    pref.edit { putBoolean("auto_start", enabled) }
//                }
//            )
//
//            Spacer(modifier = Modifier.height(16.dp))
//
//            // 2. Tombol Izin Baterai (Anti-Mati)
//            AutoStartBtn(
//                title = stringResource(R.string.setting_keep_alive_title),
//                text = stringResource(R.string.setting_keep_alive_desc),
//                isAutoStartEnabled = isBatteryIgnored,
//                onAutoStartChange = { enabled ->
//                    if (enabled) {
//                        NotificationHelper.requestIgnoreBatteryOptimizations(context)
//                    } else {
//                        NotificationHelper.openBatteryOptimizationSettings(context)
//                    }
//                }
//            )

            Spacer(modifier = Modifier.height(16.dp))

            // 3. Tombol Notification Mirror
            AutoStartBtn(
                title = stringResource(R.string.notification_mirror_title),
                text = stringResource(
                    if (isNotifAccessEnabled) R.string.notification_access_granted
                    else R.string.notification_access_not_granted
                ),
                isAutoStartEnabled = isNotifAccessEnabled,
                onAutoStartChange = { enabled ->
                    if (enabled) {
                        NotificationHelper.openNotificationListenerSettings(context)
                    } else {
                        NotificationHelper.openNotificationListenerSettings(context)
                    }
                }
            )
        }
    }
}

@Preview
@Composable
private fun SettingScreenPreview() {
    OrbitTheme() {
        SettingScreen(
            onBack = {},
            modifier = Modifier,
            onThemeChange = {}
        )
    }
}
