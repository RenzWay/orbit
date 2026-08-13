package com.renz.orbit.notification

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.renz.orbit.MainActivity
import com.renz.orbit.R
import com.renz.orbit.notification.NotificationHelper.newTransferId
import com.renz.orbit.notification.NotificationHelper.showTransferResult

/**
 * Pusat SEMUA notifikasi Orbit (di luar notifikasi "Orbit aktif" milik
 * OrbitConnectionService sendiri, itu tetap di file service-nya karena
 * emang nempel ke lifecycle foreground service).
 *
 * 3 CHANNEL, sengaja dipisah biar user bisa atur sendiri per-jenis lewat
 * Settings Android kalau mau (misal matiin notif "device online" doang,
 * tapi tetep mau notif hasil transfer):
 *
 * 1. CHANNEL_STATUS   — "Vivo Y20 sekarang online" (LOW, senyap, auto-hilang)
 * 2. CHANNEL_PROGRESS — progress bar kirim/terima file (LOW, ongoing,
 *                        di-update terus sampai selesai baru di-cancel)
 * 3. CHANNEL_RESULT   — hasil akhir sukses/gagal (DEFAULT, boleh notify
 *                        biasa karena ini info penting yang wajib keliatan)
 *
 * CARA PAKAI dari luar: semua fungsi di sini bisa dipanggil kapan aja,
 * channel-nya otomatis dibikin sendiri kalau belum ada (ensureChannels
 * dipanggil di awal tiap fungsi, aman dipanggil berkali-kali).
 */
object NotificationHelper {
    private const val CHANNEL_STATUS = "orbit_device_status"
    private const val CHANNEL_PROGRESS = "orbit_transfer_progress"
    private const val CHANNEL_RESULT = "orbit_transfer_result"

    private var nextNotificationId = 2000
    fun newTransferId(): Int = nextNotificationId++

    private fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager =
            context.getSystemService(NotificationManager::class.java) as NotificationManager

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_STATUS,
                "Status Device",
                NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Alert device online/offline" }
        )

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_PROGRESS,
                "Progress Transfer",
                NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Progress transfer file is being sent" }
        )

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_RESULT,
                "Transfer result",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply { description = "Alert file transfer result success/failed" }
        )
    }

    private fun openAppIntent(context: Context): PendingIntent = PendingIntent.getActivity(
        context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE
    )

    /**
     * Dipanggil dari OrbitConnectionService pas device lain berubah status
     * dari offline -> online. JANGAN dipanggil tiap ada perubahan snapshot
     * Firebase apapun (bakal spam) — cuma pas beneran transisi ke online.
     */
    fun notifyDeviceOnline(context: Context, deviceName: String) {
        ensureChannels(context)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                // User belum kasih ijin, abaikan saja (notif ga muncul)
                // Request ijin biasanya dilakukan di Activity
                return
            }
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_STATUS)
            .setContentTitle("$deviceName now online")
            .setContentText("Ready for file transfer")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(openAppIntent(context))
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setAutoCancel(true)
            .build()

        NotificationManagerCompat.from(context)
            .notify(deviceName.hashCode(), notification)
    }

    /**
     * Progress kirim/terima file, dipanggil berkali-kali selama transfer
     * jalan (throttle pemanggilannya di sisi caller, jangan tiap chunk —
     * cukup tiap perubahan persen biar ga nge-lag notifikasi system).
     *
     * @param id id unik per SESI transfer (dari [newTransferId]), dipakai
     *        juga nanti buat manggil [showTransferResult] biar notifikasi
     *        progress-nya "berubah jadi" notifikasi hasil, bukan nambah baru
     */
    fun showTransferProgress(
        context: Context,
        id: Int,
        fileName: String,
        progressPercent: Int,
        isSending: Boolean,
    ) {
        ensureChannels(context)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                return
            }
        }

        val verb = if (isSending) "Sending" else "Receiving"
        val notification = NotificationCompat.Builder(context, CHANNEL_PROGRESS)
            .setContentTitle("$verb $fileName")
            .setContentText("$progressPercent%")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setProgress(100, progressPercent, false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        NotificationManagerCompat.from(context).notify(id, notification)
    }


    /**
     * Notifikasi hasil akhir — dipanggil SEKALI di akhir tiap sesi transfer,
     * baik sukses maupun gagal. Pakai id yang SAMA dengan showTransferProgress
     * biar notifikasi progress "berubah jadi" notifikasi hasil (bukan dobel).
     */
    fun showTransferResult(
        context: Context,
        id: Int,
        fileName: String,
        isSending: Boolean,
        success: Boolean,
        errorMessage: String? = null,
    ) {
        ensureChannels(context)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                return
            }
        }

        val verb = if (isSending) "Sending" else "Receiving"
        val title = if (success) "'$fileName' Success $verb" else "Failed $verb '$fileName'"
        val text = if (success) null else (errorMessage ?: "An error occurred. Please try again.")
        val builder = NotificationCompat.Builder(context, CHANNEL_RESULT)
            .setContentTitle(title)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(openAppIntent(context))
            .setAutoCancel(true)
            .setOngoing(false)
            .setPriority(if (success) NotificationCompat.PRIORITY_DEFAULT else NotificationCompat.PRIORITY_HIGH)
        if (text != null) builder.setContentText(text)
        NotificationManagerCompat.from(context).notify(id, builder.build())
    }

    fun cancel(context: Context, id: Int) {
        NotificationManagerCompat.from(context).cancel(id)
    }
}