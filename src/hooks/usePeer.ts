import type { DataConnection } from "peerjs";
import { useEffect, useRef, useState } from "react";
import { PeerService } from "../service/peer/peer.service";

export function usePeer() {
  const serviceRef = useRef<PeerService | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);

  const [peerId, setPeerId] = useState("");
  const [status, setStatus] = useState("creating");

  useEffect(() => {
    const service = new PeerService();
    const peer = service.create();

    serviceRef.current = service;

    peer.on("open", (id) => {
      console.log("PEER READY:", id);

      setPeerId(id);
      setStatus("waiting");
    });

    peer.on("connection", (connection) => {
      console.log(`incoming connection: ${connection.peer}`);
      connectionRef.current = connection;

      connection.on("open", () => {
        setStatus("connected");
      });
    });

    peer.on("error", (error) => {
      console.error("PEER ERROR:", error.type, error.message);
      setStatus("error");
    });

    return () => {
      service.destroy();
    };
  }, []);

  const connect = (targetPeerId: string) => {
    if (!serviceRef.current) {
      throw new Error("Peer service not ready yet");
    }

    const connection = serviceRef.current.connect(targetPeerId);
    connectionRef.current = connection;

    connection.on("open", () => {
      setStatus("connect");
    });
  };

  return {
    peerId,
    status,
    connect,
  };
}
