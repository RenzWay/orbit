import type { DataConnection } from "peerjs";

export class FileTransferService {
  send(connection: DataConnection, file: File) {
    console.log("sending file", file.name);

    connection.send({
      type: "file",
      name: file.name,
      size: file.size,
      mimeType: file.type,
    });

    connection.send(file);
  }
}
