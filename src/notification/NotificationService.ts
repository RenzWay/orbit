/**
 * Pusat semua notifikasi native Orbit di PC — niru pola dari
 * NotificationHelper.kt di sisi mobile:
 *
 * 1. notifyDeviceConnected — "PC lain terhubung" (dipanggil pas datachannel
 *    P2P beneran open, BUKAN pas ICE connected — lihat catatan di
 *    webrtcService.ts kenapa itu dua hal yang beda)
 * 2. showTransferProgress — progress bar kirim/terima file, dipanggil
 *    berkali-kali selama transfer jalan. Caller (webrtcService) sudah
 *    nge-throttle biar cuma update pas persennya beneran berubah.
 * 3. showTransferResult — hasil akhir sukses/gagal, dipanggil sekali di
 *    akhir tiap sesi transfer. Pakai id yang SAMA dengan showTransferProgress
 *    biar notif progress "berubah jadi" notif hasil, bukan nambah baru.
 *
 * CATATAN: Electron Notification gak punya progress bar bawaan yang
 * ke-update di tempat kayak Android (butuh native module tambahan buat itu
 * per-platform). Jadi progress di sini ditampilkan sebagai teks "42%" di
 * body notif, dan notif lama ditutup dulu sebelum yang baru muncul (biar
 * gak numpuk banyak toast per transfer — itu tanggung jawab main process,
 * lihat ipcMain.handle("notify", ...) di electron/main.ts).
 */

let nextNotificationId = 3000;
export function newTransferId(): number {
  return nextNotificationId++;
}

export function notifyDeviceConnected(deviceName: string) {
  void window.electronAPI.notify({
    id: hashId(`connected:${deviceName}`),
    title: `${deviceName} terhubung`,
    body: "Siap buat transfer file",
    silent: true,
  });
}

export function showTransferProgress(
  id: number,
  fileName: string,
  progressPercent: number,
  isSending: boolean,
) {
  const verb = isSending ? "Sending" : "Receive";
  void window.electronAPI.notify({
    id,
    title: `${verb} ${fileName}`,
    body: `${progressPercent}%`,
    silent: true,
  });
}

export function showTransferResult(
  id: number,
  fileName: string,
  isSending: boolean,
  success: boolean,
  errorMessage?: string,
) {
  const verb = isSending ? "Sending" : "Receive";
  const title = success
    ? `Success ${verb} "${fileName}"`
    : `Failed ${verb} "${fileName}"`;
  const body = success
    ? undefined
    : (errorMessage ?? "An error occurred. Please try again.");

  void window.electronAPI.notify({
    id,
    title,
    body,
    silent: success,
    urgent: !success,
  });
}

export function cancelNotification(id: number) {
  void window.electronAPI.closeNotification(id);
}

function hashId(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 1000;
}
