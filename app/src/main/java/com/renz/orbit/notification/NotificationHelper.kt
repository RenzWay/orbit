package com.renz.orbit.notification

import android.Manifest
import android.app.Notification
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
    private const val CHANNEL_STATUS = "orbit_device_status_v3"
    private const val CHANNEL_PROGRESS = "orbit_transfer_progress_v3"
    private const val CHANNEL_RESULT = "orbit_transfer_result_v3"
    const val CHANNEL_SERVICE = "orbit_background_service_v2"
    const val SERVICE_NOTIFICATION_ID = 1001
    private var nextNotificationId = 2000
    fun newTransferId(): Int = nextNotificationId++

    private fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager =
            context.getSystemService(NotificationManager::class.java) as NotificationManager

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_STATUS,
                context.getString(R.string.notif_channel_status_name),
                NotificationManager.IMPORTANCE_HIGH
            ).apply { description = context.getString(R.string.notif_channel_status_desc) }
        )

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_PROGRESS,
                context.getString(R.string.notif_channel_progress_name),
                NotificationManager.IMPORTANCE_HIGH
            ).apply { description = context.getString(R.string.notif_channel_progress_desc) }
        )

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_RESULT,
                context.getString(R.string.notif_channel_result_name),
                NotificationManager.IMPORTANCE_HIGH
            ).apply { description = context.getString(R.string.notif_channel_result_desc) }
        )

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_SERVICE,
                context.getString(R.string.notif_channel_service_name),
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply { description = context.getString(R.string.notif_channel_service_desc) }
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
            .setContentTitle(context.getString(R.string.notif_device_online, deviceName))
            .setContentText(context.getString(R.string.notif_ready_transfer))
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(openAppIntent(context))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
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

        val title = context.getString(
            if (isSending) R.string.notif_sending_file else R.string.notif_receiving_file,
            fileName
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_PROGRESS)
            .setContentTitle(title)
            .setContentText("$progressPercent%")
            .setSmallIcon(R.drawable.ic_orbit)
            .setProgress(100, progressPercent, false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
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

        val verb =
            context.getString(if (isSending) R.string.notif_sent else R.string.notif_received)
        val action =
            context.getString(if (isSending) R.string.notif_send else R.string.notif_receive)
        val title = if (success) {
            context.getString(R.string.notif_transfer_success, fileName, verb)
        } else {
            context.getString(R.string.notif_transfer_failed, action, fileName)
        }
        val text =
            if (success) null else (errorMessage ?: context.getString(R.string.notif_generic_error))
        val builder = NotificationCompat.Builder(context, CHANNEL_RESULT)
            .setContentTitle(title)
            .setSmallIcon(R.drawable.ic_orbit)
            .setContentIntent(openAppIntent(context))
            .setAutoCancel(true)
            .setOngoing(false)
            .setPriority(if (success) NotificationCompat.PRIORITY_DEFAULT else NotificationCompat.PRIORITY_HIGH)
        if (text != null) builder.setContentText(text)
        NotificationManagerCompat.from(context).notify(id, builder.build())
    }

    fun buildServiceNotification(
        context: Context,
        statusText: String? = null
    ): Notification {
        ensureChannels(context)
        val contentText = statusText ?: context.getString(R.string.notif_service_ready)

        return NotificationCompat.Builder(context, CHANNEL_SERVICE)
            .setContentTitle(context.getString(R.string.notif_orbit_active))
            .setContentText(contentText)
            .setSmallIcon(R.drawable.ic_orbit)
            .setContentIntent(openAppIntent(context))
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
    }

    fun cancel(context: Context, id: Int) {
        NotificationManagerCompat.from(context).cancel(id)
    }
}