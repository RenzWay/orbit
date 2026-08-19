/**
 * Entry point modul WebRTC Orbit. Kode lain di app cukup import dari
 * sini (`@/services/webrtc`) — gak perlu tau file mana yang berisi apa
 * di dalam folder ini.
 *
 * Lihat `WebRTCService.ts` buat penjelasan alur koneksi lengkap, atau
 * `README.md` di folder ini buat gambaran arsitektur & alasan tiap
 * modul dipisah.
 */

export { webRTCService } from "../webrtcService";
export type { IncomingFileMeta } from "../webrtcService";
export type { NegotiationState, WebRTCEventHandlers } from "./types";
