package com.renz.orbit.notification

import android.app.Notification
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.renz.orbit.service.OrbitRuntime
import org.json.JSONObject

class NotificationListener : NotificationListenerService() {

    private val notifications = mutableMapOf<
        String,
        StatusBarNotification
    >()

    override fun onListenerConnected() {
        super.onListenerConnected()

        getActiveNotifications().forEach { sbn ->
            notifications[sbn.key] = sbn
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        super.onNotificationPosted(sbn)

        notifications[sbn.key] = sbn

        send(
            NotificationPayload.from(sbn)
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
