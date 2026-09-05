export type NotificationTarget = {
  desktopApp?: string;
  webUrl?: string;
};

const targets: Record<string, NotificationTarget> = {
  "com.google.android.gm": {
    webUrl: "https://mail.google.com",
  },

  "com.shopee.id": {
    webUrl: "https://shopee.co.id",
  },

  "com.whatsapp": {
    desktopApp: "WhatsApp",
    webUrl: "https://web.whatsapp.com",
  },

  "org.telegram.messenger": {
    desktopApp: "Telegram",
    webUrl: "https://web.telegram.org",
  },
};

export function getNotificationTarget(
  packageName: string,
): NotificationTarget | undefined {
  return targets[packageName];
}
