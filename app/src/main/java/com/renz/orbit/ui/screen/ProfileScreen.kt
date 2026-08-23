package com.renz.orbit.ui.screen

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import com.renz.orbit.R
import com.renz.orbit.ui.theme.OrbitTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(onBack: () -> Unit, modifier: Modifier = Modifier) {
    BackHandler {
        onBack()
    }
    Scaffold(topBar = {
        TopAppBar(
            title = { Text(stringResource(R.string.desc_account)) },
            navigationIcon = {
                IconButton(onClick = { onBack() }) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back"
                    )
                }
            })
    }) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) { }
    }
}

@Preview
@Composable
private fun ProfileScreenPrev() {
    OrbitTheme() {
        ProfileScreen(
            onBack = {}
        )
    }
}