/**
 * Tipe-tipe yang dipakai bareng-bareng di seluruh modul WebRTC Orbit.
 * Ditaruh di satu tempat supaya modul lain (signaling, protocol, watchdog,
 * service utama) gak perlu saling import cuma buat pinjem satu tipe.
 */

/** Metadata sebuah file yang dikirim lewat data channel, sebelum isinya nyusul. */
export interface IncomingFileMeta {
  name: string;
  size: number;
  mimeType: string;
}

/**
 * Status "kasar" negosiasi koneksi P2P yang kita jaga sendiri di
 * WebRTCService — BUKAN sama dengan `RTCIceConnectionState` bawaan
 * browser (`"new" | "checking" | "connected" | ...`). Ini abstraksi
 * yang lebih sederhana, dipakai UI (lewat `canAttemptReconnect()`)
 * buat mutusin boleh atau nggaknya coba connect ulang.
 *
 * - `idle`       — belum ada percobaan koneksi, atau koneksi sebelumnya
 *                  ditutup dengan normal. Aman buat mulai connect baru.
 * - `connecting` — offer/answer lagi ditukar dan/atau ICE lagi
 *                  checking. JANGAN diinterupsi oleh reconnect otomatis
 *                  — kasih kesempatan proses ini selesai dulu.
 * - `connected`  — RTCDataChannel BENERAN sudah berstatus `"open"`
 *                  (bukan cuma ICE-nya yang connected — handshake SCTP
 *                  di atasnya juga udah kelar). Lihat catatan panjang
 *                  di `iceWatchdog.ts` kenapa dua hal ini beda.
 * - `failed`     — ICE gagal total, macet kelamaan, atau channel
 *                  ketutup. Dari sini boleh coba reconnect lagi.
 */
export type NegotiationState = "idle" | "connecting" | "connected" | "failed";

/**
 * Semua callback yang bisa dipasang UI (lewat `webRTCService.onXxx = ...`)
 * buat dengerin event dari service ini. Semuanya opsional — UI cuma
 * pasang yang dia butuhin.
 */
export interface WebRTCEventHandlers {
  /** Data channel P2P baru aja kebuka (`readyState === "open"`). */
  onConnectionOpen?: () => void;
  /** Status konek/putus berubah. `true` = data channel open, `false` = ketutup/gagal. */
  onConnectionStateChange?: (connected: boolean) => void;
  /** Satu file utuh selesai diterima & siap dipakai (mis. buat di-download). */
  onFileReceived?: (file: Blob, meta: IncomingFileMeta) => void;
  /** Teks clipboard baru diterima dari device lain. */
  onClipboardReceived?: (text: string) => void;
  /** Error yang perlu ditampilin ke user (pesan singkat, bahasa manusia). */
  onError?: (message: string) => void;

  /** Progress ngirim file. Dipanggil tiap kali persennya BERUBAH (sudah di-throttle). */
  onSendProgress?: (fileName: string, percent: number) => void;
  /** Sesi kirim file selesai — sukses atau gagal (sekali per file). */
  onSendComplete?: (
    fileName: string,
    success: boolean,
    error?: string,
  ) => void;
  /** Progress nerima file. Dipanggil tiap kali persennya BERUBAH. */
  onReceiveProgress?: (fileName: string, percent: number) => void;
  /** Sesi terima file selesai — sukses atau gagal (sekali per file). */
  onReceiveComplete?: (
    fileName: string,
    success: boolean,
    error?: string,
  ) => void;
}
