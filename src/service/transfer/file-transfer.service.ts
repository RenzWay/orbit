import type { DataConnection } from "peerjs";

const CHUNK_SIZE = 64 * 1024;

export interface FileTransferProgress {
  sent: number;
  total: number;
  percentage: number;
}

export class FileTransferService {
  async send(
    connection: DataConnection,
    file: File,
    onProgress?: (progress: FileTransferProgress) => void,
  ) {
    console.log("START SENDING:", file.name);

    try {
      connection.send({
        type: "file-start",
        name: file.name,
        size: file.size,
        mimeType: file.type,
      });

      let offset = 0;

      while (offset < file.size) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await chunk.arrayBuffer();

        // Tunggu buffer DataChannel tidak terlalu penuh
        while ((connection.dataChannel?.bufferedAmount ?? 0) > 1024 * 1024) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }

        connection.send(buffer);

        offset += buffer.byteLength;

        const percentage =
          file.size === 0 ? 100 : Math.round((offset / file.size) * 100);

        onProgress?.({
          sent: offset,
          total: file.size,
          percentage,
        });
        // console.log(
        //   `SENT: ${offset} / ${file.size} (${Math.round(
        //     (offset / file.size) * 100,
        //   )}%)`,
        // );
      }

      connection.send({
        type: "file-end",
        name: file.name,
      });

      onProgress?.({
        sent: file.size,
        total: file.size,
        percentage: 100,
      });

      console.log("FILE SENT:", file.name);
    } catch (error) {
      console.error("FILE SEND FAILED:", file.name, error);

      throw error;
    }
  }
}
