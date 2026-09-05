import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  writeClipboard: (text: string) => ipcRenderer.invoke("write-clipboard", text),
  getDeviceInfo: () =>
    ipcRenderer.invoke("get-device-info") as Promise<{
      hostname: string;
      platform: string;
    }>,
  getSystemState: () =>
    ipcRenderer.invoke("get-system-state") as Promise<{
      isSuspended: boolean;
      platform: string;
    }>,
  onDeepLink: (callback: (url: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) =>
      callback(url);
    ipcRenderer.on("deep-link", listener);

    return () => ipcRenderer.removeListener("deep-link", listener);
  },
  onSystemResumed: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("system-resumed", listener);

    return () => ipcRenderer.removeListener("system-resumed", listener);
  },
  notify: (payload: {
    id: number;
    title: string;
    body?: string;
    silent?: boolean;
    urgent?: boolean;
  }) => ipcRenderer.invoke("notify", payload),
  closeNotification: (id: number) =>
    ipcRenderer.invoke("close-notification", id),
  
  showMirroredNotification: (payload: {
    key: string;
    packageName: string;
    title: string;
    text?: string;
  }) => ipcRenderer.invoke("show-mirrored-notification", payload),

  closeMirroredNotification: (key: string) =>
    ipcRenderer.invoke("close-mirrored-notification", key),
});
