import Peer, { type DataConnection } from "peerjs";

export class PeerService {
  private peer: Peer | null = null;

  create() {
    this.peer = new Peer({
      config: {
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302",
          },
        ],
      },
    });
    return this.peer;
  }

  connect(peerId: string): DataConnection {
    if (!this.peer) {
      throw new Error("Peer not created yet");
    }

    return this.peer.connect(peerId, {
      reliable: true,
    });
  }

  destroy() {
    this.peer?.destroy();
    this.peer = null;
  }
}
