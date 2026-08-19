# Modul WebRTC Orbit (PC)

Dokumen ini buat kamu-di-masa-depan yang lupa kenapa kode ini bentuknya
begini. Baca ini dulu sebelum ubah apa pun di folder ini.

## Kenapa dipecah jadi banyak file?

Dulu semuanya numpuk di satu file `webrtcService.ts` (500+ baris) yang
isinya nyampur: konfigurasi ICE server, timer-timer watchdog, format
pesan protokol file, baca/tulis Firebase, DAN logika utama koneksi —
semua di satu class. Gampang nambah kode di situ, susah **baca ulang**
dan **ngerti dampak perubahan**, apalagi tiap bug yang kejadian nempelin
komentar penjelasan panjang di tengah-tengah logika lain.

Sekarang dipecah per tanggung jawab:

| File                       | Isinya                                                        | Kapan disentuh                                  |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| `types.ts`                 | Tipe bersama (`NegotiationState`, callback UI, dll)             | Nambah event/callback baru                        |
| `iceConfig.ts`              | Daftar STUN/TURN server                                          | Nambah TURN server, ganti provider STUN           |
| `iceWatchdog.ts`            | Kapan status ICE dianggap "macet"/"gagal beneran"                | Tuning timeout, atau nemu pola gagal-koneksi baru |
| `fileTransferProtocol.ts`   | Format pesan (`file-meta`, chunk, `file-complete`), ukuran chunk | Ubah protokol transfer file / clipboard           |
| `signaling.ts`              | Baca/tulis SDP & ICE candidate ke Firebase                       | Ganti mekanisme signaling (mis. ke server sendiri)|
| `WebRTCService.ts`          | Orkestrasi: gabungin semua di atas jadi satu alur koneksi        | Ubah alur konek/kirim/terima itu sendiri          |
| `index.ts`                  | Titik masuk (`import { webRTCService } from "@/services/webrtc"`)| Nambah export publik baru                         |

**Aturan utama:** `WebRTCService.ts` gak boleh manggil Firebase
langsung (`ref()`, `set()`, dst) — itu tugasnya `signaling.ts`. Kalau
lihat ada kode Firebase muncul di `WebRTCService.ts`, itu tandanya
disiplin ini kebobol dan perlu dipindah balik.

## Alur koneksi (garis besar)

```
Device A (createOffer)                     Device B (listenForIncomingCalls)
───────────────────────                     ─────────────────────────────
1. Bikin RTCPeerConnection + data channel
2. createOffer() + setLocalDescription()
3. Tulis offer ke Firebase           ────▶  4. Denger offer baru masuk
                                             5. answerIncomingCall(): bikin
                                                RTCPeerConnection sendiri,
                                                setRemoteDescription(offer)
                                             6. createAnswer() + setLocal
                                      ◀────  7. Tulis answer ke Firebase
8. Denger answer masuk,
   setRemoteDescription(answer)
9. ICE candidate ditukar dua arah lewat Firebase selama proses ini
   (trickle ICE — dikirim begitu ketemu, gak nunggu gathering selesai)
10. RTCDataChannel.onopen() nyala di kedua sisi → BARU dianggap
    "beneran konek"
```

Kenapa langkah 10 dipisah dari "ICE connected"? Karena `RTCPeerConnection`
bisa lapor `iceConnectionState === "connected"` padahal `RTCDataChannel`-nya
sendiri (jalur SCTP di atas ICE) masih proses handshake terpisah dan
belum `"open"`. Kalau kode nganggep ICE-connected = udah-beneran-konek,
auto-reconnect bisa nutup koneksi yang **hampir jadi** karena dikira
"belum jalan, coba lagi" — padahal cuma butuh waktu sedikit lagi. Detail
lengkapnya ada di komentar `trackIceConnectionState()` di
`WebRTCService.ts`.

## Kenapa signaling-nya lewat Firebase (dan bukan langsung ke device)?

WebRTC sendiri gak tau caranya dua device saling ketemu di internet —
dia cuma jago NEGOSIASI kalau udah dikasih SDP & ICE candidate lawan
bicara. "Cara nyampein" data itu (disebut *signaling*) terserah kita
pilih apa aja. Orbit pakai Firebase Realtime Database karena gak perlu
bikin & maintain server sinyal sendiri.

**Konsekuensinya:** tahap *connect* (tuker-tukeran offer/answer) selalu
butuh minimal 2 round-trip ke server Firebase (internet), meskipun
kedua device ada di jaringan lokal yang sama. Transfer FILE-nya sendiri
sudah P2P langsung (ICE bakal milih jalur LAN kalau memang satu
jaringan) — yang lewat internet cuma proses "kenalan"-nya doang.

Kalau ini jadi masalah performa (proses connect kerasa lambat) dan mau
di-atasi dengan jalur LAN langsung (discovery + signaling lokal,
Firebase jadi fallback), itu perubahan besar yang masuk sebagai
modul BARU (mis. `lanSignaling.ts`) — bukan modifikasi `signaling.ts`
yang sudah ada, supaya jalur Firebase yang sudah teruji tetap ada sebagai
cadangan.

## Kenapa ada `isTransferring` di banyak tempat?

Karena pernah ada bug nyata: auto-reconnect kepicu di tengah proses
kirim file (ICE sempat "disconnected" sesaat karena jalur network
sibuk ngirim data — itu WAJAR, bukan berarti putus beneran), terus
`createOffer()` yang dipanggil auto-reconnect itu nutup
`RTCPeerConnection` yang sedang dipakai ngirim file. Hasilnya: file gak
pernah sampai sama sekali, dan dari luar keliatan kayak
"connect-reconnect-connect-reconnect" berulang.

Makanya sekarang **selama `isTransferring === true`**, gak ada satu pun
jalur (`createOffer`, `answerIncomingCall`, auto-reconnect lewat
`canAttemptReconnect()`) yang boleh menutup/mengganti peerConnection
yang aktif — bahkan tombol "reconnect manual" (`force=true`) pun tetap
ditolak. Dan grace period ICE `"disconnected"` juga diperpanjang selama
transfer berlangsung (lihat `IceWatchdog`), karena disconnect sesaat
akibat jaringan sibuk ngirim data itu memang lebih sering terjadi pas
transfer aktif.

## Kompatibilitas dengan sisi mobile (Android)

Ukuran chunk file (`CHUNK_SIZE_BYTES` di `fileTransferProtocol.ts`)
**harus sama persis** dengan yang dipakai `WebRtcManager.kt` di project
`orbit-mobile`. Protokol pesannya (`file-meta` → chunk biner berkali-kali
→ `file-complete`) juga harus konsisten dua sisi. Kalau mau ubah salah
satu, ubah juga yang satunya.

## Kalau nemu bug baru terkait koneksi

1. Cek dulu apakah ini soal **negosiasi/signaling** (gagal konek sama
   sekali, ICE gak pernah lewat dari "checking") → curigai
   `signaling.ts` atau `iceConfig.ts` (mungkin butuh TURN server).
2. Atau soal **stabilitas koneksi yang udah jadi** (putus-nyambung,
   `"disconnected"` yang gak pulih) → curigai `iceWatchdog.ts` dan
   interaksinya sama `isTransferring`.
3. Atau soal **transfer file-nya sendiri** (file korup, kepotong,
   kelamaan) → curigai `fileTransferProtocol.ts` dan bagian
   `handleIncomingFile*` / `sendFile` di `WebRTCService.ts`.

Kalau nambah komentar penjelasan bug baru, taruh di modul yang paling
relevan (bukan di `WebRTCService.ts` semua) supaya pemisahan ini gak
balik lagi jadi satu file raksasa.
