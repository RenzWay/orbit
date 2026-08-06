import "./App.css";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "./firebase/firebase";
import HomePage from "./pages/HomePage";

function App() {
  const [userId, setUserId] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) return null;
  if (!userId) return <Navigate to="/login" replace />;

  return <HomePage userId={userId} />;
}

export default App;
