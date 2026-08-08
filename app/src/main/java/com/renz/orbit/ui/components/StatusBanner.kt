package com.renz.orbit.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.renz.orbit.ui.theme.OrbitTheme

@Composable
fun StatusBanner(isActive: Boolean, modifier: Modifier = Modifier) {
    val backgroundColor by animateColorAsState(
        targetValue = if (isActive) Color(0xFF042B1A) else Color(0xFF2B0A0A),
        label = "bgColor"
    )
    val contentColor by animateColorAsState(
        targetValue = if (isActive) Color(0xFF05DF72) else Color(0xFFFF453A),
        label = "contentColor"
    )

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(color = backgroundColor, shape = RoundedCornerShape(24.dp))
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = if (isActive) Icons.Default.Wifi else Icons.Default.WifiOff,
            contentDescription = "Status wifi",
            tint = contentColor,
            modifier = Modifier.size(18.dp)
        )

        Spacer(modifier = Modifier.width(10.dp))

        Text(
            text = if (isActive) "Orbit is online" else "Orbit is Offline",
            color = contentColor,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Preview
@Composable
private fun StatusBannerPreview() {
    OrbitTheme {
        StatusBanner(isActive = true)
    }
}