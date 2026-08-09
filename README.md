# 🚀 Orbit

**Orbit** adalah aplikasi desktop modern untuk transfer file dan sinkronisasi clipboard (teks) antar perangkat secara **Peer-to-Peer (P2P)**.

Dengan Orbit, kamu bisa kirim file atau teks antar komputer/HP secara langsung, cepat, dan aman tanpa harus diunggah ke server pihak ketiga terlebih dahulu.

---

## ✨ Fitur Utama

- 📁 **Transfer File P2P**: Kirim file secara langsung antar perangkat menggunakan teknologi WebRTC.
- 📋 **Sync Clipboard**: Bagikan teks atau konten clipboard ke perangkat lain dengan mudah.
- 🟢 **Status Perangkat Real-time**: Lihat perangkat milikmu yang sedang aktif/online.
- 🌙 **Dark Mode**: Tampilan antarmuka yang simpel, modern, dan nyaman di mata.

---

## 🛠️ Teknologi yang Digunakan

- **Desktop Framework**: Electron
- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Component Library (Radix UI / shadcn)
- **Koneksi P2P**: WebRTC
- **Database & Signaling**: Firebase

---

## 🚀 Cara Menjalankan Project

### 1. Install Dependensi
```bash
npm install
```

### 2. Jalankan Mode Development
```bash
npm run dev
```

### 3. Build Aplikasi (Installer Desktop)
```bash
npm run build
```
*(Hasil file executable/installer akan tersimpan di folder `release/`)*

---

## 📝 Catatan Tambahan

Jika kamu ingin menghubungkan aplikasi ini ke Firebase kamu sendiri, sesuaikan konfigurasi kredensial Firebase di file `.env`.
