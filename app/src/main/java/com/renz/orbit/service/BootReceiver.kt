package com.renz.orbit.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.firebase.auth.FirebaseAuth

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val pref = context.getSharedPreferences("Settings", Context.MODE_PRIVATE)
            val autoStart = pref.getBoolean("auto_start", false)
            val currentUser = FirebaseAuth.getInstance().currentUser

            if (autoStart && currentUser != null) {
                OrbitConnectionService.start(context)
            }
        }
    }

}