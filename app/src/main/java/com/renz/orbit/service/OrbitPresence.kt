package com.renz.orbit.service

import android.content.Context
import android.provider.Settings
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ServerValue
import com.google.firebase.database.ValueEventListener

data class Device(
    val id: String = "",
    val deviceName: String = "",
    val platform: String = "android",
    val status: String = "offline",
    val lastSeen: Any? = null
)

class OrbitPresence(private val context: Context) {
    private val db =
        FirebaseDatabase.getInstance("https://letter-26c71-default-rtdb.asia-southeast1.firebasedatabase.app")
    private val auth = FirebaseAuth.getInstance()

    val deviceId: String
        get() = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        ) ?: "android-device"

    fun setDeviceOnline(deviceName: String = "android-device") {
        val uid = auth.currentUser?.uid ?: return
        val deviceRef = db.getReference("presence/$uid/$deviceId")
        val connectedRef = db.getReference(".info/connected")

        connectedRef.addValueEventListener(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val connected = snapshot.getValue(Boolean::class.java) ?: false
                if (connected) {
                    // Set offline saat terputus
                    deviceRef.onDisconnect().setValue(
                        mapOf(
                            "deviceName" to deviceName,
                            "platform" to "android",
                            "status" to "offline",
                            "lastSeen" to ServerValue.TIMESTAMP
                        )
                    )

                    // Set online sekarang
                    deviceRef.setValue(
                        mapOf(
                            "deviceName" to deviceName,
                            "platform" to "android",
                            "status" to "online",
                            "lastSeen" to ServerValue.TIMESTAMP
                        )
                    )
                }
            }

            override fun onCancelled(error: DatabaseError) {
                // Handle error if needed
                Log.e("Firebase", "Koneksi ke Firebase dibatalkan: ${error.message}")
            }
        })
    }

    /**
     * "Unsync" device: hapus node-nya dari presence list.
     * Sama kayak versi PC: kalau device yang dihapus masih nyala & masih
     * connect, dia bisa nulis dirinya sendiri online lagi lewat
     * setDeviceOnline/onDisconnect yang lagi jalan di device itu sendiri.
     */
    fun removeDevice(targetDeviceId: String) {
        val uid = auth.currentUser?.uid ?: return
        db.getReference("presence/$uid/$targetDeviceId").removeValue()
    }

    fun listenToOtherDevices(onDevicesUpdated: (List<Device>) -> Unit) {
        val uid = auth.currentUser?.uid ?: return
        val presenceRef = db.getReference("presence/$uid")

        presenceRef.addValueEventListener(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val deviceList = mutableListOf<Device>()
                for (child in snapshot.children) {
                    val id = child.key ?: continue
                    if (id != deviceId) {
                        val name =
                            child.child("deviceName").getValue(String::class.java) ?: "Unknown"
                        val platform =
                            child.child("platform").getValue(String::class.java) ?: "unknown"
                        val status = child.child("status").getValue(String::class.java) ?: "offline"
                        deviceList.add(Device(id, name, platform, status))
                    }
                }
                onDevicesUpdated(deviceList)
            }

            override fun onCancelled(error: DatabaseError) {}
        })
    }
}