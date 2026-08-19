/**
 * "Protokol" pesan yang dikirim lewat RTCDataChannel buat transfer file
 * & clipboard. Data channel WebRTC cuma ngirim bytes/string mentah —
 * format pesan di atasnya kita yang tentuin sendiri, dan didefinisikan
 * DI SATU TEMPAT ini biar sisi kirim & terima gak gampang "beda kode".
 *
 * Urutan pesan yang WAJIB buat satu sesi kirim file:
 *
 *   1. FILE_META      (JSON, sekali)    — nama, ukuran, mime type
 *   2. <chunk biner>  (berkali-kali)    — potongan isi file, @CHUNK_SIZE_BYTES per potongan
 *   3. FILE_COMPLETE  (JSON, sekali)    — tanda semua chunk udah kekirim
 *
 * Penerima BARU boleh menganggap file lengkap & utuh setelah dapet
 * `file-complete` — BUKAN pas dapet chunk biner pertama. (Ini pernah
 * jadi bug: versi lama PC nganggep "sekali dapet data biner = file
 * selesai", padahal itu cuma cocok kalau pengirim ngirim sekaligus
 * dalam satu potongan. Begitu sisi mobile pindah ke pengiriman
 * per-chunk, file yang diterima PC dari HP kepotong cuma 16KB pertama.)
 *
 * KOMPATIBILITAS DENGAN MOBILE (Android) — PENTING:
 * `CHUNK_SIZE_BYTES` HARUS sama persis dengan yang dipakai
 * `WebRtcManager.kt` di project orbit-mobile. Kalau mau ubah ukuran
 * ini, ubah juga di sana — jangan ubah salah satu doang.
 */

export const CHUNK_SIZE_BYTES = 16 * 1024;

/**
 * Kalau data yang lagi ngantre dikirim (`RTCDataChannel.bufferedAmount`)
 * udah ngelewatin angka ini, pengirim JEDA dulu sebelum ngirim chunk
 * berikutnya (lihat `webrtcService.ts` bagian `sendFile`).
 *
 * Ini bukan cuma soal hemat memory — ambang yang kegedean (pernah
 * dicoba 8MB) bikin browser sibuk ngirim data terus-terusan tanpa
 * jeda ke event loop, dan itu bisa "menenggelamkan" paket keep-alive
 * ICE di jaringan lambat/NAT ketat sampai koneksi dianggap putus.
 * 256KB adalah hasil coba-coba yang paling stabil sejauh ini — kalau
 * suatu saat nemu lagi kasus putus-nyambung pas transfer file besar,
 * ini salah satu angka pertama yang perlu dicurigai/diturunin.
 */
export const BACKPRESSURE_THRESHOLD_BYTES = 256 * 1024;

/** Bikin pesan `file-meta` yang dikirim sebelum chunk pertama. */
export function buildFileMetaMessage(file: File): string {
  return JSON.stringify({
    type: "file-meta",
    name: file.name,
    size: file.size,
    mimeType: file.type,
  });
}

/** Pesan penanda "semua chunk file ini udah selesai dikirim". */
export const FILE_COMPLETE_MESSAGE = JSON.stringify({ type: "file-complete" });

/**
 * Ambil teks clipboard dari pesan JSON yang diterima. Support 2 bentuk
 * field sekaligus (`payload` dan `p`/`content`) karena format lama
 * pernah pakai nama field yang beda — biar tetap kompatibel kalau ada
 * device lain yang masih jalanin build lama.
 *
 * CATATAN: format lama itu juga pakai `t: "clipboard"` (bukan
 * `type: "clipboard"`) buat penanda jenis pesannya — itu dicek terpisah
 * di `WebRTCService.handleIncomingMessage()`, bukan di sini, karena itu
 * soal ROUTING pesan (bukan isinya).
 */
export function extractClipboardText(
  parsed: Record<string, unknown>,
): string | undefined {
  const value = parsed.payload ?? parsed.p ?? parsed.content;
  return typeof value === "string" ? value : undefined;
}
