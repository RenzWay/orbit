/**
 * WebRTCService — orkestrator utama koneksi P2P Orbit di PC.
 *
 * Tanggung jawabnya CUMA: ngatur siklus hidup satu `RTCPeerConnection` +
 * `RTCDataChannel` (bikin, negosiasi, jaga statusnya, tutup), dan
 * ngirim/nerima file & clipboard lewat data channel itu. Detail-detail
 * lain sengaja dipisah ke modul sendiri supaya file ini gampang dibaca
 * dari atas ke bawah:
 *
 *   - `iceConfig.ts`            → daftar STUN/TURN server
 *   - `iceWatchdog.ts`          → kapan ICE dianggap "macet"/"gagal"
 *   - `signaling.ts`            → baca/tulis SDP & ICE candidate ke Firebase
 *   - `fileTransferProtocol.ts` → format pesan kirim/terima file
 *   - `types.ts`                → tipe-tipe yang dipakai bareng
 *
 * ALUR KONEKSI SINGKATNYA (baca ini dulu sebelum ubah kode di bawah):
 *
 *   Device A (createOffer)                    Device B (listenForIncomingCalls)
 *   ───────────────────────                    ─────────────────────────────
 *   1. Bikin RTCPeerConnection + data channel
 *   2. createOffer() + setLocalDescription()
 *   3. Tulis offer ke Firebase          ────▶  4. Denger offer baru masuk
 *                                               5. answerCall(): bikin
 *                                                  RTCPeerConnection sendiri,
 *                                                  setRemoteDescription(offer)
 *                                               6. createAnswer() + setLocal
 *                                        ◀────  7. Tulis answer ke Firebase
 *   8. Denger answer masuk,
 *      setRemoteDescription(answer)
 *   9. ICE candidate ditukar dua arah lewat Firebase selama proses ini
 *      (trickle ICE — dikirim begitu ketemu, ga nunggu gathering selesai)
 *   10. RTCDataChannel.onopen() nyala di kedua sisi → BARU dianggap
 *       "beneran konek" (lihat NegotiationState di types.ts kenapa ini
 *       dipisah dari status ICE)
 *
 * Kalau mau nambah fitur baru yang butuh "tau kapan device lain
 * kekirim data" — pasang di `setupDataChannelHandlers()`. Kalau mau
 * ubah CARA dua device saling ketemu (ganti dari Firebase) — itu
 * tugasnya `signaling.ts`, bukan file ini.
 */

import {
  BACKPRESSURE_THRESHOLD_BYTES,
  buildFileMetaMessage,
  CHUNK_SIZE_BYTES,
  extractClipboardText,
  FILE_COMPLETE_MESSAGE,
} from "./webRtc/fileTransferProtocol";
import { rtcConfiguration } from "./webRtc/iceConfig";
import { IceWatchdog } from "./webRtc/iceWatchdog";
import {
  buildCallId,
  listenForAnswer,
  listenForAnswerCandidates,
  listenForIncomingOffers,
  listenForOfferCandidates,
  pushAnswerCandidate,
  pushOfferCandidate,
  writeAnswer,
  writeOffer,
} from "./webRtc/signaling";
import type {
  IncomingFileMeta,
  NegotiationState,
  WebRTCEventHandlers,
} from "./webRtc/types";

export type { IncomingFileMeta } from "./webRtc/types";

class WebRTCService implements WebRTCEventHandlers {
  // ---- Koneksi aktif saat ini -------------------------------------------
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private activeCallId: string | null = null;
  private iceWatchdog = new IceWatchdog();

  /**
   * Status kasar negosiasi (lihat `NegotiationState` di types.ts).
   * Sumber kebenaran buat `canAttemptReconnect()`.
   */
  private negotiationState: NegotiationState = "idle";

  /**
   * Lagi ada transfer file aktif (kirim ATAU terima) atau enggak.
   * Selama ini `true`, TIDAK ADA yang boleh menutup/mengganti
   * peerConnection yang sedang aktif — reconnect di tengah transfer
   * cuma bakal motong data yang lagi mengalir. Lihat pemakaiannya di
   * `createOffer()`, `answerCall()`, `canAttemptReconnect()`, dan
   * grace period `IceWatchdog`.
   */
  private isTransferring = false;

  /** Buat lepas listener Firebase punya sesi call yang lagi aktif (offer/answer/candidates). */
  private stopCallSignalListeners: Array<() => void> = [];
  /** Buat lepas listener "ada panggilan masuk" — beda siklus hidup dari yang di atas. */
  private stopIncomingCallsListener: (() => void) | null = null;

  // ---- State penerimaan file yang lagi berlangsung -----------------------
  private incomingMeta: IncomingFileMeta | null = null;
  private incomingChunks: ArrayBuffer[] = [];
  private incomingBytesReceived = 0;
  private lastReceivedPercent = -1;

  // ---- Callback yang dipasang UI ------------------------------------------
  public onConnectionOpen?: () => void;
  public onConnectionStateChange?: (connected: boolean) => void;
  public onFileReceived?: (file: Blob, meta: IncomingFileMeta) => void;
  public onClipboardReceived?: (text: string) => void;
  public onError?: (message: string) => void;
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

  // =========================================================================
  // Query status — dipakai UI buat nampilin indikator & mutusin auto-reconnect
  // =========================================================================

  /** Data channel P2P beneran kebuka & siap kirim/terima data. */
  public isConnected(): boolean {
    return this.dataChannel?.readyState === "open";
  }

  /**
   * "Boleh gak gue coba connect ulang sekarang?" — dipakai auto-reconnect
   * interval di UI. `false` dalam 3 kondisi:
   *   1. Lagi ada transfer file aktif (jangan diganggu).
   *   2. Udah konek (gak perlu reconnect).
   *   3. Lagi proses connecting/checking (kasih kesempatan selesai dulu,
   *      jangan dipotong & diulang dari nol).
   */
  public canAttemptReconnect(): boolean {
    if (this.isTransferring) return false;
    if (this.isConnected()) return false;
    return this.negotiationState !== "connecting";
  }

  /** Nunggu sampai data channel `"open"`, atau reject kalau timeout/ketutup. */
  public async waitForConnection(timeoutMs = 15_000): Promise<void> {
    if (this.isConnected()) return;

    const channel = this.dataChannel;
    if (!channel || channel.readyState === "closed") {
      throw new Error("Koneksi P2P belum dibuat.");
    }

    await new Promise<void>((resolve, reject) => {
      const pollInterval = window.setInterval(() => {
        if (channel.readyState === "open") {
          cleanup();
          resolve();
        } else if (channel.readyState === "closed") {
          cleanup();
          reject(new Error("Koneksi P2P tertutup."));
        }
      }, 100);
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Waktu tunggu koneksi P2P habis."));
      }, timeoutMs);
      const cleanup = () => {
        window.clearInterval(pollInterval);
        window.clearTimeout(timeout);
      };
    });
  }

  // =========================================================================
  // Memulai / menjawab panggilan
  // =========================================================================

  /**
   * Mulai koneksi P2P ke `targetDeviceId` (kita jadi pihak yang bikin
   * offer). Aman dipanggil berkali-kali — ada 3 guard yang bikin ini
   * jadi no-op kalau gak perlu:
   *
   *   - Lagi ada transfer aktif → selalu ditolak, TERMASUK kalau `force`.
   *     Reconnect paksa di tengah transfer gak masuk akal.
   *   - Lagi proses connecting → ditolak kecuali `force`, biar proses
   *     yang jalan gak keputus percuma.
   *   - Udah ada koneksi aktif & sehat ke device yang sama → ditolak
   *     kecuali `force`, biar gak bikin ulang dari nol tanpa alasan.
   *
   * @param force - Lewatin guard "lagi connecting" & "udah konek ke
   *   device yang sama". Dipakai tombol "reconnect manual" di UI.
   *   TETAP gak bisa lewatin guard "lagi transfer aktif".
   */
  public async createOffer(
    userId: string,
    targetDeviceId: string,
    myDeviceId: string,
    force = false,
  ): Promise<void> {
    if (this.isTransferring) return;

    const callId = buildCallId(myDeviceId, targetDeviceId);
    const alreadyActiveToSameDevice =
      this.activeCallId === callId &&
      (this.dataChannel?.readyState === "connecting" ||
        this.dataChannel?.readyState === "open");

    if (!force && this.negotiationState === "connecting") return;
    if (!force && alreadyActiveToSameDevice) return;

    const peerConnection = this.startFreshPeerConnection(callId);
    this.dataChannel = peerConnection.createDataChannel("orbit-transfer");
    this.setupDataChannelHandlers();

    peerConnection.onicecandidate = ({ candidate }) => {
      // .toJSON() WAJIB: RTCIceCandidate itu instance class (ada getter,
      // bukan object polos), Firebase set() butuh data yang bisa
      // di-serialize jadi JSON biasa.
      if (candidate)
        void pushOfferCandidate(userId, callId, candidate.toJSON());
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await writeOffer(userId, callId, offer);

    this.listenForAnswerAndCandidates(userId, callId, peerConnection);
  }

  /**
   * Dengerin panggilan masuk (device lain bikin offer ke kita) dan
   * otomatis jawab. Panggil ini SEKALI aja pas app mulai & user udah
   * login — jangan nunggu user pilih device dulu, supaya PC selalu
   * siap "ngangkat telepon" kapan aja.
   *
   * Aman dipanggil berkali-kali (mis. React StrictMode yang nge-run
   * effect dua kali di dev mode): listener lama otomatis dilepas dulu
   * sebelum yang baru dipasang, jadi gak numpuk.
   */
  public listenForIncomingCalls(userId: string, myDeviceId: string) {
    this.stopIncomingCallsListener?.();
    this.stopIncomingCallsListener = listenForIncomingOffers(
      userId,
      myDeviceId,
      (callId, offer) => {
        void this.answerIncomingCall(userId, callId, offer);
      },
    );
  }

  /** Jawab satu offer yang masuk: bikin RTCPeerConnection sendiri, balas dengan answer. */
  private async answerIncomingCall(
    userId: string,
    callId: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    // Sama kayak createOffer(): jangan nyambut panggilan baru (yang
    // bakal nutup peerConnection sekarang) kalau lagi ada transfer aktif.
    if (this.isTransferring) return;

    const peerConnection = this.startFreshPeerConnection(callId);

    peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers();
    };
    peerConnection.onicecandidate = ({ candidate }) => {
      // .toJSON() WAJIB — lihat catatan di createOffer() di atas.
      if (candidate)
        void pushAnswerCandidate(userId, callId, candidate.toJSON());
    };

    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await writeAnswer(userId, callId, answer);

    this.stopCallSignalListeners.push(
      listenForOfferCandidates(userId, callId, (candidate) => {
        if (this.peerConnection === peerConnection) {
          void peerConnection.addIceCandidate(candidate);
        }
      }),
    );
  }

  /**
   * Bagian yang SAMA antara `createOffer()` dan `answerIncomingCall()`:
   * tutup koneksi lama (kalau ada), bikin `RTCPeerConnection` baru,
   * dan pasang pelacakan status ICE-nya. Dipanggil di awal kedua alur
   * di atas supaya gak ada duplikasi setup.
   */
  private startFreshPeerConnection(callId: string): RTCPeerConnection {
    this.negotiationState = "connecting";
    this.stopCallSignalListeners.forEach((unsubscribe) => unsubscribe());
    this.stopCallSignalListeners = [];
    this.iceWatchdog.clear();
    this.peerConnection?.close();

    const peerConnection = new RTCPeerConnection(rtcConfiguration);
    this.peerConnection = peerConnection;
    this.activeCallId = callId;
    this.trackIceConnectionState(peerConnection);
    return peerConnection;
  }

  /**
   * Sisi `createOffer()` doang: setelah offer ditulis, dengerin balasan
   * `answer` + ICE candidate dari lawan bicara. Candidate yang datang
   * SEBELUM `setRemoteDescription(answer)` selesai ditampung dulu di
   * `pendingAnswerCandidates` (browser gak mau `addIceCandidate()`
   * sebelum remote description ke-set).
   */
  private listenForAnswerAndCandidates(
    userId: string,
    callId: string,
    peerConnection: RTCPeerConnection,
  ) {
    let isApplyingAnswer = false;
    const pendingCandidates: RTCIceCandidateInit[] = [];

    const addCandidateNow = async (candidate: RTCIceCandidateInit) => {
      if (!peerConnection.remoteDescription) {
        pendingCandidates.push(candidate);
        return;
      }
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.error("Gagal menambahkan ICE candidate answer:", error);
      }
    };

    this.stopCallSignalListeners.push(
      listenForAnswer(userId, callId, async (answer) => {
        const isStaleEvent =
          isApplyingAnswer ||
          this.peerConnection !== peerConnection ||
          peerConnection.signalingState !== "have-local-offer";
        if (isStaleEvent) return;

        isApplyingAnswer = true;
        try {
          await peerConnection.setRemoteDescription(answer);
          await Promise.all(pendingCandidates.splice(0).map(addCandidateNow));
        } catch (error) {
          console.error("Gagal menerapkan WebRTC answer:", error);
          this.onError?.("Gagal menyambungkan perangkat.");
        } finally {
          isApplyingAnswer = false;
        }
      }),
    );

    this.stopCallSignalListeners.push(
      listenForAnswerCandidates(userId, callId, (candidate) => {
        if (this.peerConnection === peerConnection) {
          void addCandidateNow(candidate);
        }
      }),
    );
  }

  // =========================================================================
  // Pelacakan status ICE → negotiationState (pakai IceWatchdog)
  // =========================================================================

  private trackIceConnectionState(peerConnection: RTCPeerConnection) {
    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      console.log("ICE state:", state);
      if (this.peerConnection !== peerConnection) return; // koneksi lama, abaikan

      this.iceWatchdog.clear(); // timer state sebelumnya udah gak relevan

      switch (state) {
        case "checking":
          this.negotiationState = "connecting";
          this.iceWatchdog.watchChecking(
            () => this.peerConnection === peerConnection,
            () => {
              this.negotiationState = "failed";
              this.onConnectionStateChange?.(false);
            },
          );
          break;

        case "connected":
        case "completed":
          // SENGAJA TIDAK di-set "connected" di sini. ICE connected cuma
          // berarti jalur network-nya nyambung — data channel (SCTP)
          // masih proses handshake terpisah setelah ini. Kalau
          // negotiationState di-set "connected" di titik ini,
          // canAttemptReconnect() bakal nganggep "boleh coba lagi"
          // padahal data channel-nya BELUM open, jadi auto-reconnect
          // bisa nutup koneksi yang hampir jadi ini sebelum sempat
          // kebuka beneran. Biarkan tetap "connecting" sampai
          // `channel.onopen` beneran fire (lihat setupDataChannelHandlers).
          break;

        case "disconnected":
          // Jangan langsung nyerah — state ini sering pulih sendiri
          // habis gangguan jaringan singkat. Grace period-nya beda
          // kalau lagi ada transfer aktif (lihat IceWatchdog).
          this.iceWatchdog.watchDisconnected(
            () => this.peerConnection === peerConnection,
            () => peerConnection.iceConnectionState === "disconnected",
            this.isTransferring,
            () => {
              this.negotiationState = "failed";
              this.onConnectionStateChange?.(false);
            },
          );
          break;

        case "failed":
        case "closed":
          this.negotiationState = "failed";
          this.onConnectionStateChange?.(false);
          break;
      }
    };
  }

  // =========================================================================
  // Data channel: kirim & terima file/clipboard
  // =========================================================================

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
      this.isTransferring = false; // channel mati → transfer apapun otomatis gagal
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

    channel.onmessage = (event) => void this.handleIncomingMessage(event);
  }

  /** Router pesan masuk: string (JSON, kontrol) vs biner (isi chunk file). */
  private async handleIncomingMessage(event: MessageEvent): Promise<void> {
    if (typeof event.data !== "string") {
      this.handleIncomingFileChunk(event.data as ArrayBuffer);
      return;
    }

    // Try/catch-nya sengaja membungkus SELURUH proses (parse + dispatch),
    // bukan cuma JSON.parse — kalau salah satu handler di bawah (misalnya
    // handleIncomingClipboard yang manggil electronAPI.writeClipboard)
    // throw, itu tetap harus ketangkep di sini, bukan jadi unhandled
    // promise rejection yang bisa bikin data channel event handler error.
    try {
      const parsed = JSON.parse(event.data) as Record<string, unknown>;
      console.log("Pesan diterima di PC:", parsed);

      const messageType =
        parsed.type ?? (parsed.t === "clipboard" ? "clipboard" : undefined);

      switch (messageType) {
        case "file-meta":
          this.handleIncomingFileMeta(parsed as unknown as IncomingFileMeta);
          break;
        case "file-complete":
          this.handleIncomingFileComplete();
          break;
        case "clipboard":
          await this.handleIncomingClipboard(parsed);
          break;
      }
    } catch (err) {
      console.error("Gagal parse data WebRTC:", err);
    }
  }

  private handleIncomingFileMeta(meta: IncomingFileMeta) {
    this.incomingMeta = meta;
    this.incomingChunks = [];
    this.incomingBytesReceived = 0;
    this.lastReceivedPercent = -1;
    this.isTransferring = true;
    this.onReceiveProgress?.(meta.name, 0);
  }

  private handleIncomingFileChunk(chunk: ArrayBuffer) {
    this.incomingChunks.push(chunk);
    this.incomingBytesReceived += chunk.byteLength;

    if (!this.incomingMeta || this.incomingMeta.size <= 0) return;

    const percent = Math.min(
      100,
      Math.round((this.incomingBytesReceived / this.incomingMeta.size) * 100),
    );
    if (percent !== this.lastReceivedPercent) {
      this.lastReceivedPercent = percent;
      this.onReceiveProgress?.(this.incomingMeta.name, percent);
    }
  }

  private handleIncomingFileComplete() {
    // Baru di titik INI file dianggap lengkap & utuh — bukan pas chunk
    // biner pertama nyampe. Lihat penjelasan panjang di
    // `fileTransferProtocol.ts` kenapa ini penting.
    if (this.incomingMeta) {
      const meta = this.incomingMeta;
      const blob = new Blob(this.incomingChunks, { type: meta.mimeType });
      this.onFileReceived?.(blob, meta);
      this.onReceiveComplete?.(meta.name, true);
    }
    this.incomingMeta = null;
    this.incomingChunks = [];
    this.incomingBytesReceived = 0;
    this.isTransferring = false;
  }

  private async handleIncomingClipboard(parsed: Record<string, unknown>) {
    const text = extractClipboardText(parsed);
    if (!text) return;
    await window.electronAPI.writeClipboard(text);
    this.onClipboardReceived?.(text);
    console.log("Clipboard berhasil diperbarui di PC!");
  }

  /**
   * Kirim satu file lewat data channel, dipecah per-chunk
   * (`CHUNK_SIZE_BYTES`, samain sama sisi mobile — lihat
   * `fileTransferProtocol.ts`). Reject/throw kalau data channel belum
   * `"open"`.
   */
  public async sendFile(file: File): Promise<void> {
    const channel = this.dataChannel;
    if (channel?.readyState !== "open") {
      this.onError?.("Koneksi P2P belum terbuka. Coba pilih ulang device-nya.");
      throw new Error("Koneksi P2P belum terbuka.");
    }

    this.isTransferring = true;
    channel.send(buildFileMetaMessage(file));
    this.onSendProgress?.(file.name, 0);

    let offset = 0;
    let lastReportedPercent = -1;

    try {
      while (offset < file.size) {
        const chunk = await file
          .slice(offset, offset + CHUNK_SIZE_BYTES)
          .arrayBuffer();

        // Backpressure: kalau antrean kirim udah kebanyakan, jeda dulu.
        // Lihat penjelasan BACKPRESSURE_THRESHOLD_BYTES di
        // fileTransferProtocol.ts — ini bukan cuma soal hemat memory.
        while (channel.bufferedAmount > BACKPRESSURE_THRESHOLD_BYTES) {
          await new Promise((resolve) => window.setTimeout(resolve, 10));
        }

        channel.send(chunk);
        offset += chunk.byteLength;

        if (file.size > 0) {
          const percent = Math.min(100, Math.round((offset / file.size) * 100));
          if (percent !== lastReportedPercent) {
            lastReportedPercent = percent;
            this.onSendProgress?.(file.name, percent);
          }
        }
      }

      channel.send(FILE_COMPLETE_MESSAGE);
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
