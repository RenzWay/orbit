import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { orbitModel } from "../models/orbitModel";

/**
 * Nangkep event 'deep-link' yang dikirim main.ts saat OS meneruskan URL
 * orbit://auth-callback?idToken=... (setelah user login di browser eksternal).
 * Render komponen ini SEKALI di root, di dalam <BrowserRouter>.
 */
export function DeepLinkListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const listener = async (rawUrl: string) => {
      console.log("DeepLinkListener: menerima URL", rawUrl);
      try {
        const url = new URL(rawUrl);
        if (url.protocol !== "orbit:" || url.hostname !== "auth-callback") return;

        const idToken = url.searchParams.get("idToken");
        if (!idToken) {
          console.error("DeepLinkListener: idToken tidak ditemukan");
          return;
        }

        await orbitModel.completeLoginWithIdToken(idToken);
        navigate("/", { replace: true });
      } catch (e) {
        console.error("DeepLinkListener: gagal proses URL", rawUrl, e);
      }
    };

    return window.electronAPI.onDeepLink(listener);
  }, [navigate]);

  return null;
}
