import type { DataConnection } from "peerjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { PeerService } from "../service/peer/peer.service";
import { TransferService } from "../service/transfer/transfer.service";
import type { TransferSession } from "../service/transfer/transfer.type";
import { generateToken } from "../service/transfer/token";
import { FileTransferService } from "../service/transfer/file-transfer.service";

export function usePeer() {
  const serviceRef = useRef<PeerService | null>(null);
  const TransferServiceRef = useRef<TransferService | null>(null);
  const fileTransferRef = useRef<FileTransferService | null>(null);

  const connectionRef = useRef<DataConnection | null>(null);

  const [peerId, setPeerId] = useState("");
  const [status, setStatus] = useState("creating");
  const [session, setSession] = useState<TransferSession | null>(null);

  /*
   * Semua connection masuk ke sini.
   * Jadi incoming maupun outgoing punya handler yang sama.
   */
  const setupConnection = useCallback((connection: DataConnection) => {
    connectionRef.current = connection;

    let incomingFile: {
      name: string;
      size: number;
      mimeType: string;
    } | null = null;

    connection.on("open", () => {
      console.log("CONNECTED:", connection.peer);

      setStatus("connected");
    });

    connection.on("data", (data) => {
      console.log("DATA RECEIVED:", data);

      // Metadata file
      if (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        data.type === "file" &&
        "name" in data &&
        typeof data.name === "string" &&
        "size" in data &&
        typeof data.size === "number" &&
        "mimeType" in data &&
        typeof data.mimeType === "string"
      ) {
        incomingFile = {
          name: data.name,
          size: data.size,
          mimeType: data.mimeType,
        };

        console.log("FILE METADATA:", incomingFile);

        return;
      }

      // Binary file
      if (data instanceof Uint8Array && incomingFile) {
        const bytes = new Uint8Array(data);

        const blob = new Blob([bytes.buffer], {
          type: incomingFile.mimeType,
        });

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = incomingFile.name;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        console.log("FILE DOWNLOADED:", incomingFile.name);

        incomingFile = null;
      }
    });

    connection.on("error", (error) => {
      console.error("CONNECTION ERROR:", error);

      setStatus("error");
    });

    connection.on("close", () => {
      console.log("CONNECTION CLOSED");

      connectionRef.current = null;
      setStatus("waiting");
    });
  }, []);

  useEffect(() => {
    const service = new PeerService();
    const transferService = new TransferService();
    const fileTransfer = new FileTransferService();

    const token = generateToken();
    const peer = service.create(token);

    console.log("GENERATED TOKEN:", token);

    serviceRef.current = service;
    TransferServiceRef.current = transferService;
    fileTransferRef.current = fileTransfer;

    peer.on("open", (id) => {
      console.log("PEER READY:", id);

      setPeerId(id);
      setStatus("waiting");

      const newSession = transferService.createSession(id);

      setSession(newSession);

      console.log("TRANSFER SESSION:", newSession);
    });

    // RECEIVER
    peer.on("connection", (connection) => {
      console.log("INCOMING CONNECTION:", connection.peer);

      setupConnection(connection);
    });

    peer.on("error", (error) => {
      console.error("PEER ERROR:", error);

      setStatus("error");
    });

    return () => {
      service.destroy();
    };
  }, [setupConnection]);

  // SENDER / OUTGOING CONNECTION
  const connect = useCallback(
    (peerId: string) => {
      if (!serviceRef.current) {
        throw new Error("peer service not ready yet");
      }

      console.log("CONNECTING TO PEER:", peerId);

      const connection = serviceRef.current.connect(peerId);

      setupConnection(connection);
    },
    [setupConnection],
  );

  const sendFile = useCallback((file: File) => {
    const connection = connectionRef.current;

    if (!connection) {
      console.error("Belum terhubung");
      return;
    }

    if (!connection.open) {
      console.error("Connection belum open");
      return;
    }

    if (!fileTransferRef.current) {
      console.error("FileTransferService belum siap");
      return;
    }

    fileTransferRef.current.send(connection, file);
  }, []);

  return {
    peerId,
    status,
    session,
    connect,
    sendFile,
  };
}
