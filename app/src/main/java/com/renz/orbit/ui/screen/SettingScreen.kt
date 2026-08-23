package com.renz.orbit.ui.screen

import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.res.stringResource
import androidx.core.os.LocaleListCompat
import com.renz.orbit.R
import com.renz.orbit.ui.theme.OrbitTheme

@Composable
fun SettingScreen(modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        // Tombol untuk Bahasa Indonesia
        Button(onClick = {
            AppCompatDelegate.setApplicationLocales(
                LocaleListCompat.forLanguageTags("in")
            )
        }) {
            Text("Bahasa Indonesia")
        }

        // Tombol untuk Bahasa Inggris
        Button(onClick = {
            AppCompatDelegate.setApplicationLocales(
                LocaleListCompat.forLanguageTags("en")
            )
        }) {
            Text("English")
        }
    }
    Text(stringResource(R.string.msg_coming_soon))
}

@Preview
@Composable
private fun SettingScreenPreview() {
    OrbitTheme() {
        SettingScreen()

    }
}