import { app, BrowserWindow, clipboard, ipcMain } from "electron";
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

  win.webContents.openDevTools();

  win.webContents.on("did-finish-load", () => {
    if (pendingDeepLink) {
      win?.webContents.send("deep-link", pendingDeepLink);
      pendingDeepLink = null;
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

    const initialUrl = process.argv.find((arg) =>
      arg.startsWith(`${PROTOCOL}://`),
    );
    if (initialUrl) {
      pendingDeepLink = initialUrl;
    }
  });
}

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
