package com.renz.orbit.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.renz.orbit.ui.theme.OrbitTheme

@Composable
fun DeviceCard(
    deviceName: String,
    status: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isOnline = status.lowercase() == "online"
    val cardBg = if (isSelected) Color(0xFF1E293B) else Color(0xFF161B26)
    val borderColor = if (isSelected) Color(0xFF05DF72) else Color.Transparent

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(cardBg)
            .then(
                if (isSelected) Modifier.border(1.dp, borderColor, RoundedCornerShape(16.dp))
                else Modifier
            )
            .clickable { onClick() }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Lingkaran Ikon
        Box(
            modifier = Modifier
                .size(40.dp)
                .background(Color(0xFF242C3D), shape = CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.PhoneAndroid,
                contentDescription = null,
                tint = if (isOnline) Color(0xFF05DF72) else Color(0xFF64748B),
                modifier = Modifier.size(24.dp)
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        // Teks Informasi Device
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = deviceName,
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = if (isOnline) "Online" else "Offline",
                color = if (isOnline) Color(0xFF05DF72) else Color(0xFF64748B),
                fontSize = 12.sp
            )
        }

        // Indikator kalau dipilih
        if (isSelected) {
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = null,
                tint = Color(0xFF05DF72),
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Preview
@Composable
private fun DeviceCardPreview() {
    OrbitTheme {
        Column(modifier = Modifier.padding(16.dp)) {
            DeviceCard(
                deviceName = "Samsung S24 Ultra",
                status = "Online",
                isSelected = true,
                onClick = {}
            )
            Spacer(modifier = Modifier.height(8.dp))
            DeviceCard(
                deviceName = "iPhone 15 Pro",
                status = "Offline",
                isSelected = false,
                onClick = {}
            )
        }
    }
}
