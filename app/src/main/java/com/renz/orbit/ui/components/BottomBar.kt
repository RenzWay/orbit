package com.renz.orbit.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.NavigationBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.stringResource
import com.renz.orbit.R
import com.renz.orbit.ui.navigation.NavigationItem
import com.renz.orbit.ui.navigation.Screen
import com.renz.orbit.ui.theme.OrbitTheme

@Composable
fun BottomBar(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(70.dp)
            .background(
                Color.White,
                RoundedCornerShape(20)
            ),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        NavigationItem(title = stringResource(R.string.nav_home), icon = Icons.Default.Home, screen = Screen.Home)
        NavigationItem(title = stringResource(R.string.nav_profile), icon = Icons.Default.Person, screen = Screen.Profile)
    }
}

@Preview
@Composable
private fun BottonBarPreview() {
    OrbitTheme() {
        BottomBar()
    }

}