import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { auth, db, googleProvider } from "../firebase/firebase";
import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  set,
} from "firebase/database";

class OrbitModel {
  /**
   * ==================
   * Auth App
   * ==================
   */
  async loginWithGoogle() {
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  async getLoginResult() {
    console.log("orbitModel.getLoginResult() called.");
    try {
      const result = await getRedirectResult(auth);
      if (result) {
        console.log(`orbitModel: getRedirectResult successful. User: ${result.user.email}`);
        return result.user;
      }
      console.log("orbitModel: getRedirectResult returned null (no pending redirect result).");
      return null;
    } catch (e) {
      console.error("orbitModel: Error in getRedirectResult:", e);
      throw e;
    }
  }

  async logOut() {
    try {
      await signOut(auth);

      console.log("User log out");
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  /**
   * ==================
   * Presence & Device Sync
   * ==================
   */

  async setDeviceOnline(userId: string, deviceId: string, deviceName: string) {
    const deviceRef = ref(db, `presence/${userId}/${deviceId}`);
    const connectedRef = ref(db, ".info/connected");

    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(deviceRef).set({
          deviceName,
          status: "offline",
          lastSeen: serverTimestamp(),
        });

        set(deviceRef, {
          deviceName,
          status: "online",
          lastSeen: serverTimestamp(),
        });
      }
    });
  }

  listenToDevices(userId: string, callback: (device: any[]) => void) {
    const presenceRef = ref(db, `presence/${userId}`);

    return onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        callback([]);
        return;
      }

      const deviceList = Object.keys(data).map((id) => ({
        id,
        ...data[id],
      }));

      callback(deviceList);
    });
  }
}

export const orbitModel = new OrbitModel();
