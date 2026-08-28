import { type ClipboardHistoryItem } from "@/components/other/ClipboardModal";
import { handleLogout } from "@/handle/handleAuth";
import { type Device } from "@/interface/interface";
import { orbitModel } from "@/models/orbitModel";
import {
  newTransferId,
  notifyDeviceConnected,
  showTransferProgress,
  showTransferResult,
} from "@/notification/NotificationService";
import { webRTCService } from "@/services/webrtcService";
import type { TransferState } from "@/types/orbit";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, MouseEvent } from "react";

export function useHomePageHandlers(userId: string) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [clipboardHistory, setClipboardHistory] = useState<
    ClipboardHistoryItem[]
  >([]);
  const [isP2PConnected, setIsP2PConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSendingStaged, setIsSendingStaged] = useState(false);
  const [sendTransfer, setSendTransfer] = useState<TransferState | null>(null);
  const [receiveTransfer, setReceiveTransfer] = useState<TransferState | null>(
    null,
  );
  const [appMenu, setAppMenu] = useState<{ x: number; y: number } | null>(null);

  const sendNotifIdRef = useRef<number | null>(null);
  const receiveNotifIdRef = useRef<number | null>(null);
  const remoteDeviceNameRef = useRef<string>("Device");
  const lastConnectAttemptRef = useRef<string | null>(null);
  const connectAttemptCooldownRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = useMemo(
    () => (userId ? { uid: userId } : null),
    [userId],
  );

  const [deviceInfo, setDeviceInfo] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (selectedDevice) remoteDeviceNameRef.current = selectedDevice.deviceName;
  }, [selectedDevice]);

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
    webRTCService.listenForIncomingCalls(currentUser.uid, deviceInfo.id);

    webRTCService.onConnectionOpen = () => {
      notifyDeviceConnected(remoteDeviceNameRef.current);
    };

    webRTCService.onFileReceived = (blob, meta) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.name;
      a.click();
      URL.revokeObjectURL(url);
    };

    webRTCService.onReceiveProgress = (fileName, percent) => {
      setReceiveTransfer({
        fileName,
        progress: percent,
        status: "transferring",
      });
    };

    webRTCService.onReceiveComplete = (fileName, success, error) => {
      setReceiveTransfer((current) => ({
        fileName,
        progress: success ? 100 : (current?.progress ?? 0),
        status: success ? "completed" : "failed",
        error,
      }));
      const id = receiveNotifIdRef.current ?? newTransferId();
      showTransferResult(id, fileName, false, success, error);
      receiveNotifIdRef.current = null;
    };

    webRTCService.onSendProgress = (fileName, percent) => {
      setSendTransfer({
        fileName,
        progress: percent,
        status: "transferring",
      });
    };

    webRTCService.onSendComplete = (fileName, success, error) => {
      setSendTransfer((current) => ({
        fileName,
        progress: success ? 100 : (current?.progress ?? 0),
        status: success ? "completed" : "failed",
        error,
      }));
      const id = sendNotifIdRef.current;
      if (id !== null) {
        showTransferResult(id, fileName, true, success, error);
      }
      sendNotifIdRef.current = null;
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
      alert(`Error: ${message}`);
    };

    webRTCService.onConnectionStateChange = (connection) => {
      setIsP2PConnected(connection);
    };

    const unsubscribe = orbitModel.listenToDevices(
      currentUser.uid,
      (deviceList) => {
        const otherDevices = deviceList.filter(
          (dev) => dev.id !== deviceInfo.id,
        );
        setDevices(otherDevices);

        setSelectedDevice((prevSelected) => {
          if (prevSelected) {
            const updatedSelectedDevice = otherDevices.find(
              (dev) => dev.id === prevSelected.id,
            );
            if (updatedSelectedDevice) return updatedSelectedDevice;
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
      webRTCService.onConnectionStateChange = undefined;
      webRTCService.onSendProgress = undefined;
      webRTCService.onSendComplete = undefined;
      webRTCService.onReceiveProgress = undefined;
      webRTCService.onReceiveComplete = undefined;
    };
  }, [currentUser, deviceInfo]);

  useEffect(() => {
    if (!currentUser || !deviceInfo || !selectedDevice) return;
    if (selectedDevice.status !== "online") return;

    const connectionKey = `${currentUser.uid}:${deviceInfo.id}->${selectedDevice.id}`;
    const attemptConnect = () => {
      if (lastConnectAttemptRef.current === connectionKey) {
        return;
      }

      if (!webRTCService.canAttemptReconnect()) return;

      lastConnectAttemptRef.current = connectionKey;
      if (connectAttemptCooldownRef.current !== null) {
        window.clearTimeout(connectAttemptCooldownRef.current);
      }

      connectAttemptCooldownRef.current = window.setTimeout(() => {
        lastConnectAttemptRef.current = null;
        connectAttemptCooldownRef.current = null;
      }, 2000);

      void webRTCService.createOffer(
        currentUser.uid,
        selectedDevice.id,
        deviceInfo.id,
      );
    };

    attemptConnect();
    const interval = window.setInterval(attemptConnect, 5000);

    return () => {
      window.clearInterval(interval);
      if (connectAttemptCooldownRef.current !== null) {
        window.clearTimeout(connectAttemptCooldownRef.current);
        connectAttemptCooldownRef.current = null;
      }
      lastConnectAttemptRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, deviceInfo, selectedDevice?.id, selectedDevice?.status]);

  const handleConnectP2P = () => {
    if (currentUser && deviceInfo && selectedDevice) {
      webRTCService.createOffer(
        currentUser.uid,
        selectedDevice.id,
        deviceInfo.id,
      );
    }
  };

  const handleRefreshConnection = async () => {
    if (!currentUser || !deviceInfo || !selectedDevice) return;
    setIsReconnecting(true);

    try {
      await webRTCService.createOffer(
        currentUser.uid,
        selectedDevice.id,
        deviceInfo.id,
        true,
      );
    } finally {
      window.setTimeout(() => setIsReconnecting(false), 1000);
    }
  };

  const handleRemoveDevice = async (device: Device) => {
    if (!currentUser) return;

    const confirmed = window.confirm(
      `Remove "${device.deviceName}" from your devices? It will disappear from the list, but may reappear automatically if it stays online.`,
    );

    if (!confirmed) return;

    try {
      await orbitModel.removeDevice(currentUser.uid, device.id);
      if (selectedDevice?.id === device.id) {
        setSelectedDevice(null);
      }
    } catch (error) {
      console.error("Gagal menghapus device:", error);
      alert("Failed to remove device. Please try again.");
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setStagedFiles((prev) => [...prev, ...Array.from(files)]);
      setSendTransfer((current) =>
        current?.status === "transferring" ? current : null,
      );
    }
    event.target.value = "";
  };

  const handleDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);

    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length > 0) {
      setStagedFiles((prev) => [...prev, ...dropped]);
      setSendTransfer((current) =>
        current?.status === "transferring" ? current : null,
      );
    }
  };

  const handleRemoveStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendStagedFiles = async () => {
    if (stagedFiles.length === 0 || isSendingStaged) return;
    setIsSendingStaged(true);
    setSendTransfer(null);
    const filesToSend = [...stagedFiles];
    setStagedFiles([]);

    for (const file of filesToSend) {
      const notifId = newTransferId();
      sendNotifIdRef.current = notifId;
      showTransferProgress(notifId, file.name, 0, true);

      try {
        await webRTCService.waitForConnection();
        await webRTCService.sendFile(file);
      } catch (error) {
        console.error("Failed send file via P2P:", error);
        if (sendNotifIdRef.current === notifId) {
          showTransferResult(
            notifId,
            file.name,
            true,
            false,
            error instanceof Error ? error.message : "Failed connected.",
          );
          sendNotifIdRef.current = null;
        }
      }
    }

    setIsSendingStaged(false);
  };

  const handleAppClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-device-card]")) return;

    if (target.closest("button, input, label, a, [role='menuitem']")) return;

    setAppMenu({ x: event.clientX, y: event.clientY });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const onLogout = async () => {
    const result = await handleLogout();
    if (!result.success) {
      alert(result.message);
    }
  };

  return {
    appMenu,
    devices,
    setDevices,
    selectedDevice,
    setSelectedDevice,
    clipboardHistory,
    setClipboardHistory,
    isP2PConnected,
    isReconnecting,
    stagedFiles,
    setStagedFiles,
    isDraggingOver,
    setIsDraggingOver,
    isSendingStaged,
    currentUser,
    deviceInfo,
    sendTransfer,
    receiveTransfer,
    handleConnectP2P,
    handleRefreshConnection,
    handleRemoveDevice,
    handleFileChange,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleRemoveStagedFile,
    handleSendStagedFiles,
    handleAppClick,
    formatFileSize,
    fileInputRef,
    onLogout,
  };
}
