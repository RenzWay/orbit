interface MirroredNotificationPayload {
  key: string;
  packageName: string;
  appLabel: string;
  title: string;
  text?: string;
  webUrl?: string;
  actions?: MirroredNotificationAction[];
}

interface MirroredNotificationAction {
  index: number;
  title: string;
  canReply: boolean;
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

    submitNotificationReply: (payload: {
      key: string;
      actionIndex: number;
      text: string;
    }) => Promise<void>;

    submitNotificationAction: (payload: {
      key: string;
      actionIndex: number;
    }) => Promise<void>;

    closeReplyWindow: () => Promise<void>;

    onNotificationReplyCommand: (
      callback: (payload: {
        key: string;
        actionIndex: number;
        text: string;
      }) => void,
    ) => () => void;

    onNotificationActionCommand: (
      callback: (payload: { key: string; actionIndex: number }) => void,
    ) => () => void;
  };
}
