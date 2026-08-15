package com.renz.orbit.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.firebase.auth.FirebaseAuth
import com.renz.orbit.MainActivity
import com.renz.orbit.R
import com.renz.orbit.notification.NotificationHelper

/**
 * Service yang tetap hidup di background, tugasnya CUMA 2:
 * 1. Jagain status "online" nyala terus (presence) — ini RINGAN, murah baterai
 * 2. Dengerin ada "offer" (permintaan kirim) masuk dari device lain — juga
 *    ringan, cuma baca perubahan kecil di Firebase, BUKAN koneksi WebRTC
 *
 * WebRTC PeerConnection (yang berat & butuh WakeLock/WifiLock) BARU dibikin
 * pas beneran ada offer masuk (lewat WebRtcManager.listenForIncomingCalls)
 * atau pas user manual mau ngirim — bukan otomatis buat semua device online.
 * Itu makanya service ini ga bikin boros walau hidup 24 jam.
 *
 * Kenapa harus Foreground Service (bukan Service biasa): sejak Android 8,
 * OS bakal bekuin/matiin service biasa dalam hitungan menit begitu app
 * di-background. Foreground Service "kebal" dari itu, TAPI syaratnya wajib
 * nampilin notifikasi permanen ke user (kita bikin low-priority/senyap,
 * ga bunyi ga getar, biar ga ganggu).
 */
class OrbitConnectionService : Service() {
    companion object {
        private const val CHANNEL_ID = "orbit_background_service"
        private const val NOTIFICATION_ID = 1001

        fun start(context: Context) {
            val intent = Intent(context, OrbitConnectionService::class.java)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, OrbitConnectionService::class.java))
        }
    }

    override fun onCreate() {
        super.onCreate()
        OrbitRuntime.init(this)
        startForeground(NOTIFICATION_ID, buildNotification())
        startListening()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    // Nyimpen device ID yang lagi online, dibandingin tiap snapshot Firebase
    // berubah buat ngedeteksi TRANSISI offline->online doang (bukan notify
    // ulang tiap snapshot dateng, itu bakal spam banget soalnya presence
    // Firebase bisa update lumayan sering).
    private val knownOnlineDeviceIds = mutableSetOf<String>()
    private var isFirstSnapshot = true

    private fun startListening() {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return
        val myDeviceId = OrbitRuntime.orbitPresence.deviceId

        OrbitRuntime.orbitPresence.setDeviceOnline(getRealDeviceName())

        OrbitRuntime.orbitPresence.listenToOtherDevices { devices ->
            OrbitRuntime.updateDevice(devices)

            val currentlyOnlineIds = devices
                .filter { it.status.lowercase() == "online" }
                .map { it.id }
                .toSet()

            if (!isFirstSnapshot) {
                val newlyOnline = currentlyOnlineIds - knownOnlineDeviceIds
                newlyOnline.forEach { deviceId ->
                    val device = devices.firstOrNull() { it.id == deviceId }
                    if (device != null) {
                        NotificationHelper.notifyDeviceOnline(this, device.deviceName)
                    }

                }
            }
            isFirstSnapshot = false
            knownOnlineDeviceIds.clear()
            knownOnlineDeviceIds.addAll(currentlyOnlineIds)
        }

        OrbitRuntime.webRtcManager.listenForIncomingCalls(myDeviceId) { fromDeviceId ->
            OrbitRuntime.setActiveConnection(fromDeviceId)
            OrbitRuntime.webRtcManager.createPeerConnection(
                targetDeviceId = fromDeviceId,
                myDeviceId = myDeviceId,
                isInitiator = false
            )
        }
    }

    private fun getRealDeviceName(): String {
        val manufacturer = Build.MANUFACTURER
        val model = Build.MODEL
        return if (model.lowercase().startsWith(manufacturer.lowercase())) {
            model.replaceFirstChar { it.uppercase() }
        } else {
            "${manufacturer.replaceFirstChar { it.uppercase() }} $model"
        }
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Orbit — Status Latar Belakang",
                // IMPORTANCE_LOW = muncul di status bar TAPI ga bunyi/getar/
                // nyembul (heads-up). Ini yang bikin "senyap" kayak yang
                // kamu maksud kemarin.
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Menjaga Orbit tetap terhubung & siap menerima kiriman"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }

        val openIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Orbit aktif")
            .setContentText("Siap menerima file & clipboard dari device lain")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
    }

    override fun onBind(p0: Intent?): IBinder? = null

}