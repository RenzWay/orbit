import { DarkToggle } from "@/components/button/DarkToggle";
import {
  ClipboardModal,
  type ClipboardHistoryItem,
} from "@/components/other/ClipboardModal";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { handleLogout } from "@/handle/handleAuth";
import { type Device } from "@/interface/interface";
import { orbitModel } from "@/models/orbitModel";
import { webRTCService } from "@/services/webrtcService";
import { LogOut, MonitorX, Send, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function HomePage({ userId }: { userId: string }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [clipboardHistory, setClipboardHistory] = useState<
    ClipboardHistoryItem[]
  >([]);

  const currentUser = useMemo(
    () => (userId ? { uid: userId } : null),
    [userId],
  );
  const [deviceInfo, setDeviceInfo] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    window.electronAPI.getDeviceInfo().then(({ hostname, platform }) => {
      setDeviceInfo({
        id: hostname,
        name: `${hostname} (${platform})`,
      });
    });
  }, []);

  useEffect(() => {
    if (!currentUser || !deviceInfo) return;

    orbitModel.setDeviceOnline(currentUser.uid, deviceInfo.id, deviceInfo.name);

    // PENTING: mulai dengerin panggilan masuk begitu login, JANGAN nunggu
    // user pilih device dulu — biar PC selalu siap "ngangkat telepon"
    // kapan pun HP/device lain nyoba connect.
    webRTCService.listenForIncomingCalls(currentUser.uid, deviceInfo.id);

    // Callback status — INI YANG SEBELUMNYA GA ADA, makanya kirim/gagal
    // ga ada pemberitahuan sama sekali di UI.
    webRTCService.onConnectionOpen = () => {
      alert("Koneksi P2P berhasil terhubung!");
    };
    webRTCService.onFileReceived = (blob, meta) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.name;
      a.click();
      URL.revokeObjectURL(url);
      alert(`File "${meta.name}" berhasil diterima!`);
    };
    webRTCService.onClipboardReceived = (text) => {
      setClipboardHistory((history) => [
        {
          id: crypto.randomUUID(),
          text,
          time: new Intl.DateTimeFormat("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date()),
          isUrl: /^https?:\/\//i.test(text),
        },
        ...history,
      ]);
    };
    webRTCService.onError = (message) => {
      alert(`Gagal: ${message}`);
    };

    const unsubscribe = orbitModel.listenToDevices(
      currentUser.uid,
      (deviceList) => {
        const otherDevices = deviceList.filter(
          (dev) => dev.id !== deviceInfo.id,
        );
        setDevices(otherDevices);

        setSelectedDevice((prevSelected) => {
          if (
            prevSelected &&
            otherDevices.some((dev) => dev.id === prevSelected.id)
          ) {
            return prevSelected;
          }
          return otherDevices[0] ?? null;
        });
      },
    );

    return () => {
      unsubscribe();
      webRTCService.onConnectionOpen = undefined;
      webRTCService.onFileReceived = undefined;
      webRTCService.onClipboardReceived = undefined;
      webRTCService.onError = undefined;
    };
  }, [currentUser, deviceInfo]);

  useEffect(() => {
    if (
      currentUser &&
      deviceInfo &&
      selectedDevice &&
      selectedDevice.status === "online"
    ) {
      webRTCService.createOffer(
        currentUser.uid,
        selectedDevice.id,
        deviceInfo.id,
      );
    }
  }, [selectedDevice, currentUser, deviceInfo]);

  const handleConnectP2P = () => {
    if (currentUser && deviceInfo && selectedDevice) {
      webRTCService.createOffer(
        currentUser.uid,
        selectedDevice.id,
        deviceInfo.id,
      );
    }
  };

  const handleRemoveDevice = async (device: Device) => {
    if (!currentUser) return;
    const confirmed = window.confirm(
      `Hapus "${device.deviceName}" dari daftar device? Device ini bakal hilang dari list, tapi kalau dia masih nyala dan online, bisa muncul lagi otomatis.`,
    );
    if (!confirmed) return;

    try {
      await orbitModel.removeDevice(currentUser.uid, device.id);
      if (selectedDevice?.id === device.id) {
        setSelectedDevice(null);
      }
    } catch (error) {
      console.error("Gagal menghapus device:", error);
      alert("Gagal menghapus device, coba lagi.");
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      await webRTCService.waitForConnection();
      await webRTCService.sendFile(file);
    } catch (error) {
      console.error("Gagal mengirim file via P2P:", error);
    }
  };

  const onLogout = async () => {
    const result = await handleLogout();
    if (!result.success) {
      alert(result.message);
    }
  };

  return (
    <section className="flex h-screen">
      <aside
        className={`flex-1/12 py-8 px-9 bg-sky-200 dark:bg-neutral-900 h-full flex flex-col`}>
        <div>
          <h4 className="font-medium text-green-400 animate-pulse">ORBIT</h4>
          <h3 className="font-extrabold">Your device</h3>
        </div>
        <hr />

        <div className="my-8">
          <h4 className="font-medium">Available devices</h4>
          <hr />
          <ul className="list-none space-y-2">
            {devices.length === 0 ? (
              <>
                <p className="text-xs text-neutral-500">
                  No other devices found
                </p>
              </>
            ) : (
              devices.map((device) => (
                <ContextMenu key={device.id}>
                  <ContextMenuTrigger asChild>
                    <li
                      onClick={() => setSelectedDevice(device)}
                      className={`flex gap-4 items-center transition-all p-3 rounded-2xl cursor-pointer ${
                        selectedDevice?.id === device.id
                          ? "bg-sky-500/30 dark:bg-sky-800/60 border border-sky-400"
                          : "bg-sky-500/10 hover:bg-sky-500/20"
                      }`}>
                      <Avatar className="w-10 h-10">
                        <AvatarFallback>
                          {device.deviceName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                        <AvatarBadge
                          className={
                            device.status === "online"
                              ? "bg-green-400"
                              : "bg-gray-500"
                          }
                        />
                      </Avatar>
                      <div>
                        <h4 className="font-semibold text-sm">
                          {device.deviceName}
                        </h4>
                        <span
                          className={`text-xs ${device.status === "online" ? "text-green-500" : "text-gray-400"}`}>
                          {device.status}
                        </span>
                      </div>
                    </li>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => handleRemoveDevice(device)}>
                      <Trash2 />
                      Unsync device
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))
            )}
          </ul>
        </div>

        <div className="flex flex-col gap-2 mt-auto">
          <DarkToggle />
          <Button size={"lg"} variant={"secondary"}>
            Settings
          </Button>
          <Button size={"lg"} variant={"destructive"} onClick={onLogout}>
            <LogOut />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main file sender */}
      <div className="flex-4 p-8 flex flex-col h-full">
        {selectedDevice ? (
          <>
            {/* Header Device Status Dinamis */}
            <header className="flex gap-3 items-center mb-4">
              <Avatar className="w-10 h-10">
                <AvatarFallback>
                  {selectedDevice.deviceName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
                <AvatarBadge
                  className={
                    selectedDevice.status === "online"
                      ? "bg-green-400"
                      : "bg-gray-500"
                  }
                />
              </Avatar>
              <div>
                <h3 className="font-bold text-base">
                  {selectedDevice.deviceName}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedDevice.status === "online"
                    ? "Ready to transfer"
                    : "Device is offline"}
                </p>
              </div>
            </header>

            {/* Box Upload */}
            <div className="flex-1 flex flex-col gap-4 h-[calc(100vh-8rem)]">
              <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-sky-500 bg-slate-900/40 hover:bg-slate-900 rounded-3xl cursor-pointer transition-all p-6 group">
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFileChange(e)}
                />
                <div className="p-4 rounded-full bg-slate-800 text-slate-400 group-hover:text-sky-400 group-hover:scale-110 transition-all mb-4">
                  <UploadCloud size={48} />
                </div>

                <p className="text-sm font-medium text-slate-300">
                  Send File to {selectedDevice.deviceName} or{" "}
                  <span className="text-sky-400 underline">click here</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports any file type via WebRTC P2P
                </p>
              </label>

              {/* Bottom Actions */}
              <div className="flex gap-3 justify-end items-center">
                <Button
                  size="lg"
                  onClick={handleConnectP2P}
                  disabled={selectedDevice.status !== "online"}
                  className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl px-6 h-12 gap-2 shadow-lg disabled:opacity-50">
                  <Send size={18} />
                  Send File
                </Button>
                <ClipboardModal
                  handle={handleConnectP2P}
                  history={clipboardHistory}
                  onClearHistory={() => setClipboardHistory([])}
                />
              </div>
            </div>
          </>
        ) : (
          /* Tampilan kalau tidak ada device yang dipilih / online */
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
            <MonitorX size={64} className="opacity-40" />
            <p className="text-base font-medium">
              No device selected or active.
            </p>
            <p className="text-xs text-slate-600">
              Open Orbit on your phone or other PC to start sharing.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
