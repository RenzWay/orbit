package com.renz.orbit.ui.screen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.renz.orbit.service.Device
import com.renz.orbit.ui.components.DeviceCard
import com.renz.orbit.ui.components.HeaderHomeScreen
import com.renz.orbit.ui.components.QuickActions
import com.renz.orbit.ui.components.StatusBanner
import com.renz.orbit.ui.theme.OrbitTheme

@Composable
fun HomeScreen(
    devices: List<Device> = emptyList(),
    isOrbitActive: Boolean = true,
    onSendFile: (Device) -> Unit = {},
    onSyncClipboard: (Device) -> Unit = {},
    onUnsyncDevice: (Device) -> Unit = {},
    modifier: Modifier
) {
    var selectedDevice by remember { mutableStateOf<Device?>(null) }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            HeaderHomeScreen(modifier = Modifier)
        }) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
        ) {
            StatusBanner(isOrbitActive)
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "Available Devices", color = Color(0xFF94A3B8),
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(bottom = 16.dp)
            ) {
                if (devices.isEmpty()) {
                    item {
                        Text(
                            text = "No other devices found",
                            color = Color(0xFF64748B),
                            fontSize = 12.sp,
                            modifier = Modifier.padding(vertical = 12.dp)
                        )
                    }
                } else {
                    items(devices) { device ->
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
                            })
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
                    modifier = Modifier.padding(bottom = 24.dp)
                )
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