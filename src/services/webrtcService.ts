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

  public onSendProgress?: (fileName: string, percent: number) => void;
  public onSendComplete?: (
    fileName: string,
    success: boolean,
    error?: string,
  ) => void;
  public onReceiveProgress?: (fileName: string, percent: number) => void;
  public onReceiveComplete?: (
    fileName: string,
    success: boolean,
    error?: string,
  ) => void;

  private incomingBytesReceived = 0;
  private lastReceivedPercent = -1;

  private handledOffers = new Map<string, string>();
  private incomingCallUnsubscribes: Array<() => void> = [];

  private negotiationState: "idle" | "connecting" | "connected" | "failed" =
    "idle";

  private isTransferring = false;

  // Watchdog untuk ICE "checking" yang tersangkut dan grace period untuk
  // status "disconnected" yang biasanya hanya gangguan jaringan sesaat.
  private checkingWatchdogTimer: number | null = null;
  private disconnectGraceTimer: number | null = null;

  private clearIceWatchdogs() {
    if (this.checkingWatchdogTimer !== null) {
      window.clearTimeout(this.checkingWatchdogTimer);
      this.checkingWatchdogTimer = null;
    }
    if (this.disconnectGraceTimer !== null) {
      window.clearTimeout(this.disconnectGraceTimer);
      this.disconnectGraceTimer = null;
    }
  }

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
      this.isTransferring = false
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
            this.incomingBytesReceived = 0;
            this.lastReceivedPercent = -1;
            this.isTransferring = true;
            this.onReceiveProgress?.(parsed.name, 0);
          } else if (parsed.type === "file-complete") {
            // PENTING: sebelumnya PC nganggep "sekali dapet data biner =
            // file selesai" — cuma cocok kalau pengirim kirim sekaligus
            // dalam satu potongan. Mobile sekarang kirim per-chunk 16KB
            // + sinyal "file-complete" di akhir, jadi kalau PC masih pakai
            // logika lama, file yang diterima dari HP bakal kepotong cuma
            // 16KB pertama doang. Sekarang PC nunggu sinyal ini dulu baru
            // menganggap file-nya lengkap.
            if (this.incomingMeta) {
              const meta = this.incomingMeta;
              const blob = new Blob(this.incomingChunks, {
                type: meta.mimeType,
              });
              this.onFileReceived?.(blob, meta);
              this.onReceiveComplete?.(meta.name, true);
            }
            this.incomingMeta = null;
            this.incomingChunks = [];
            this.incomingBytesReceived = 0;
            this.isTransferring = false;
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
        // Data biner = satu potongan (chunk) isi file. Ditumpuk dulu di
        // this.incomingChunks, baru digabung jadi Blob pas sinyal
        // "file-complete" diterima (lihat blok string di atas).
        const chunk = event.data as ArrayBuffer;
        this.incomingChunks.push(chunk);
        this.incomingBytesReceived += chunk.byteLength;

        if (this.incomingMeta && this.incomingMeta.size > 0) {
          const percent = Math.min(
            100,
            Math.round(
              (this.incomingBytesReceived / this.incomingMeta.size) * 100,
            ),
          );
          if (percent !== this.lastReceivedPercent) {
            this.lastReceivedPercent = percent;
            this.onReceiveProgress?.(this.incomingMeta.name, percent);
          }
        }
      }
    };
  }

  private trackIceState(peerConnection: RTCPeerConnection) {
    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log("ICE state:", state);
      if (this.peerConnection !== peerConnection) return;

      // Timer state sebelumnya tidak lagi relevan setelah ICE state berubah.
      this.clearIceWatchdogs();

      if (state === "checking") {
        this.negotiationState = "connecting";
        // ICE dapat berhenti di "checking" tanpa berpindah ke "failed".
        // Lepaskan state connecting agar auto-reconnect dapat mencoba lagi.
        this.checkingWatchdogTimer = window.setTimeout(() => {
          if (this.peerConnection !== peerConnection) return;
          if (peerConnection.iceConnectionState === "checking") {
            console.warn(
              "ICE terlalu lama di 'checking'; koneksi akan dicoba ulang.",
            );
            this.negotiationState = "failed";
            this.onConnectionStateChange?.(false);
          }
        }, 12_000);
      } else if (state === "connected" || state === "completed") {
        // SENGAJA TIDAK di-set "connected" di sini. ICE connected cuma
        // berarti jalur network-nya nyambung — datachannel (SCTP) masih
        // proses handshake terpisah setelah ini, butuh waktu tambahan.
        // Kalau negotiationState di-set "connected" di titik ini,
        // canAttemptReconnect() bakal nganggep "boleh coba lagi" padahal
        // datachannel-nya BELUM open, jadi auto-reconnect bisa nutup
        // koneksi yang hampir jadi ini sebelum sempat kebuka beneran.
        // Biarkan tetap "connecting" sampai channel.onopen beneran fire.
      } else if (state === "disconnected") {
        // Jangan langsung gagal: state ini sering pulih sendiri setelah
        // gangguan jaringan singkat, sehingga menghindari reconnect flapping.
        // Kalau lagi ada transfer aktif, kasih grace period JAUH lebih
        // panjang — transfer file (apalagi yang gede) sendiri bisa bikin
        // ICE sempat "disconnected" sesaat karena jalur network lagi sibuk,
        // itu bukan berarti koneksinya beneran putus.
        const graceMs = this.isTransferring ? 15_000 : 4_000;
        this.disconnectGraceTimer = window.setTimeout(() => {
          if (this.peerConnection !== peerConnection) return;
          if (peerConnection.iceConnectionState === "disconnected") {
            this.negotiationState = "failed";
            this.onConnectionStateChange?.(false);
          }
        }, graceMs);
      } else if (state === "failed" || state === "closed") {
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
   * JUGA tidak boleh kalau lagi ada transfer aktif — reconnect di tengah
   * transfer = motong peerConnection yang lagi dipakai ngirim/nerima file.
   */
  public canAttemptReconnect(): boolean {
    if (this.isTransferring) return false;
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
    // JANGAN PERNAH motong koneksi yang lagi dipakai transfer aktif, bahkan
    // dengan force=true — force cuma buat "user maksa reconnect manual",
    // dan itu ga masuk akal kalau lagi ada file yang lagi jalan dikirim.
    if (this.isTransferring) return;

    const callId = `${myDeviceId}_to_${targetDeviceId}`;
    const channelIsActive =
      this.dataChannel?.readyState === "connecting" ||
      this.dataChannel?.readyState === "open";

    if (!force && this.negotiationState === "connecting") return;
    if (!force && this.activeCallId === callId && channelIsActive) return;

    this.negotiationState = "connecting";
    this.clearCallSignalListeners();
    this.clearIceWatchdogs();
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
    // Sama kayak createOffer: jangan nyambut offer baru (yang bakal nutup
    // peerConnection sekarang) kalau lagi ada transfer aktif jalan.
    if (this.isTransferring) return;

    this.negotiationState = "connecting";
    this.clearCallSignalListeners();
    this.clearIceWatchdogs();
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

  async sendFile(file: File): Promise<void> {
    const channel = this.dataChannel;
    if (channel?.readyState !== "open") {
      this.onError?.("Koneksi P2P belum terbuka. Coba pilih ulang device-nya.");
      throw new Error("Koneksi P2P belum terbuka.");
    }

    this.isTransferring = true;
    channel.send(
      JSON.stringify({
        type: "file-meta",
        name: file.name,
        size: file.size,
        mimeType: file.type,
      }),
    );
    this.onSendProgress?.(file.name, 0);

    // Kirim per-chunk 16KB (samain sama sisi mobile) supaya: (1) progress
    // bisa dilaporkan bertahap, bukan cuma "0%" lalu tiba-tiba "selesai",
    // dan (2) file besar ga bikin datachannel keteteran ngirim satu blob
    // raksasa sekaligus.
    const CHUNK_SIZE = 16 * 1024;
    let offset = 0;
    let lastReportedPercent = -1;

    try {
      while (offset < file.size) {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();

        // Backpressure: kalau buffer channel udah kebanyakan antrean,
        // tunggu dulu. THRESHOLD DITURUNIN dari 8MB ke 256KB — 8MB
        // kegedean, bikin ratusan chunk numpuk sekaligus di socket tanpa
        // jeda ke event loop, yang berpotensi "menenggelamkan" paket
        // keep-alive ICE di jaringan lambat/NAT ketat sampai dianggap
        // putus (disconnected). Threshold lebih kecil = lebih sering
        // ngasih jeda ke browser buat proses hal lain (termasuk ICE).
        while (channel.bufferedAmount > 256 * 1024) {
          await new Promise((resolve) => window.setTimeout(resolve, 10));
        }

        channel.send(buffer);
        offset += buffer.byteLength;

        if (file.size > 0) {
          const percent = Math.min(100, Math.round((offset / file.size) * 100));
          if (percent !== lastReportedPercent) {
            lastReportedPercent = percent;
            this.onSendProgress?.(file.name, percent);
          }
        }
      }

      channel.send(JSON.stringify({ type: "file-complete" }));
      this.onSendComplete?.(file.name, true);
    } catch (error) {
      console.error("Gagal mengirim file:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      this.onSendComplete?.(file.name, false, message);
      throw error;
    } finally {
      this.isTransferring = false;
    }
  }
}

export const webRTCService = new WebRTCService();
