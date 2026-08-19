import type { DataConnection } from "peerjs";
import { useEffect, useRef, useState } from "react";
import { PeerService } from "../service/peer/peer.service";
import { TransferService } from "../service/transfer/transfer.service";
import type { TransferSession } from "../service/transfer/transfer.type";

export function usePeer() {
  const serviceRef = useRef<PeerService | null>(null);
  const TransferServiceRef = useRef<TransferService | null>(null);

  const connectionRef = useRef<DataConnection | null>(null);

  const [peerId, setPeerId] = useState("");
  const [status, setStatus] = useState("creating");
  const [session, setSession] = useState<TransferSession | null>(null);

  useEffect(() => {
    const service = new PeerService();
    const transferService = new TransferService();

    const peer = service.create();

    serviceRef.current = service;
    TransferServiceRef.current = transferService;

    peer.on("open", (id) => {
      console.log("PEER READY:", id);

      setPeerId(id);
      setStatus("waiting");

      const newSession = transferService.createSession(id);

      setSession(newSession);

      console.log("TRANSFER SESSION:", newSession);
    });

    peer.on("connection", (connection) => {
      console.log("incoming connection:", connection.peer);

      connectionRef.current = connection;

      connection.on("open", () => {
        console.log("CONNECTED");

        setStatus("connected");
      });
    });

    peer.on("error", (error) => {
      console.error("PEER ERROR:", error);

      setStatus("error");
    });

    return () => {
      service.destroy();
    };
  }, []);

  const connect = (peerId: string) => {
    if (!serviceRef.current) {
      throw new Error("peer service not ready yet");
    }
    console.log("CONNECTING TO PEER:", peerId);

    const connection = serviceRef.current.connect(peerId);

    connectionRef.current = connection;

    connection.on("open", () => {
      console.log(`connected id: ${peerId}`);
      setStatus("connected");
    });

    connection.on("error", (error) => {
      console.error("CONNECTION ERROR:", error);
      setStatus("error");
    });

    connection.on("close", () => {
      console.log("connection close");
      setStatus("waiting");
    });
  };

  return {
    peerId,
    status,
    session,
    connect,
  };
}
