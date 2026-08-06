import { auth } from "@/firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { orbitModel } from "../model/model";

export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // First, try to get any pending redirect result
      try {
        const userFromRedirect = await orbitModel.getLoginResult();
        if (userFromRedirect) {
          setUser(userFromRedirect);
          setLoading(false);
          return; // If redirect result handles it, we're done here
        }
      } catch (error) {
        console.error("Error getting redirect result in PrivateRoute:", error);
        // Continue even if there's an error, onAuthStateChanged might still work
      }

      // Then, set up the auth state listener
      const unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });
      return () => unsub();
    };

    checkAuth();
  }, []);

  if (loading) return <>loading...</>; // atau bisa loading spinner

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
