import { orbitModel } from "../models/orbitModel";

function getErrorMessage(error: unknown, action: "login" | "logout") {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return `Gagal ${action === "login" ? "masuk" : "keluar"}. Silakan coba lagi.`;
}

export async function handleLogin() {
  try {
    await orbitModel.loginWithGoogle();
    return { success: true } as const;
  } catch (error) {
    console.error("Login gagal:", error);
    return { success: false, message: getErrorMessage(error, "login") } as const;
  }
}

export async function handleLogout() {
  try {
    await orbitModel.logout();
    return { success: true } as const;
  } catch (error) {
    console.error("Logout gagal:", error);
    return { success: false, message: getErrorMessage(error, "logout") } as const;
  }
}
