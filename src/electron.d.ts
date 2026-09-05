interface MirroredNotificationPayload {
  key: string;
  packageName: string;
  title: string;
  text?: string;
}

interface Window {
  electronAPI: {
    openExternal: (url: string) => Promise<void>;

    writeClipboard: (text: string) => Promise<void>;

    onDeepLink: (callback: (url: string) => void) => () => void;

    getDeviceInfo: () => Promise<{ hostname: string; platform: string }>;
    notify: (payload: {
      id: number;
      title: string;
      body?: string;
      silent?: boolean;
      urgent?: boolean;
    }) => Promise<void>;
    closeNotification: (id: number) => Promise<void>;

    showMirroredNotification: (
      payload: MirroredNotificationPayload,
    ) => Promise<void>;

    closeMirroredNotification: (key: string) => Promise<void>;
  };
}
