import type { TransferSession } from "./transfer.type";

export class TransferService {
  createSession(peerId: string): TransferSession {
    const token = crypto.randomUUID();

    return {
      token,
      peerId,
      createdAt: Date.now(),
    };
  }
}
