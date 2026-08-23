package com.renz.orbit.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.renz.orbit.R
import com.renz.orbit.ui.theme.OrbitTheme

@Composable
fun HeaderHomeScreen(onAccountClick: () -> Unit, onSettingCLick: () -> Unit, modifier: Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "ORBIT",
                color = Color(0xFF05DF72),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = stringResource(R.string.title_my_device),
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
        }

        AccountButton(onAccountClick = onAccountClick, onSettingClick = onSettingCLick)
    }
}

@Preview
@Composable
private fun HeaderPrev() {
    OrbitTheme() {

    }
}