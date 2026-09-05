import type { ReactNode } from "react";

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

export type ContextMenuHomeProps = {
  children: ReactNode;
};

export type DeviceCardProps = {
  device: Device;
  isSelected: boolean;
  onSelect: (device: Device) => void;
  onUnsync: (device: Device) => void;
};

export interface MirroredNotificationPayload {
  key: string;
  packageName: string;
  title: string;
  text?: string;
}