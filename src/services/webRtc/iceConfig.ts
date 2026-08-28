/**
 * Konfigurasi `RTCPeerConnection` buat Orbit. Diisolasi di file sendiri
 * karena ini nilai yang paling sering perlu di-tweak dari luar kode
 * (nambah TURN server, ganti provider STUN, dll) — gak perlu bongkar
 * logika WebRTCService cuma buat ganti ini.
 */

// const turnUsername = import.meta.env.VITE_TURN_USERNAME;
// const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

export const iceServers: RTCIceServer[] = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
  {
    urls: "stun:stun1.l.google.com:19302",
  },
  // {
  //   urls: "stun:stun.relay.metered.ca:80",
  // },
  // {
  //   urls: "turn:global.relay.metered.ca:80",
  //   username: turnUsername,
  //   credential: turnCredential,
  // },
  // {
  //   urls: "turn:global.relay.metered.ca:80?transport=tcp",
  //   username: turnUsername,
  //   credential: turnCredential,
  // },
  // {
  //   urls: "turn:global.relay.metered.ca:443",
  //   username: turnUsername,
  //   credential: turnCredential,
  // },
  // {
  //   urls: "turns:global.relay.metered.ca:443?transport=tcp",
  //   username: turnUsername,
  //   credential: turnCredential,
  // },
];
// CATATAN — cuma STUN, BELUM ada TURN:
// STUN cukup buat kebanyakan kasus (NAT "biasa" di rumah/kantor kecil),
// tapi kalau salah satu atau kedua device ada di belakang NAT "berat"
// (simetris, umum di jaringan kantor besar/kampus/hotel/hotspot
// seluler tertentu), koneksi P2P bisa gagal total karena gak ada
// jalur cadangan buat relay data. Kalau itu kejadian (createOffer
// sukses tapi ICE state gak pernah lewat dari "checking"/"failed"),
// solusinya nambah TURN server di sini, contoh:
//   { urls: "turn:turn.example.com:3478", username: "...", credential: "..." }
// Bisa pakai layanan berbayar (Twilio, Xirsys, dll) atau self-host
// pakai coturn.

export const rtcConfiguration = {
  iceServers,
  // Pre-gather ICE candidates sebelum offer/answer dibuat, jadi kandidat
  // udah siap dikirim begitu negosiasi mulai — mempercepat handshake
  // dibanding nunggu gathering mulai dari nol pas createOffer() dipanggil.
  iceCandidatePoolSize: 10,
};
