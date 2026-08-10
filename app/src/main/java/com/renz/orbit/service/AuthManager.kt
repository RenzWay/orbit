package com.renz.orbit.service

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.tasks.Task
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.tasks.await

class AuthManager(private val context: Context) {
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
    private val webClientId =
        "980332186200-1kon3qpbo76m9r0s70gu6qcmeo2libtn.apps.googleusercontent.com"

    class NoGoogleCredentialProviderException(message: String) : Exception(message)

    fun openLoginCustomTab() {
        val authUrl = "https://letter-26c71.firebaseapp.com/auth.html"
        val customTabsIntent = CustomTabsIntent.Builder().build()
        customTabsIntent.launchUrl(context, authUrl.toUri())
    }

    suspend fun signInWithGoogle(context: Context) {

        val credentialManager = CredentialManager.create(context)

        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(webClientId)
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        val result = try {
            credentialManager.getCredential(
                request = request,
                context = context,
            )
        } catch (e: GetCredentialException) {
            if (e.type.endsWith("TYPE_NO_CREDENTIAL")) {
                throw NoGoogleCredentialProviderException(
                    "Google belum aktif sebagai Credential Provider di device ini"
                )
            }
            throw IllegalStateException("[${e.type}] ${e.message}")
        }

        val credential = result.credential
        if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            throw IllegalStateException("Invalid credential type")
        }

        val googleTokenCredential = try {
            GoogleIdTokenCredential.createFrom(credential.data)
        } catch (e: GoogleIdTokenParsingException) {
            throw IllegalStateException("Invalid Google ID token ${e.message}")
        }

        val firebaseCredential = GoogleAuthProvider.getCredential(
            googleTokenCredential.idToken,
            null
        )

        auth.signInWithCredential(firebaseCredential).await()
    }

    fun getGoogleSignInClient(): GoogleSignInClient {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(webClientId)
            .requestEmail()
            .build()
        return GoogleSignIn.getClient(context, gso)
    }

    suspend fun firebaseAuthWithGoogleSignInResult(data: Intent?) {
        val task: Task<GoogleSignInAccount> = GoogleSignIn.getSignedInAccountFromIntent(data)

        val account = task.getResult(ApiException::class.java)

        val credential = GoogleAuthProvider.getCredential(account.idToken, null)
        auth.signInWithCredential(credential).await()
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