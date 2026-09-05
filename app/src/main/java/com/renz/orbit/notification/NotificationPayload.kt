package com.renz.orbit.notification

import android.app.Notification
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

object NotificationPayload {
    fun from(sbn: StatusBarNotification): String {
        val notification = sbn.notification
        val extras = notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()

        val actions = JSONArray()
        notification.actions?.forEachIndexed { index, action ->
            val actionJson = JSONObject()
            actionJson.put("index", index)
            actionJson.put("title", action.title?.toString().orEmpty())

            val remoteInputs = action.remoteInputs
            actionJson.put("canReply", !remoteInputs.isNullOrEmpty())

            if (!remoteInputs.isNullOrEmpty()) {
                val inputs = JSONArray()
                remoteInputs.forEach { input ->
                    val inputJson = JSONObject()
                    inputJson.put("resultKey", input.resultKey)
                    inputJson.put("label", input.label?.toString().orEmpty())
                    inputs.put(inputJson)
                }
                actionJson.put("remoteInputs", inputs)
            }
            actions.put(actionJson)
        }

        return JSONObject().apply {
            put("type", "notification")
            put("key", sbn.key)
            put("packageName", sbn.packageName)
            put("title", title)
            put("text", text)
            put("postTime", sbn.postTime)
            put("actions", actions)
        }.toString()
    }
}
