import { child, onValue, push, ref, set } from "firebase/database";
import { db } from "../firebase/firebase";

const configuration: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;

  async createOffer(
    userId: string,
    targetDeviceId: string,
    myDeviceId: string,
  ) {
    this.peerConnection?.close();
    this.peerConnection = new RTCPeerConnection(configuration);
    this.dataChannel = this.peerConnection.createDataChannel("orbit-transfer");
    const callRef = ref(
      db,
      `calls/${userId}/${myDeviceId}_to_${targetDeviceId}`,
    );
    this.peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate)
        void set(push(child(callRef, "offerCandidates")), candidate.toJSON());
    };
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    await set(callRef, { offer: { type: offer.type, sdp: offer.sdp } });
    onValue(child(callRef, "answer"), async (snapshot) => {
      const answer = snapshot.val();
      if (answer && !this.peerConnection?.currentRemoteDescription)
        await this.peerConnection?.setRemoteDescription(answer);
    });
    onValue(child(callRef, "answerCandidates"), (snapshot) =>
      snapshot.forEach(
        (item) => void this.peerConnection?.addIceCandidate(item.val()),
      ),
    );
  }

  sendFile(file: File) {
    if (this.dataChannel?.readyState !== "open")
      throw new Error("Koneksi P2P belum terbuka.");
    this.dataChannel.send(
      JSON.stringify({
        type: "file-meta",
        name: file.name,
        size: file.size,
        mimeType: file.type,
      }),
    );
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) this.dataChannel?.send(reader.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(file);
  }
}

export const webRTCService = new WebRTCService();
