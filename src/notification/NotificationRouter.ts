export type NotificationTarget = {
  appLabel: string;
  desktopApp?: string;
  webUrl?: string;
};

const targets: Record<string, NotificationTarget> = {
  "com.google.android.gm": {
    appLabel: "Gmail",
    webUrl: "https://mail.google.com",
  },
  "com.shopee.id": {
    appLabel: "Shopee",
    webUrl: "https://shopee.co.id",
  },
  "com.whatsapp": {
    appLabel: "WhatsApp",
    desktopApp: "WhatsApp",
    webUrl: "https://web.whatsapp.com",
  },
  "org.telegram.messenger": {
    appLabel: "Telegram",
    desktopApp: "Telegram",
    webUrl: "https://web.telegram.org",
  },
};

export function getNotificationTarget(
  packageName: string,
): NotificationTarget | undefined {
  return targets[packageName];
}