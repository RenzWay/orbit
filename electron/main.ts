import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  Tray,
} from "electron";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(__dirname, "../public");

let win: BrowserWindow | null;
let tray: Tray | null;
let isQuitting = false;
const PROTOCOL = "orbit";

// Simpen URL deep link kalau app baru "cold start" lewat orbit://
// (window belum sempat ada saat event ini kejadian)
let pendingDeepLink: string | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools();
  }

  win.webContents.on("did-finish-load", () => {
    if (pendingDeepLink) {
      win?.webContents.send("deep-link", pendingDeepLink);
      pendingDeepLink = null;
    }
  });

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win?.hide();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const dist =
      process.env.DIST && process.env.DIST !== "undefined"
        ? process.env.DIST
        : path.join(__dirname, "../dist");
    win.loadFile(path.join(dist, "index.html"));
  }
}

function getAppIconPath() {
  const iconDir = app.isPackaged
    ? (process.env.DIST as string)
    : path.join(__dirname, "../public");
  return path.join(iconDir, "mdi_orbit.png");
}

function createTray() {
  const iconDir = app.isPackaged
    ? (process.env.DIST as string)
    : path.join(__dirname, "../public");
  const iconPath = path.join(iconDir, "mdi_orbit.png");

  const trayIcon = nativeImage
    .createFromPath(iconPath)
    .resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip("Orbit - is active");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Orbit",
      click: () => {
        win?.show();
        win?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Exit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    win?.show();
    win?.focus();
  });
}

function handleDeepLink(url: string) {
  console.log("[deep-link] menerima:", url);
  if (win && !win.webContents.isLoading()) {
    win.webContents.send("deep-link", url);
  } else {
    pendingDeepLink = url;
  }
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
}

// --- Daftarin app sebagai penangan scheme orbit:// ---
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// --- Cegah app kebuka dobel ---
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (url) handleDeepLink(url);
    else if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();

    const initialUrl = process.argv.find((arg) =>
      arg.startsWith(`${PROTOCOL}://`),
    );
    if (initialUrl) {
      pendingDeepLink = initialUrl;
    }
  });
}

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

ipcMain.handle("open-external", async (_event, url: string) => {
  if (!url.startsWith("https://")) {
    throw new Error("Only HTTPS URLs may be opened externally");
  }
  const { shell } = await import("electron");
  await shell.openExternal(url);
});

ipcMain.handle("write-clipboard", (_event, text: unknown) => {
  if (typeof text !== "string") {
    throw new Error("Clipboard text must be a string");
  }
  clipboard.writeText(text);
});

ipcMain.handle("get-device-info", () => {
  const platformLabel =
    process.platform === "win32"
      ? "Windows"
      : process.platform === "darwin"
        ? "Mac"
        : "Linux";

  return {
    hostname: os.hostname(),
    platform: platformLabel,
  };
});

// --- Notifikasi native ---
// Dipakai buat 3 jenis notif (niru pola dari sisi mobile): device
// connected, progress transfer, dan hasil transfer. `id` dipakai buat
// nge-"update" notif yang sama (progress -> hasil) dengan cara nutup yang
// lama sebelum nampilin yang baru, biar ga numpuk banyak notif per transfer.
const activeNotifications = new Map<number, Notification>();

ipcMain.handle(
  "notify",
  (
    _event,
    payload: {
      id: number;
      title: string;
      body?: string;
      silent?: boolean;
      urgent?: boolean;
    },
  ) => {
    if (!Notification.isSupported()) return;

    activeNotifications.get(payload.id)?.close();

    const notification = new Notification({
      title: payload.title,
      body: payload.body ?? "",
      silent: payload.silent ?? false,
      icon: nativeImage.createFromPath(getAppIconPath()),
      urgency: payload.urgent ? "critical" : "normal",
    });

    notification.on("click", () => {
      win?.show();
      win?.focus();
    });
    notification.on("close", () => {
      if (activeNotifications.get(payload.id) === notification) {
        activeNotifications.delete(payload.id);
      }
    });

    notification.show();
    activeNotifications.set(payload.id, notification);
  },
);

ipcMain.handle("close-notification", (_event, id: number) => {
  activeNotifications.get(id)?.close();
  activeNotifications.delete(id);
});
