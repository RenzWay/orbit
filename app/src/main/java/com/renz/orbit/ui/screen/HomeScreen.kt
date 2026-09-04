package com.renz.orbit.ui.screen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.renz.orbit.R
import com.renz.orbit.data.TransferStatus
import com.renz.orbit.service.Device
import com.renz.orbit.service.OrbitRuntime
import com.renz.orbit.ui.components.DeviceCard
import com.renz.orbit.ui.components.HeaderHomeScreen
import com.renz.orbit.ui.components.QuickActions
import com.renz.orbit.ui.components.StatusBanner
import com.renz.orbit.ui.components.TransferProgressCard
import com.renz.orbit.ui.theme.OrbitTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.milliseconds

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    devices: List<Device> = emptyList(),
    isOrbitActive: Boolean = true,
    onSendFile: (Device) -> Unit = {},
    onSyncClipboard: (Device) -> Unit = {},
    onUnsyncDevice: (Device) -> Unit = {},
    onAccountClick: () -> Unit = {},
    onSettingClick: () -> Unit = {},
    onCancelTransfer: () ->Unit ={},
    transferStatus: TransferStatus? = null,
    modifier: Modifier
) {
    var selectedDevice by remember { mutableStateOf<Device?>(null) }
    var isRefreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    val sortedDevices = remember(devices) {
        devices.sortedByDescending { it.status.lowercase() == "online" }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            HeaderHomeScreen(onAccountClick, onSettingClick, modifier = Modifier)
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState)
        }
    ) { innerPadding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = {
                scope.launch {
                    isRefreshing = true
                    OrbitRuntime.orbitPresence.setDeviceOnline()
                    delay(1000.milliseconds)
                    isRefreshing = false
                }
            },
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp)
            ) {
                StatusBanner(isOrbitActive)
                AnimatedVisibility(
                    visible = transferStatus != null,
                    enter = expandVertically() + fadeIn(),
                    exit = shrinkVertically() + fadeOut()
                ) {
                    transferStatus?.let { status ->
                        TransferProgressCard(
                            fileName = status.fileName,
                            progress = status.progress,
                            isSending = status.isSending,
                            onCancel = onCancelTransfer,
                            modifier = Modifier.padding(vertical = 12.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = stringResource(R.string.available_devices), color = Color(0xFF94A3B8),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(bottom = 16.dp)
                ) {
                    if (isRefreshing && devices.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator()
//                                LoadingIndicator(
//                                modifier = Modifier.size(48.dp), // Atur ukurannya
//                                containerColor = MaterialTheme.colorScheme.primaryContainer, // Warna lingkaran luarnya (Gambar #2)
//                                indicatorColor = MaterialTheme.colorScheme.primary // Warna bunga di dalamnya
//                            )
                            }
                        }
                    } else if (devices.isEmpty()) {
                        item {
                            Text(
                                text = stringResource(R.string.msg_no_devices),
                                color = Color(0xFF64748B),
                                fontSize = 12.sp,
                                modifier = Modifier.padding(vertical = 12.dp)
                            )
                        }
                    } else {
                        items(sortedDevices) { device ->
                            DeviceCard(
                                deviceName = device.deviceName,
                                status = device.status,
                                isSelected = selectedDevice?.id == device.id,
                                onClick = {
                                    selectedDevice =
                                        if (selectedDevice?.id == device.id) null else device
                                },
                                onUnsync = {
                                    if (selectedDevice?.id == device.id) {
                                        selectedDevice = null
                                    }
                                    onUnsyncDevice(device)
                                },

                                platform = device.platform
                            )
                        }
                    }
                }

                AnimatedVisibility(
                    visible = selectedDevice != null,
                    enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                    exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
                ) {
                    QuickActions(
                        onSendFileClick = {
                            selectedDevice?.let { onSendFile(it) }
                        },
                        onSyncClipboardClick = {
                            selectedDevice?.let { onSyncClipboard(it) }
                        },
                        enable = selectedDevice?.status?.lowercase() == "online",
                        snackbarHostState = snackbarHostState,
                        modifier = Modifier.padding(bottom = 24.dp)
                    )
                }

            }
        }
    }
}

@Preview
@Composable
private fun HomeScreenPreview() {
    OrbitTheme() {
        HomeScreen(
            modifier = Modifier
        )
    }
}