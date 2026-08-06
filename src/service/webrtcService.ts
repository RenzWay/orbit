import { ref, set, onValue, push, child } from "firebase/database";
import { db } from "../firebase/firebase";

const configuration: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

class WebRTCService {
  peerConnection: RTCPeerConnection | null = null;
  dataChannel: RTCDataChannel | null = null;

  async createOffer(
    userId: string,
    targetDeviceId: string,
    myDeviceId: string,
  ) {
    this.peerConnection = new RTCPeerConnection(configuration);

    // Buat DataChannel buat kirim file & clipboard
    this.dataChannel = this.peerConnection.createDataChannel("orbit-transfer");
    this.setupDataChannelEvents();

    const callRef = ref(
      db,
      `calls/${userId}/${myDeviceId}_to_${targetDeviceId}`,
    );

    // Dapatkan ICE Candidates dari PC & simpan ke Firebase
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidatesRef = push(child(callRef, "offerCandidates"));
        set(candidatesRef, event.candidate.toJSON());
      }
    };

    // Buat Offer
    const offerDescription = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offerDescription);

    // Simpan Offer ke Firebase Realtime DB
    await set(callRef, {
      offer: {
        type: offerDescription.type,
        sdp: offerDescription.sdp,
      },
    });

    // Dengarkan Balasan (Answer) dari HP Target
    onValue(child(callRef, "answer"), async (snapshot) => {
      const data = snapshot.val();
      if (data && !this.peerConnection?.currentRemoteDescription) {
        const answerDescription = new RTCSessionDescription(data);
        await this.peerConnection?.setRemoteDescription(answerDescription);
      }
    });

    // Dengarkan ICE Candidates balasan dari HP Target
    onValue(child(callRef, "answerCandidates"), (snapshot) => {
      snapshot.forEach((childSnap) => {
        const candidate = new RTCIceCandidate(childSnap.val());
        this.peerConnection?.addIceCandidate(candidate);
      });
    });
  }

  private setupDataChannelEvents() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log("🚀 WebRTC P2P DataChannel OPEN! Siap kirim file/clipboard.");
    };

    this.dataChannel.onclose = () => {
      console.log("❌ WebRTC P2P DataChannel CLOSED!");
    };

    this.dataChannel.onmessage = (event) => {
      console.log("📩 Dapet Data P2P:", event.data);
      // Nanti di sini kita olah file/clipboard yang masuk!
    };
  }

  // Fungsi Kirim Teks/Clipboard
  sendText(text: string) {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      this.dataChannel.send(
        JSON.stringify({ type: "clipboard", content: text }),
      );
      console.log("Clipboard terkirim via P2P!");
    } else {
      alert("Koneksi P2P belum tersambung!");
    }
  }

  sendFile(file: File) {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      // Bikin metadata file dulu
      this.dataChannel.send(
        JSON.stringify({
          type: "file-meta",
          name: file.name,
          size: file.size,
          mimeType: file.type,
        }),
      );

      // Kirim data file berupa Blob/ArrayBuffer
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          this.dataChannel?.send(e.target.result as ArrayBuffer);
          console.log("File terkirim via P2P!");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }
}

export const webRTCService = new WebRTCService();
