import {
  child,
  onChildAdded,
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

  private clearCallSignalListeners() {
    this.callSignalUnsubscribes.forEach((unsubscribe) => unsubscribe());
    this.callSignalUnsubscribes = [];
  }

  private setupDataChannelHandlers() {
    if (!this.dataChannel) return;
    this.dataChannel.onopen = () => {
      console.log("✅ WebRTC DataChannel OPEN");
      console.log("DataChannel OPEN");
      this.onConnectionOpen?.();
    };
    this.dataChannel.onerror = (e) => {
      console.error("DataChannel error:", e);
      this.onError?.("Koneksi P2P terputus atau error.");
    };
    this.dataChannel.onmessage = async (event) => {
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

  public isConnected(): boolean {
    return this.dataChannel?.readyState === "open";
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
  ) {
    const callId = `${myDeviceId}_to_${targetDeviceId}`;
    const channelIsActive =
      this.dataChannel?.readyState === "connecting" ||
      this.dataChannel?.readyState === "open";

    if (this.activeCallId === callId && channelIsActive) return;

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

    peerConnection.oniceconnectionstatechange = () => {
      console.log("ICE state:", peerConnection.iceConnectionState);
    };

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
    const callsRef = ref(db, `calls/${userId}`);
    onChildAdded(callsRef, (snapshot) => {
      const callId = snapshot.key;
      if (!callId?.endsWith(`_to_${myDeviceId}`)) return;
      const data = snapshot.val();
      if (!data?.offer || data.answer) return; // bukan offer baru / udah dijawab
      void this.answerCall(userId, callId, data.offer);
    });
  }

  private async answerCall(
    userId: string,
    callId: string,
    offer: RTCSessionDescriptionInit,
  ) {
    this.clearCallSignalListeners();
    this.peerConnection?.close();
    const peerConnection = new RTCPeerConnection(configuration);
    this.peerConnection = peerConnection;
    this.activeCallId = callId;

    peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers();
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log("ICE state:", peerConnection.iceConnectionState);
    };

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
