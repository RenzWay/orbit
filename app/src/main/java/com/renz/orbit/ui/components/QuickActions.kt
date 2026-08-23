package com.renz.orbit.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.stringResource
import com.renz.orbit.R
import kotlinx.coroutines.launch

@Composable
fun QuickActions(
    onSendFileClick: () -> Unit,
    onSyncClipboardClick: () -> Unit,
    enable: Boolean = true,
    snackbarHostState: SnackbarHostState,
    modifier: Modifier = Modifier
) {
    val scope = rememberCoroutineScope()
    val offlineMsg = stringResource(R.string.msg_device_offline)

    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = stringResource(R.string.title_quick_action),
            color = Color(0xFF94A3B8),
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(bottom = 12.dp)
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            ActionButton(
                title = stringResource(R.string.action_send_file),
                icon = Icons.Default.Send,
                iconTint = Color(0xFF05DF72),
                enable = enable,
                onClick = {
                    if (enable) {
                        onSendFileClick()
                    } else {
                        scope.launch {
                            snackbarHostState.showSnackbar(
                                offlineMsg
                            )
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            )

            ActionButton(
                title = stringResource(R.string.action_sync_clipboard),
                icon = Icons.Default.Assignment,
                iconTint = Color(0xFFFF6D00),
                enable = enable,
                onClick = {
                    if (enable) {
                        onSyncClipboardClick()
                    } else {
                        scope.launch {
                            snackbarHostState.showSnackbar(
                                offlineMsg
                            )
                        }
                    }
                },
                modifier = Modifier.weight(1f)
            )
        }


    }
}

@Composable
fun ActionButton(
    title: String,
    icon: ImageVector,
    iconTint: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enable: Boolean = true,
) {

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(if (enable) Color(0xFF161B26) else Color(0xFF161B26).copy(alpha = 0.5f))
            .clickable { onClick() }
            .alpha(if (enable) 1f else 0.5f)
            .padding(vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = title,
            tint = if (enable) iconTint else Color(0xFF64748B),
            modifier = Modifier.size(28.dp)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = title,
            color = if (enable) Color.White else Color(0xFF64748B),
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium
        )
    }
}
