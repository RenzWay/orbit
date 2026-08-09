import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  set,
} from "firebase/database";
import { signInWithCredential, GoogleAuthProvider, signOut } from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import type { Device } from "../types/orbit";

// Halaman auth eksternal yang di-hosting (Firebase Hosting) — sama persis
// dengan yang dipakai versi Tauri kemarin. Pakai domain firebaseapp.com
// (bukan .web.app) biar satu origin sama authDomain.
const AUTH_PAGE_URL = "https://letter-26c71.firebaseapp.com/auth.html";

class OrbitModel {
  /**
   * =================
   * Login with google
   * =================
   * Login TIDAK dilakukan di dalam window Electron (Google blokir embedded
   * browser). Buka browser default OS ke halaman auth eksternal, hasilnya
   * "dilempar balik" lewat orbit://auth-callback, ditangkep DeepLinkListener.
   */
  async loginWithGoogle() {
    try {
      await window.electronAPI.openExternal(AUTH_PAGE_URL);
    } catch (e) {
      throw e;
    }
  }

  /** Dipanggil DeepLinkListener setelah dapet idToken dari orbit://auth-callback */
  async completeLoginWithIdToken(idToken: string) {
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);
    return result.user;
  }

  async logout() {
    try {
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  }

  setDeviceOnline(userId: string, deviceId: string, deviceName: string) {
    const deviceRef = ref(db, `presence/${userId}/${deviceId}`);
    return onValue(ref(db, ".info/connected"), (snapshot) => {
      if (!snapshot.val()) return;
      void onDisconnect(deviceRef).set({
        deviceName,
        status: "offline",
        lastSeen: serverTimestamp(),
      });
      void set(deviceRef, {
        deviceName,
        status: "online",
        lastSeen: serverTimestamp(),
      });
    });
  }

  listenToDevices(userId: string, callback: (devices: Device[]) => void) {
    return onValue(ref(db, `presence/${userId}`), (snapshot) => {
      const data = snapshot.val();
      callback(
        data
          ? Object.entries(data).map(([id, value]) => ({
              id,
              ...(value as Omit<Device, "id">),
            }))
          : [],
      );
    });
  }
}

export const orbitModel = new OrbitModel();
