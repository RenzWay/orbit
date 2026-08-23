package com.renz.orbit.ui.screen

import android.app.Activity
import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.edit
import com.renz.orbit.R
import com.renz.orbit.ui.components.DialogLang
import com.renz.orbit.ui.theme.OrbitTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingScreen(onBack: () -> Unit, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val activity = context as? Activity
    var showDialog by remember { mutableStateOf(false) }

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
                        tint = Color.White
                    )
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = Color(0xFF0B0F1A),
                titleContentColor = Color.White
            )
        )
    }) { innderPadding ->
        Column(
            modifier = modifier
                .padding(innderPadding)
                .padding(16.dp)
        ) {

            Button(modifier = Modifier.fillMaxWidth(), onClick = { showDialog = true }) {
                Text(stringResource(R.string.change_language))
            }
            if (showDialog) {
                DialogLang(onDismissRequest = { showDialog = false }) {
                    Text(
                        text = "Pilih Bahasa",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(bottom = 20.dp)
                    )
                    // Tombol untuk Bahasa Indonesia
                    Button(modifier = Modifier.fillMaxWidth(), onClick = {
                        val pref = context.getSharedPreferences(
                            "Settings",
                            Context.MODE_PRIVATE
                        )
                        pref.edit { putString("lang", "in") }
                        activity?.recreate()
                    }) {
                        Text("Bahasa Indonesia")
                    }

                    // Tombol untuk Bahasa Inggris
                    Button(modifier = Modifier.fillMaxWidth(), onClick = {
                        val pref = context.getSharedPreferences(
                            "Settings",
                            Context.MODE_PRIVATE
                        )
                        pref.edit { putString("lang", "en") }
                        activity?.recreate()
                    }) {
                        Text("English")
                    }
                }
            }
        }
    }
}

@Preview
@Composable
private fun SettingScreenPreview() {
    OrbitTheme() {
        SettingScreen(
            onBack = {},
            modifier = Modifier
        )

    }
}