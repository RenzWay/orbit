package com.renz.orbit.ui.components

import androidx.compose.animation.ExperimentalAnimationApi
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.DarkMode
import androidx.compose.material.icons.rounded.LightMode
import androidx.compose.material.icons.rounded.SettingsSuggest
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.renz.orbit.ui.theme.OrbitTheme

@OptIn(ExperimentalAnimationApi::class)
@Composable
fun SwitchTheme(
    currentTheme: String,
    onThemeSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val thumbOffset by animateDpAsState(
        targetValue = when (currentTheme) {
            "light" -> 0.dp
            "system" -> 48.dp
            else -> 96.dp // dark
        },
        animationSpec = spring(dampingRatio = 0.7f, stiffness = 300f),
        label = "thumbMove"
    )

    Box(
        modifier = modifier
            .width(144.dp)
            .height(48.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(4.dp)
    ) {
        Box(
            modifier = Modifier
                .offset(x = thumbOffset)
                .size(40.dp)
                .background(MaterialTheme.colorScheme.primary, CircleShape)
        )

        Row(modifier = Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
            ThemeIcon(
                icon = Icons.Rounded.LightMode,
                isSelected = currentTheme == "light",
                onClick = { onThemeSelected("light") }
            )
            ThemeIcon(
                icon = Icons.Rounded.SettingsSuggest,
                isSelected = currentTheme == "system",
                onClick = { onThemeSelected("system") }
            )
            ThemeIcon(
                icon = Icons.Rounded.DarkMode,
                isSelected = currentTheme == "dark",
                onClick = { onThemeSelected("dark") }
            )
        }
    }
}

@Composable
private fun RowScope.ThemeIcon(
    icon: ImageVector,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val iconColor by animateColorAsState(
        targetValue = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
        label = "iconColor"
    )

    Box(
        modifier = Modifier
            .weight(1f)
            .fillMaxHeight()
            .clip(CircleShape)
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = iconColor,
            modifier = Modifier.size(20.dp)
        )
    }

}

@Preview
@Composable
private fun OptionPrev() {
    OrbitTheme() {
        SwitchTheme(currentTheme = "light", onThemeSelected = {})
    
    }
}