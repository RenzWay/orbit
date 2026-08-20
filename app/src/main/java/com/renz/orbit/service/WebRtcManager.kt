package com.renz.orbit.service

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Build
import android.os.PowerManager
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.ChildEventListener
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.DatabaseReference
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.webrtc.DataChannel
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import java.nio.ByteBuffer
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

/**
 * Owns the WebRTC peer connection and Firebase signaling for one app process.
 *
 * The manager intentionally keeps its original responsibilities: connection setup,
 * SDP/ICE signaling, DataChannel I/O, and connection resource cleanup. Higher-level
 * transfer orchestration lives in [TransferManager].
 */
class WebRtcManager(private val context: Context) {
    private val db =
        FirebaseDatabase.getInstance("https://letter-26c71-default-rtdb.asia-southeast1.firebasedatabase.app")
    private val auth = FirebaseAuth.getInstance()

    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var dataChannel: DataChannel? = null

    private val pendingIceCandidates = mutableListOf<IceCandidate>()
    private val addedIceCandidates = mutableSetOf<String>()
    private var processedRemoteSdp: String? = null

    private val wifiLockMode =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
            WifiManager.WIFI_MODE_FULL_LOW_LATENCY
        else
            WifiManager.WIFI_MODE_FULL_HIGH_PERF
    private val wifiLock: WifiManager.WifiLock = (context.applicationContext
        .getSystemService(Context.WIFI_SERVICE) as WifiManager)
        .createWifiLock(wifiLockMode, "orbit:transfer")

    private val wakeLock: PowerManager.WakeLock = (context.applicationContext
        .getSystemService(Context.POWER_SERVICE) as PowerManager)
        .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "orbit:transfer")

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var idleWatcherJob: Job? = null
    private var lastActivityAt = System.currentTimeMillis()

    private companion object {
        const val TAG = "WebRtcManager"
        val WAKE_LOCK_BURST = 60.seconds
        val IDLE_DISCONNECT_TIMEOUT = 10.minutes
    }

    fun markActivity() {
        lastActivityAt = System.currentTimeMillis()
        wakeLock.acquire(WAKE_LOCK_BURST.inWholeMilliseconds)
    }

    private fun startIdleWatcher() {
        idleWatcherJob?.cancel()
        idleWatcherJob = scope.launch {
            while (true) {
                kotlinx.coroutines.delay(60.seconds)
                if (dataChannel?.state() != DataChannel.State.OPEN) continue
                val idleFor = System.currentTimeMillis() - lastActivityAt
                if (idleFor >= IDLE_DISCONNECT_TIMEOUT.inWholeMilliseconds) {
                    Log.d(TAG, "Koneksi nganggur ${idleFor}ms, auto-disconnect buat hemat baterai.")
                    closeConnection()
                    return@launch
                }
            }
        }
    }

    var onDataReceived: ((String) -> Unit)? = null
    var onBinaryReceived: ((ByteArray) -> Unit)? = null
    var onConnectionStateChanged: ((Boolean) -> Unit)? = null

    init {
        initWebRTC()
    }

    private fun initWebRTC() {
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)

        peerConnectionFactory = PeerConnectionFactory.builder()
            .createPeerConnectionFactory()
    }

    private var pendingOfferJob: ChildEventListener? = null
    private var incomingCallsRef: DatabaseReference? = null
    private val handleCallsId = mutableSetOf<String>()

    private val handledOfferSdp = mutableMapOf<String, String>()

    fun listenForIncomingCalls(myDeviceId: String, onIncomingCall: (fromDeviceId: String) -> Unit) {
        val uid = auth.currentUser?.uid ?: return
        incomingCallsRef?.let {}

        val ref = db.getReference("calls/$uid")
        incomingCallsRef = ref

        ref.addChildEventListener(object : ChildEventListener {
            private fun checkAndTrigger(snapshot: DataSnapshot) {
                val callId = snapshot.key ?: return
                val suffix = "_to_$myDeviceId"
                if (!callId.endsWith(suffix)) return

                val offerSdp =
                    snapshot.child("offer").child("sdp").getValue(String::class.java) ?: return

                if (handledOfferSdp[callId] == offerSdp) return
                handledOfferSdp[callId] = offerSdp
                handleCallsId.add(callId)

                val fromDeviceId = callId.removeSuffix(suffix)
                Log.d(TAG, "Ada offer masuk dari: $fromDeviceId")
                onIncomingCall(fromDeviceId)
            }

            override fun onChildAdded(snapshot: DataSnapshot, previousChildName: String?) =
                checkAndTrigger(snapshot)

            override fun onChildChanged(
                snapshot: DataSnapshot,
                previousChildName: String?
            ) = checkAndTrigger(snapshot)

            override fun onChildRemoved(snapshot: DataSnapshot) {
                snapshot.key?.let { handleCallsId.remove(it) }
            }

            override fun onChildMoved(
                snapshot: DataSnapshot,
                previousChildName: String?
            ) {
            }

            override fun onCancelled(error: DatabaseError) {}


        })
    }

    fun resetHandleCalls() {
        handleCallsId.clear()
        handledOfferSdp.clear()
    }

    fun isDataChannelOpen(): Boolean = dataChannel?.state() == DataChannel.State.OPEN

    suspend fun awaitDataChannelOpen(timeoutMs: Long = 15_000): Boolean {
        val start = System.currentTimeMillis()

        while (!isDataChannelOpen()) {
            if (System.currentTimeMillis() - start > timeoutMs) return false
            kotlinx.coroutines.delay(150.milliseconds)
        }

        return true
    }

    // 1. Inisialisasi PeerConnection & ICE Server (Google STUN)
    fun createPeerConnection(targetDeviceId: String, myDeviceId: String, isInitiator: Boolean) {
        if (!wifiLock.isHeld) wifiLock.acquire()
        markActivity()

        val iceServers = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("turn:openrelay.metered.ca:80")
                .setUsername("openrelayproject")
                .setPassword("openrelayproject")
                .createIceServer(),
            PeerConnection.IceServer.builder("turn:openrelay.metered.ca:443")
                .setUsername("openrelayproject")
                .setPassword("openrelayproject")
                .createIceServer(),
            PeerConnection.IceServer.builder("turn:openrelay.metered.ca:443?transport=tcp")
                .setUsername("openrelayproject")
                .setPassword("openrelayproject")
                .createIceServer()
        )

        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }

        peerConnection = peerConnectionFactory?.createPeerConnection(
            rtcConfig,
            object : PeerConnection.Observer {
                override fun onIceCandidate(candidate: IceCandidate?) {
                    candidate?.let {
                        sendIceCandidateToFirebase(targetDeviceId, myDeviceId, it, isInitiator)
                    }
                }

                override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState?) {
                    Log.d(TAG, "ICE Connection State: $newState")
                    val isConnected = newState == PeerConnection.IceConnectionState.CONNECTED
                    onConnectionStateChanged?.invoke(isConnected)
                }

                override fun onDataChannel(dc: DataChannel?) {
                    dataChannel = dc
                    setupDataChannelObserver()
                }

                override fun onSignalingChange(p0: PeerConnection.SignalingState?) {}
                override fun onIceConnectionReceivingChange(p0: Boolean) {}
                override fun onIceGatheringChange(p0: PeerConnection.IceGatheringState?) {}
                override fun onIceCandidatesRemoved(p0: Array<out IceCandidate>?) {}
                override fun onAddStream(p0: MediaStream?) {}
                override fun onRemoveStream(p0: MediaStream?) {}
                override fun onRenegotiationNeeded() {}
                override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {}
            })

        if (isInitiator) {
            val init = DataChannel.Init()
            dataChannel = peerConnection?.createDataChannel("orbit-channel", init)
            setupDataChannelObserver()
            createOffer(targetDeviceId, myDeviceId)
        } else {
            listenForOffer(targetDeviceId, myDeviceId)
        }

        listenForRemoteIceCandidates(targetDeviceId, myDeviceId, isInitiator)
    }

    private fun listenForRemoteIceCandidates(
        targetDeviceId: String,
        myDeviceId: String,
        isInitiator: Boolean
    ) {
        val uid = auth.currentUser?.uid ?: return
        val callPath = if (isInitiator) {
            "calls/$uid/${myDeviceId}_to_${targetDeviceId}"
        } else {
            "calls/$uid/${targetDeviceId}_to_${myDeviceId}"
        }
        val remoteCandidatesPath =
            if (isInitiator) "$callPath/answerCandidates" else "$callPath/offerCandidates"

        db.getReference(remoteCandidatesPath)
            .addChildEventListener(object : com.google.firebase.database.ChildEventListener {
                override fun onChildAdded(snapshot: DataSnapshot, previousChildName: String?) {
                    val sdpMid = snapshot.child("sdpMid").getValue(String::class.java)
                    val sdpMLineIndex =
                        snapshot.child("sdpMLineIndex").getValue(Int::class.java) ?: return
                    val candidateStr =
                        snapshot.child("candidate").getValue(String::class.java) ?: return

                    if (addedIceCandidates.contains(candidateStr)) return
                    addedIceCandidates.add(candidateStr)

                    val iceCandidate = IceCandidate(sdpMid, sdpMLineIndex, candidateStr)
                    if (peerConnection?.remoteDescription != null) {
                        peerConnection?.addIceCandidate(iceCandidate)
                        Log.d(TAG, "ICE candidate dari lawan berhasil ditambahkan")
                    } else {
                        pendingIceCandidates.add(iceCandidate)
                        Log.d(TAG, "SDP belum siap, simpan ICE candidate ke antrean")
                    }
                }

                override fun onChildChanged(snapshot: DataSnapshot, previousChildName: String?) {}
                override fun onChildRemoved(snapshot: DataSnapshot) {}
                override fun onChildMoved(snapshot: DataSnapshot, previousChildName: String?) {}
                override fun onCancelled(error: DatabaseError) {}
            })
    }

    private fun setupDataChannelObserver() {
        dataChannel?.registerObserver(object : DataChannel.Observer {
            override fun onBufferedAmountChange(p0: Long) {}
            override fun onStateChange() {
                Log.d(TAG, "DataChannel State: ${dataChannel?.state()}")
                if (dataChannel?.state() == DataChannel.State.OPEN) {
                    markActivity()
                    startIdleWatcher()
                }
            }

            override fun onMessage(buffer: DataChannel.Buffer) {
                markActivity()
                val data = buffer.data
                val bytes = ByteArray(data.remaining())
                data.get(bytes)

                if (buffer.binary) {
                    Log.d(TAG, "Dapet data biner dari DataChannel, size: ${bytes.size}")
                    onBinaryReceived?.invoke(bytes)
                } else {
                    val text = String(bytes, Charsets.UTF_8)
                    Log.d(TAG, "Dapet data teks dari DataChannel: $text")
                    onDataReceived?.invoke(text)
                }
            }
        })
    }

    fun sendData(text: String) {
        if (dataChannel?.state() == DataChannel.State.OPEN) {
            markActivity()
            val buffer = ByteBuffer.wrap(text.toByteArray(Charsets.UTF_8))
            dataChannel?.send(DataChannel.Buffer(buffer, false))
            Log.d(TAG, "Berhasil kirim data via DataChannel!")
        } else {
            Log.e(TAG, "DataChannel belum OPEN!")
        }
    }

    fun sendClipboard(text: String) {
        if (dataChannel?.state() != DataChannel.State.OPEN) {
            Log.e(TAG, "DataChannel belum OPEN! State saat ini: ${dataChannel?.state()}")
            return
        }
        markActivity()

        val json = JSONObject().apply {
            put("type", "clipboard")
            put("payload", text)
        }

        val buffer = DataChannel.Buffer(
            ByteBuffer.wrap(json.toString().toByteArray(Charsets.UTF_8)),
            false
        )

        val success = dataChannel?.send(buffer)
        Log.d(TAG, "Status pengiriman clipboard: $success")
    }

    private fun createOffer(targetDeviceId: String, myDeviceId: String) {
        val uid = auth.currentUser?.uid ?: return
        val callPath = "calls/$uid/${myDeviceId}_to_${targetDeviceId}"
        db.getReference(callPath).setValue(null)

        val constraints = MediaConstraints()
        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription?) {
                sdp?.let {
                    peerConnection?.setLocalDescription(this, it)
                    db.getReference(callPath).child("offer").setValue(
                        mapOf("type" to "offer", "sdp" to it.description)
                    )
                    listenForAnswer(targetDeviceId, myDeviceId)
                }
            }

            override fun onSetSuccess() {}
            override fun onCreateFailure(p0: String?) {}
            override fun onSetFailure(p0: String?) {}
        }, constraints)
    }

    private fun listenForOffer(targetDeviceId: String, myDeviceId: String) {
        val uid = auth.currentUser?.uid ?: return
        val callPath = "calls/$uid/${targetDeviceId}_to_${myDeviceId}"
        db.getReference(callPath).child("offer").addValueEventListener(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val sdpStr = snapshot.child("sdp").getValue(String::class.java) ?: return

                if (sdpStr == processedRemoteSdp) return
                if (peerConnection?.signalingState() != PeerConnection.SignalingState.STABLE) {
                    Log.w(
                        TAG,
                        "Abaikan Offer: Signaling state sedang ${peerConnection?.signalingState()}"
                    )
                    return
                }

                processedRemoteSdp = sdpStr
                val sdp = SessionDescription(SessionDescription.Type.OFFER, sdpStr)
                peerConnection?.setRemoteDescription(object : SimpleSdpObserver() {
                    override fun onSetSuccess() {
                        drainIceCandidates()
                        createAnswer(targetDeviceId, myDeviceId)
                    }
                }, sdp)
            }

            override fun onCancelled(error: DatabaseError) {}
        })
    }

    private fun createAnswer(targetDeviceId: String, myDeviceId: String) {
        val constraints = MediaConstraints()
        peerConnection?.createAnswer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription?) {
                sdp?.let {
                    peerConnection?.setLocalDescription(this, it)
                    val uid = auth.currentUser?.uid ?: return
                    val callPath = "calls/$uid/${targetDeviceId}_to_${myDeviceId}"
                    db.getReference(callPath).child("answer").setValue(
                        mapOf("type" to "answer", "sdp" to it.description)
                    )
                }
            }

            override fun onSetSuccess() {}
            override fun onCreateFailure(p0: String?) {}
            override fun onSetFailure(p0: String?) {}
        }, constraints)
    }

    private fun listenForAnswer(targetDeviceId: String, myDeviceId: String) {
        val uid = auth.currentUser?.uid ?: return
        val callPath = "calls/$uid/${myDeviceId}_to_${targetDeviceId}"
        db.getReference(callPath).child("answer")
            .addValueEventListener(object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    val sdpStr = snapshot.child("sdp").getValue(String::class.java) ?: return

                    if (sdpStr == processedRemoteSdp) return
                    processedRemoteSdp = sdpStr

                    val sdp = SessionDescription(SessionDescription.Type.ANSWER, sdpStr)
                    peerConnection?.setRemoteDescription(object : SimpleSdpObserver() {
                        override fun onSetSuccess() {
                            drainIceCandidates()
                        }
                    }, sdp)
                }

                override fun onCancelled(error: DatabaseError) {}
            })
    }

    private fun drainIceCandidates() {
        Log.d(TAG, "Remote Description sukses dipasang. Memproses antrean ICE...")
        pendingIceCandidates.forEach {
            peerConnection?.addIceCandidate(it)
            Log.d(TAG, "Pending ICE candidate berhasil ditambahkan")
        }
        pendingIceCandidates.clear()
    }

    private fun sendIceCandidateToFirebase(
        targetDeviceId: String,
        myDeviceId: String,
        candidate: IceCandidate,
        isInitiator: Boolean
    ) {
        val uid = auth.currentUser?.uid ?: return
        val path =
            if (isInitiator) "${myDeviceId}_to_${targetDeviceId}/offerCandidates" else "${targetDeviceId}_to_${myDeviceId}/answerCandidates"
        val candidateMap = mapOf(
            "sdpMid" to candidate.sdpMid,
            "sdpMLineIndex" to candidate.sdpMLineIndex,
            "candidate" to candidate.sdp
        )
        db.getReference("calls/$uid/$path").push().setValue(candidateMap)
    }

    fun sendBinary(bytes: ByteArray): Boolean {
        if (dataChannel?.state() == DataChannel.State.OPEN) {
            markActivity()
            val buffer = ByteBuffer.wrap(bytes)
            return dataChannel?.send(DataChannel.Buffer(buffer, true)) ?: false
        }
        return false
    }

    fun getBufferedAmount(): Long = dataChannel?.bufferedAmount() ?: 0L

    suspend fun awaitBufferedAmountDrained(timeoutMs: Long = 10_000) {
        val start = System.currentTimeMillis()
        while (getBufferedAmount() > 0) {
            if (System.currentTimeMillis() - start > timeoutMs) {
                Log.w(TAG, "Timeout nunggu buffer kosong, lanjut close paksa.")
                return
            }
            kotlinx.coroutines.delay(50.milliseconds)
        }
    }

    fun closeConnection() {
        try {
            idleWatcherJob?.cancel()
            if (wifiLock.isHeld) wifiLock.release()
            if (wakeLock.isHeld) wakeLock.release()
            addedIceCandidates.clear()
            processedRemoteSdp = null
            pendingIceCandidates.clear()
            dataChannel?.close()
            dataChannel?.dispose()
            peerConnection?.close()
            peerConnection?.dispose()
            dataChannel = null
            peerConnection = null
            resetHandleCalls()
            Log.d(TAG, "Sesi koneksi P2P ditutup (factory tetap hidup).")
        } catch (e: Exception) {
            Log.e(TAG, "Error closing connection", e)
        }
    }

    /** Releases the active connection and the WebRTC factory. */
    fun shutdown() {
        try {
            closeConnection()
            peerConnectionFactory?.dispose()
            peerConnectionFactory = null
            Log.d(TAG, "WebRTC resources cleaned up successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Error during shutdown", e)
        }
    }

    /** Backward-compatible alias for callers that still use the old name. */
    fun close() = shutdown()
}

open class SimpleSdpObserver : SdpObserver {
    override fun onCreateSuccess(p0: SessionDescription?) {}
    override fun onSetSuccess() {}
    override fun onCreateFailure(p0: String?) {}
    override fun onSetFailure(p0: String?) {}

}