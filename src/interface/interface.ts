export interface Device {
  id: string;
  deviceName: string;
  status: "online" | "offline";
}