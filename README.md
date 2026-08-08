# Orbit - Cross-Device Data Sync

Orbit adalah aplikasi Android (dan Desktop) yang memungkinkan sinkronisasi data antar perangkat secara real-time menggunakan teknologi WebRTC.

## Fitur Utama
- **Real-time Presence**: Mengetahui device mana saja yang sedang online menggunakan Firebase Realtime Database.
- **Clipboard Sync**: Mengirim isi clipboard antar HP dan PC dengan satu klik.
- **File Transfer**: Mengirim file tanpa batas ukuran lewat jalur *peer-to-peer* (P2P) yang aman dan cepat.

## Arsitektur Teknologi
1. **WebRTC**: Digunakan sebagai protokol komunikasi utama untuk transfer data biner (file) dan teks (clipboard) secara langsung antar device tanpa melalui server (P2P).
2. **Firebase Auth**: Menghandle keamanan login pengguna.
3. **Firebase Realtime Database (RTDB)**: Digunakan sebagai *Signaling Server* untuk menukar alamat (ICE Candidates) dan deskripsi koneksi (SDP) antar device.
4. **MediaStore API**: Digunakan untuk menyimpan file yang diterima langsung ke folder `Downloads` sistem Android secara aman.

## Struktur Kode Penting (Android)
- `MainActivity.kt`: Menangani UI (Jetpack Compose), logika pengiriman file, dan integrasi clipboard.
- `WebRtcManager.kt`: Inti dari koneksi WebRTC. Mengatur siklus hidup PeerConnection, DataChannel, dan signaling Firebase.
- `OrbitPresence.kt`: Mengelola status online/offline device di Firebase.

## Cara Menjalankan
1. Pastikan Firebase sudah terkonfigurasi di `google-services.json`.
2. Login menggunakan akun yang sama di HP dan PC.
3. Tunggu hingga status device lain berubah menjadi "Online".
4. Gunakan tombol Sync atau Send File untuk mulai bertukar data.

---
*Developed with Android Studio & WebRTC.*
