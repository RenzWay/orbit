package com.renz.orbit.ui.navigation

sealed class Screen(val route: String) {
    data object Home : Screen("home")
    data object Login : Screen("login")
    data object Profile: Screen("profile")
}