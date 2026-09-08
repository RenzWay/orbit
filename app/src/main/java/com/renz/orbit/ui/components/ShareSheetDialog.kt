package com.renz.orbit.ui.components

import android.net.Uri
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.renz.orbit.R
import com.renz.orbit.service.Device
import com.renz.orbit.ui.theme.OrbitTheme

@Composable
fun ShareSheetDialog(
    pendingShareUris: List<Uri>,
    onlineDevices: List<Device>,
    onDismiss: () -> Unit,
    onDeviceSelect: (Device) -> Unit,
    modifier: Modifier = Modifier
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = stringResource(R.string.title_upload_to_device)) },
        text = {
            Column {
                if (pendingShareUris.isNotEmpty()) {
                    Text(
                        text = stringResource(R.string.msg_send_files_to, pendingShareUris.size),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )
                }

                if (onlineDevices.isEmpty()) {
                    Text(text = stringResource(R.string.msg_no_online_devices))
                } else {
                    onlineDevices.forEach { device ->
                        Button(
                            onClick = { onDeviceSelect(device) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.tertiary
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 8.dp)
                        ) {
                            Text(
                                text = device.deviceName,
                                style = MaterialTheme.typography.bodyLarge,
                                modifier = Modifier.padding(vertical = 4.dp)
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(
                    contentColor = MaterialTheme.colorScheme.onError,
                    containerColor = MaterialTheme.colorScheme.onErrorContainer
                )
            ) {
                Text(text = stringResource(R.string.btn_cancel))
            }
        },
        modifier = modifier
    )
}

@Preview(showBackground = true)
@Composable
fun ShareSheetDialogPreview() {
    OrbitTheme {
        ShareSheetDialog(
            pendingShareUris = listOf(Uri.EMPTY, Uri.EMPTY),
            onlineDevices = listOf(
                Device(id = "1", deviceName = "PC Windows", status = "online"),
                Device(id = "2", deviceName = "Laptop Linux", status = "online")
            ),
            onDismiss = {},
            onDeviceSelect = {}
        )
    }
}
