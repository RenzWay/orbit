package com.renz.orbit.notification

import android.app.Notification
import android.app.PendingIntent
import android.app.RemoteInput
import android.content.Intent
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.renz.orbit.service.OrbitRuntime
import org.json.JSONObject

class NotificationListener : NotificationListenerService() {

    private val notifications = mutableMapOf<
            String,
            StatusBarNotification
            >()

    companion object {
        private const val TAG = "NotificationListener"

        @Volatile
        private var instance: NotificationListener? = null

        fun getInstance(): NotificationListener? = instance
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        instance = this

        getActiveNotifications().forEach { sbn ->
            notifications[sbn.key] = sbn
        }
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        if (instance == this) instance = null
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance == this) instance = null
    }

    fun sendReply(key: String, actionIndex: Int, text: String) {
        val action = findAction(key, actionIndex) ?: return
        val remoteInputs = action.remoteInputs
        if (remoteInputs.isNullOrEmpty()) {
            Log.w(
                TAG,
                "Action index $actionIndex di key=$key gak punya remoteInput, gabisa dibales sebagai teks"
            )
            return
        }

        val resultsBundle = Bundle().apply {
            remoteInputs.forEach { input ->
                putCharSequence(input.resultKey, text)
            }
        }

        val fillInIntent = Intent()
        RemoteInput.addResultsToIntent(remoteInputs, fillInIntent, resultsBundle)

        try {
            action.actionIntent.send(applicationContext, 0, fillInIntent)
        } catch (e: PendingIntent.CanceledException) {
            Log.e(TAG, "Gagal ngirim reply, PendingIntent udah dibatalkan", e)
        }
    }

    /** Buat action tanpa input teks, contoh: "Mark as read", "Archive". */
    fun performAction(key: String, actionIndex: Int) {
        val action = findAction(key, actionIndex) ?: return

        try {
            action.actionIntent.send()
        } catch (e: PendingIntent.CanceledException) {
            Log.e(TAG, "Gagal jalanin action, PendingIntent udah dibatalkan", e)
        }
    }

    private fun findAction(key: String, actionIndex: Int): Notification.Action? {
        val sbn = notifications[key] ?: run {
            Log.w(TAG, "Notif dengan key=$key udah gak ada (mungkin ke-dismiss)")
            return null
        }
        return sbn.notification.actions?.getOrNull(actionIndex) ?: run {
            Log.w(TAG, "Action index $actionIndex gak ketemu di notif key=$key")
            null
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        super.onNotificationPosted(sbn)

        notifications[sbn.key] = sbn

        send(
            NotificationPayload.from(sbn, packageManager)
        )
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        super.onNotificationRemoved(sbn)

        notifications.remove(sbn.key)

        send(
            JSONObject().apply {
                put("type", "notification-removed")
                put("key", sbn.key)
            }.toString()
        )
    }

    fun openNotification(key: String) {
        val sbn = notifications[key] ?: return

        try {
            sbn.notification.contentIntent?.send()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun send(payload: String) {
        // OrbitRuntime bisa aja belum di-init kalau sistem nge-bind listener
        // ini sebelum MainActivity/OrbitConnectionService sempet jalan
        // (misal abis reboot). Getter-nya throw kalau belum init, jadi
        // di-guard di sini biar notif lain tetep kekirim, bukan crash diem-diem.
        val webRtcManager = runCatching { OrbitRuntime.webRtcManager }.getOrNull() ?: return

        if (webRtcManager.isDataChannelOpen()) {
            webRtcManager.sendData(payload)
        }
    }
}
