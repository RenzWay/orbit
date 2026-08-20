package com.renz.orbit.ui.screen

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.renz.orbit.ui.theme.OrbitTheme

@Composable
fun SettingScreen(modifier: Modifier = Modifier) {
    Text("nothing here, coming soon")
}

@Preview
@Composable
private fun SettingScreenPreview() {
    OrbitTheme() {
        SettingScreen()

    }
}