import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  writeClipboard: (text: string) => ipcRenderer.invoke("write-clipboard", text),
  getDeviceInfo: () =>
    ipcRenderer.invoke("get-device-info") as Promise<{
      hostname: string;
      platform: string;
    }>,
  onDeepLink: (callback: (url: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) =>
      callback(url);
    ipcRenderer.on("deep-link", listener);

    return () => ipcRenderer.removeListener("deep-link", listener);
  },
});
