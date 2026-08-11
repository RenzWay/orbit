package com.renz.orbit.service

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Singleton (satu instance buat seluruh aplikasi) yang jadi "jembatan"
 * antara [OrbitConnectionService] (yang hidup terus di background) dan
 * MainActivity/UI (yang bisa mati-hidup kapan aja).
 *
 * KENAPA INI PERLU: sebelumnya OrbitPresence & WebRtcManager dibikin
 * langsung di dalam MainActivity (`remember { WebRtcManager(context) }`),
 * jadi umurnya nempel ke Activity — begitu Activity mati (app di-swipe /
 * di-background lama), semua koneksi & listener ikut mati. Padahal buat
 * fitur "tetap bisa nerima kiriman walau app ga kebuka", listener-nya
 * WAJIB tetap hidup independen dari Activity.
 *
 * Solusinya: instance OrbitPresence & WebRtcManager dipindah ke sini
 * (singleton, umurnya se-umur proses aplikasi), dikendalikan oleh
 * OrbitConnectionService. MainActivity tinggal "numpang baca" state-nya
 * lewat [devices] StateFlow, ga perlu punya instance sendiri lagi.
 */
object OrbitRuntime {
    private var _orbitPresence: OrbitPresence? = null
    private var _webRtcManager: WebRtcManager? = null

    val orbitPresence: OrbitPresence
        get() = _orbitPresence ?: error("OrbitRuntime belum di-init, panggil init dulu")

    val webRtcManager: WebRtcManager
        get() = _webRtcManager ?: error("OrbitRuntime belum di-init, panggil init dulu")

    private val _devices = MutableStateFlow<List<Device>>(emptyList())
    val devices: StateFlow<List<Device>> = _devices.asStateFlow()

    private val _activeConnectionDeviceId = MutableStateFlow<String?>(null)
    val activeConnectionDeviceId: StateFlow<String?> = _activeConnectionDeviceId.asStateFlow()

    private var isInitialized = false

     fun init(context: Context){
        if (isInitialized) return
        val appContext = context.applicationContext
        _orbitPresence = OrbitPresence(appContext)
        _webRtcManager = WebRtcManager(appContext)
        isInitialized=true
    }

    fun updateDevice(newDevice: List<Device>){
        _devices.value = newDevice
    }

    fun setActiveConnection(deviceId: String?) {
        _activeConnectionDeviceId.value = deviceId
    }

    fun shutdown(){
        _webRtcManager?.shutdown()
        _orbitPresence = null
        _webRtcManager = null
        isInitialized = false
    }
}