import {
  child,
  DataSnapshot,
  onChildAdded,
  onChildChanged,
  onValue,
  push,
  ref,
  set,
} from "firebase/database";
import { db } from "../firebase/firebase";

const configuration: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

interface IncomingFileMeta {
  name: string;
  size: number;
  mimeType: string;
}

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private incomingMeta: IncomingFileMeta | null = null;
  private incomingChunks: ArrayBuffer[] = [];
  private callSignalUnsubscribes: Array<() => void> = [];
  private activeCallId: string | null = null;

  // Callback buat UI (HomePage) nampilin status ke user — INI YANG SEBELUMNYA
  // GA ADA, makanya kirim/gagal ga ada pemberitahuan sama sekali.
  public onConnectionOpen?: () => void;
  public onFileReceived?: (file: Blob, meta: IncomingFileMeta) => void;
  public onClipboardReceived?: (text: string) => void;
  public onError?: (message: string) => void;

  public onConnectionStateChange?: (connected: boolean) => void;
  private handledOffers = new Map<string, string>();
  private incomingCallUnsubscribes: Array<() => void> = [];

  private negotiationState: "idle" | "connecting" | "connected" | "failed" =
    "idle";

  private clearCallSignalListeners() {
    this.callSignalUnsubscribes.forEach((unsubscribe) => unsubscribe());
    this.callSignalUnsubscribes = [];
  }

  private setupDataChannelHandlers() {
    if (!this.dataChannel) return;
    const channel = this.dataChannel;

    channel.onopen = () => {
      console.log("✅ WebRTC DataChannel OPEN");
      console.log("DataChannel OPEN");
      this.negotiationState = "connected";
      this.onConnectionOpen?.();
      this.onConnectionStateChange?.(true);
    };
    channel.onclose = () => {
      console.log("DataChannel CLOSED");
      if (this.negotiationState !== "failed") this.negotiationState = "idle";
      this.onConnectionStateChange?.(false);
    };
    channel.onerror = (event) => {
      const error = event.error;
      const isExpectedClose =
        channel.readyState === "closing" ||
        channel.readyState === "closed" ||
        (error.name === "OperationError" &&
          (error.message.includes("User-Initiated Abort") ||
            error.message.includes("Close called")));

      if (isExpectedClose) {
        console.info("DataChannel ditutup normal.");
        return;
      }

      console.error("DataChannel error:", event);
      this.onError?.("Koneksi P2P terputus atau error.");
    };
    channel.onmessage = async (event) => {
      if (typeof event.data === "string") {
        try {
          const parsed = JSON.parse(event.data);
          console.log("Pesan diterima di PC:", parsed);

          if (parsed.type === "file-meta") {
            this.incomingMeta = parsed;
            this.incomingChunks = [];
          } else if (parsed.type === "clipboard" || parsed.t === "clipboard") {
            const textContent = parsed.payload || parsed.p || parsed.content;
            if (textContent) {
              await window.electronAPI.writeClipboard(textContent);
              this.onClipboardReceived?.(textContent);
              console.log("Clipboard berhasil diperbarui di PC!");
            }
          }
        } catch (err) {
          console.error("Gagal parse data WebRTC:", err);
        }
      } else {
        // Data biner = isi file (untuk versi sederhana ini dikirim sekali utuh,
        // bukan per-chunk — cukup untuk file kecil/menengah dulu)
        this.incomingChunks.push(event.data as ArrayBuffer);
        if (this.incomingMeta) {
          const blob = new Blob(this.incomingChunks, {
            type: this.incomingMeta.mimeType,
          });
          this.onFileReceived?.(blob, this.incomingMeta);
          this.incomingMeta = null;
          this.incomingChunks = [];
        }
      }
    };
  }

  private trackIceState(peerConnection: RTCPeerConnection) {
    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log("ICE state:", state);
      if (this.peerConnection !== peerConnection) return; // koneksi lama, abaikan

      if (state === "checking") {
        this.negotiationState = "connecting";
      } else if (state === "connected" || state === "completed") {
        // SENGAJA TIDAK di-set "connected" di sini. ICE connected cuma
        // berarti jalur network-nya nyambung — datachannel (SCTP) masih
        // proses handshake terpisah setelah ini, butuh waktu tambahan.
        // Kalau negotiationState di-set "connected" di titik ini,
        // canAttemptReconnect() bakal nganggep "boleh coba lagi" padahal
        // datachannel-nya BELUM open, jadi auto-reconnect bisa nutup
        // koneksi yang hampir jadi ini sebelum sempat kebuka beneran.
        // Biarkan tetap "connecting" sampai channel.onopen beneran fire.
      } else if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed"
      ) {
        this.negotiationState = "failed";
        this.onConnectionStateChange?.(false);
      }
    };
  }

  public isConnected(): boolean {
    return this.dataChannel?.readyState === "open";
  }

  /**
   * Dipakai UI (misal auto-reconnect interval) buat nanya "boleh ga gue coba
   * connect ulang sekarang?". Jawabannya TIDAK kalau lagi belum konek TAPI
   * masih dalam proses checking/connecting — supaya proses itu dikasih
   * kesempatan selesai dulu, bukan langsung dipotong & diulang dari nol.
   */
  public canAttemptReconnect(): boolean {
    if (this.isConnected()) return false;
    return this.negotiationState !== "connecting";
  }

  public async waitForConnection(timeoutMs = 15_000): Promise<void> {
    if (this.isConnected()) return;

    const channel = this.dataChannel;
    if (!channel || channel.readyState === "closed") {
      throw new Error("Koneksi P2P belum dibuat.");
    }

    await new Promise<void>((resolve, reject) => {
      const interval = window.setInterval(() => {
        if (channel.readyState === "open") {
          window.clearInterval(interval);
          window.clearTimeout(timeout);
          resolve();
        } else if (channel.readyState === "closed") {
          window.clearInterval(interval);
          window.clearTimeout(timeout);
          reject(new Error("Koneksi P2P tertutup."));
        }
      }, 100);
      const timeout = window.setTimeout(() => {
        window.clearInterval(interval);
        reject(new Error("Waktu tunggu koneksi P2P habis."));
      }, timeoutMs);
    });
  }

  async createOffer(
    userId: string,
    targetDeviceId: string,
    myDeviceId: string,
    force = false,
  ) {
    const callId = `${myDeviceId}_to_${targetDeviceId}`;
    const channelIsActive =
      this.dataChannel?.readyState === "connecting" ||
      this.dataChannel?.readyState === "open";

    if (!force && this.negotiationState === "connecting") return;
    if (!force && this.activeCallId === callId && channelIsActive) return;

    this.negotiationState = "connecting";
    this.clearCallSignalListeners();
    this.peerConnection?.close();
    const peerConnection = new RTCPeerConnection(configuration);
    this.peerConnection = peerConnection;
    this.activeCallId = callId;
    this.dataChannel = peerConnection.createDataChannel("orbit-transfer");
    this.setupDataChannelHandlers();
    const callRef = ref(db, `calls/${userId}/${callId}`);
    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate)
        void set(push(child(callRef, "offerCandidates")), candidate.toJSON());
    };

    this.trackIceState(peerConnection);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await set(callRef, { offer: { type: offer.type, sdp: offer.sdp } });
    let isApplyingAnswer = false;
    const pendingAnswerCandidates: RTCIceCandidateInit[] = [];
    const addAnswerCandidate = async (candidate: RTCIceCandidateInit) => {
      if (!peerConnection.remoteDescription) {
        pendingAnswerCandidates.push(candidate);
        return;
      }

      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.error("Gagal menambahkan ICE candidate answer:", error);
      }
    };
    const stopAnswerListener = onValue(
      child(callRef, "answer"),
      async (snapshot) => {
        const answer = snapshot.val();
        if (
          !answer ||
          isApplyingAnswer ||
          this.peerConnection !== peerConnection ||
          peerConnection.signalingState !== "have-local-offer"
        )
          return;

        isApplyingAnswer = true;
        try {
          await peerConnection.setRemoteDescription(answer);
          await Promise.all(
            pendingAnswerCandidates.splice(0).map(addAnswerCandidate),
          );
        } catch (error) {
          console.error("Gagal menerapkan WebRTC answer:", error);
          this.onError?.("Gagal menyambungkan perangkat.");
        } finally {
          isApplyingAnswer = false;
        }
      },
    );
    this.callSignalUnsubscribes.push(stopAnswerListener);
    const stopAnswerCandidatesListener = onChildAdded(
      child(callRef, "answerCandidates"),
      (snapshot) => {
        if (this.peerConnection === peerConnection)
          void addAnswerCandidate(snapshot.val());
      },
    );
    this.callSignalUnsubscribes.push(stopAnswerCandidatesListener);
  }

  /**
   * PENTING — bagian yang sebelumnya HILANG TOTAL: dengerin ada panggilan
   * masuk (device lain bikin offer ke kita), lalu otomatis jawab (answer).
   * Panggil ini SEKALI aja pas app mulai & user udah login, ga perlu nunggu
   * user pilih device dulu — supaya PC selalu siap "ngangkat telepon".
   */

  listenForIncomingCalls(userId: string, myDeviceId: string) {
    this.incomingCallUnsubscribes.forEach((unsubscribe) => unsubscribe());
    this.incomingCallUnsubscribes = [];

    const callsRef = ref(db, `calls/${userId}`);
    const suffix = `_to_${myDeviceId}`;

    const handleSnapshot = (snapshot: DataSnapshot) => {
      const callId = snapshot.key;
      if (!callId?.endsWith(suffix)) return;
      const data = snapshot.val();
      const offer = data?.offer;
      if (!offer?.sdp) return;

      if (this.handledOffers.get(callId) === offer.sdp) return; // offer ini udah dijawab

      this.handledOffers.set(callId, offer.sdp);
      void this.answerCall(userId, callId, offer);
    };

    this.incomingCallUnsubscribes.push(onChildAdded(callsRef, handleSnapshot));
    this.incomingCallUnsubscribes.push(
      onChildChanged(callsRef, handleSnapshot),
    );
  }

  private async answerCall(
    userId: string,
    callId: string,
    offer: RTCSessionDescriptionInit,
  ) {
    this.negotiationState = "connecting";
    this.clearCallSignalListeners();
    this.peerConnection?.close();
    const peerConnection = new RTCPeerConnection(configuration);
    this.peerConnection = peerConnection;
    this.activeCallId = callId;

    peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers();
    };

    this.trackIceState(peerConnection);

    const callRef = ref(db, `calls/${userId}/${callId}`);
    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate)
        void set(push(child(callRef, "answerCandidates")), candidate.toJSON());
    };

    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await set(child(callRef, "answer"), {
      type: answer.type,
      sdp: answer.sdp,
    });

    const stopOfferCandidatesListener = onChildAdded(
      child(callRef, "offerCandidates"),
      (snapshot) => {
        if (this.peerConnection === peerConnection)
          void peerConnection.addIceCandidate(snapshot.val());
      },
    );
    this.callSignalUnsubscribes.push(stopOfferCandidatesListener);
  }

  sendFile(file: File) {
    if (this.dataChannel?.readyState !== "open") {
      this.onError?.("Koneksi P2P belum terbuka. Coba pilih ulang device-nya.");
      throw new Error("Koneksi P2P belum terbuka.");
    }
    this.dataChannel.send(
      JSON.stringify({
        type: "file-meta",
        name: file.name,
        size: file.size,
        mimeType: file.type,
      }),
    );
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) this.dataChannel?.send(reader.result as ArrayBuffer);
    };
    reader.onerror = () => this.onError?.("Gagal membaca file.");
    reader.readAsArrayBuffer(file);
  }
}

export const webRTCService = new WebRTCService();
