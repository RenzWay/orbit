/**
 * "Penjaga" yang nerjemahin `RTCIceConnectionState` mentah dari browser
 * jadi keputusan yang lebih masuk akal buat Orbit: kapan boleh nyerah &
 * bilang "gagal, boleh coba reconnect", dan kapan harus SABAR dulu
 * karena state itu sebenarnya wajar & sementara.
 *
 * KENAPA INI PERLU (jangan langsung percaya iceConnectionState mentah):
 *
 * 1. State `"checking"` kadang macet lama tanpa pernah pindah ke
 *    `"failed"` — tergantung browser & jaringan. Tanpa watchdog, UI
 *    bakal keliatan "connecting..." selamanya walau sebenarnya sudah
 *    deadlock, dan auto-reconnect gak akan pernah kepicu.
 *
 * 2. State `"disconnected"` SERING cuma gangguan jaringan sesaat (WiFi
 *    hiccup, atau transfer file besar yang bikin jalur network sibuk)
 *    dan pulih sendiri dalam beberapa detik. Kalau kita langsung
 *    anggap gagal & auto-reconnect, kita malah MOTONG koneksi yang
 *    sebenarnya bisa pulih sendiri — parah lagi kalau pas itu lagi ada
 *    transfer file aktif, jadi transfer-nya ikut gagal padahal
 *    sebenarnya cuma butuh nunggu beberapa detik lagi.
 *
 * Satu instance watchdog itu untuk SATU percobaan RTCPeerConnection.
 * Kalau service bikin koneksi baru, bikin `IceWatchdog` baru juga.
 */
export class IceWatchdog {
  /** Berapa lama ICE boleh nyangkut di "checking" sebelum dianggap macet. */
  private static readonly CHECKING_TIMEOUT_MS = 8_000;
  /** Berapa lama ICE boleh "disconnected" sebelum dianggap gagal beneran. */
  private static readonly DISCONNECT_GRACE_MS = 4_000;
  /** Grace period yang lebih panjang kalau lagi ada transfer file aktif. */
  private static readonly DISCONNECT_GRACE_MS_WHILE_TRANSFERRING = 15_000;

  private checkingTimer: number | null = null;
  private disconnectTimer: number | null = null;

  /** Batalin semua timer yang lagi jalan. Panggil tiap kali ICE state berubah lagi. */
  clear() {
    if (this.checkingTimer !== null) {
      window.clearTimeout(this.checkingTimer);
      this.checkingTimer = null;
    }
    if (this.disconnectTimer !== null) {
      window.clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  /**
   * Pasang timer: kalau setelah `CHECKING_TIMEOUT_MS` state-nya MASIH
   * "checking", panggil `onStuck`.
   *
   * @param isStillRelevant - dicek pas timer nyala, buat mastiin
   *   RTCPeerConnection ini masih yang aktif dipakai (bisa aja udah
   *   diganti sama percobaan koneksi baru di antara waktu itu).
   */
  watchChecking(isStillRelevant: () => boolean, onStuck: () => void) {
    this.checkingTimer = window.setTimeout(() => {
      if (!isStillRelevant()) return;
      console.warn("[IceWatchdog] ICE macet di 'checking' > 8 detik.");
      onStuck();
    }, IceWatchdog.CHECKING_TIMEOUT_MS);
  }

  /**
   * Pasang timer grace period buat state "disconnected": kalau setelah
   * grace period-nya state MASIH "disconnected" (bukan udah pulih ke
   * "connected"/"completed"), panggil `onStillDisconnected`.
   *
   * @param isTransferring - dipakai buat mutusin grace period mana yang
   *   dipakai (lebih panjang kalau lagi ada transfer file aktif).
   */
  watchDisconnected(
    isStillRelevant: () => boolean,
    isStillDisconnected: () => boolean,
    isTransferring: boolean,
    onStillDisconnected: () => void,
  ) {
    const graceMs = isTransferring
      ? IceWatchdog.DISCONNECT_GRACE_MS_WHILE_TRANSFERRING
      : IceWatchdog.DISCONNECT_GRACE_MS;

    this.disconnectTimer = window.setTimeout(() => {
      if (!isStillRelevant() || !isStillDisconnected()) return;
      onStillDisconnected();
    }, graceMs);
  }
}
