import type { DataConnection } from "peerjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { PeerService } from "../service/peer/peer.service";
import { TransferService } from "../service/transfer/transfer.service";
import type { TransferSession } from "../service/transfer/transfer.type";
import { generateToken } from "../service/transfer/token";
import { FileTransferService } from "../service/transfer/file-transfer.service";

export interface SendingFile {
  length: number;
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "queued" | "sending" | "completed" | "failed";
}

export function usePeer() {
  const serviceRef = useRef<PeerService | null>(null);
  const TransferServiceRef = useRef<TransferService | null>(null);
  const fileTransferRef = useRef<FileTransferService | null>(null);

  const connectionRef = useRef<DataConnection | null>(null);

  const [peerId, setPeerId] = useState("");
  const [status, setStatus] = useState("creating");
  const [session, setSession] = useState<TransferSession | null>(null);
  const [sendingFiles, setSendingFiles] = useState<SendingFile[]>([]);

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
      chunks: Uint8Array[];
      received: number;
    } | null = null;

    connection.on("open", () => {
      console.log("CONNECTED:", connection.peer);

      setStatus("connected");
    });

    connection.on("data", (data) => {
      // FILE START
      if (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        data.type === "file-start"
      ) {
        const fileStart = data as {
          type: "file-start";
          name: string;
          size: number;
          mimeType: string;
        };

        incomingFile = {
          name: fileStart.name,
          size: fileStart.size,
          mimeType: fileStart.mimeType,
          chunks: [],
          received: 0,
        };

        console.log("FILE START:", incomingFile.name);
        return;
      }

      // FILE CHUNK
      if (data instanceof Uint8Array && incomingFile) {
        incomingFile.chunks.push(data);
        incomingFile.received += data.byteLength;

        console.log(
          `RECEIVING ${incomingFile.name}: ${Math.round(
            (incomingFile.received / incomingFile.size) * 100,
          )}%`,
        );

        return;
      }

      // FILE END
      if (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        data.type === "file-end" &&
        incomingFile
      ) {
        const file = incomingFile;

        const blobParts = file.chunks.map((chunk) => {
          const copy = new Uint8Array(chunk.byteLength);
          copy.set(chunk);
          return copy.buffer;
        });

        const blob = new Blob(blobParts, {
          type: file.mimeType,
        });

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = file.name;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        console.log("FILE DOWNLOADED:", file.name);

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

  const sendFile = useCallback(async (file: File) => {
    const connection = connectionRef.current;

    if (!connection) {
      throw new Error("Belum terhubung");
    }

    if (!connection.open) {
      throw new Error("Connection belum open");
    }

    if (!fileTransferRef.current) {
      throw new Error("FileTransferService belum siap");
    }

    const id = crypto.randomUUID();

    setSendingFiles((prev) => [
      ...prev,
      {
        id,
        name: file.name,
        size: file.size,
        length: file.size,
        progress: 0,
        status: "queued",
      },
    ]);

    try {
      setSendingFiles((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "sending" } : item,
        ),
      );

      await fileTransferRef.current.send(connection, file, ({ percentage }) => {
        setSendingFiles((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  progress: percentage,
                }
              : item,
          ),
        );
      });

      setSendingFiles((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                progress: 100,
                status: "completed",
              }
            : item,
        ),
      );
    } catch (error) {
      setSendingFiles((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "failed",
              }
            : item,
        ),
      );

      throw error;
    }
  }, []);

  return {
    peerId,
    status,
    session,
    connect,
    sendFile,
    sendingFiles,
  };
}
