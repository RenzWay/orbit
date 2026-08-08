package com.renz.orbit.service

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider

class AuthManager(private val contex: Context) {
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()

    fun openLoginCustomTab() {
        val authUrl = "https://letter-26c71.firebaseapp.com/auth.html"
        val customTabsIntent = CustomTabsIntent.Builder().build()
        customTabsIntent.launchUrl(contex, Uri.parse(authUrl))
    }

    fun handleDeepLinkIntent(
        uri: Uri?,
        onSucess: () -> Unit,
        onError: (Exception) -> Unit,

    ) {
        if (uri != null && uri.scheme == "orbit" && uri.host == "auth-callback") {
            val idToken = uri.getQueryParameter("idToken")
            if (!idToken.isNullOrEmpty()) {
                val credential = GoogleAuthProvider.getCredential(idToken, null)
                auth.signInWithCredential(credential)
                    .addOnSuccessListener {
                        onSucess()
                    }
                    .addOnFailureListener { exeption ->
                        onError(exeption)
                    }
            }
        }
    }
}