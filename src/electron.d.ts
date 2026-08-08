interface Window {
  electronAPI: {
    openExternal: (url: string) => Promise<void>;
    writeClipboard: (text: string) => Promise<void>;
    onDeepLink: (callback: (url: string) => void) => () => void;
  };
}
