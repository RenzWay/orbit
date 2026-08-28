export interface Device {
  id: string;
  deviceName: string;
  status: "online" | "offline";
}

export type TransferState = {
  fileName: string;
  progress: number;
  status: "transferring" | "completed" | "failed";
  error?: string;
};

export type TransferProgressProps = {
  sendTransfer: TransferState | null;
  receiveTransfer: TransferState | null;
};