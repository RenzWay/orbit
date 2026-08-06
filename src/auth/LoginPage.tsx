import { auth } from "@/firebase/firebase";
import { OrbitIcon } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { useNavigate } from "react-router-dom";
import { handleLogin } from "../utils/handle/handleLogin";
import { orbitModel } from "../model/model";

export default function LoginPage() {
  const [isLoading, setIsloading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkLogin = async () => {
      // Attempt to get redirect result first
      try {
        const userFromRedirect = await orbitModel.getLoginResult();
        if (userFromRedirect) {
          console.log("Logged in from redirect, navigating to /");
          navigate("/", { replace: true });
          return;
        }
      } catch (error) {
        console.error("Error getting redirect result:", error);
      }

      // Then set up auth state listener
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log("Logged in from auth state change, navigating to /");
          navigate("/", { replace: true });
        }
      });
      return () => unsub();
    };

    checkLogin();
  }, [navigate]);

  return (
    <section className="h-screen w-screen bg-black flex items-center justify-center p-4">
      {/* Main Container Card */}
      <div className="bg-linear-to-br  from-blue-950 to-slate-900 text-white rounded-3xl flex flex-col md:flex-row overflow-hidden max-w-4xl w-full shadow-2xl border border-blue-900/40">
        {/* Left Side - Login Form */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-14 text-center min-h-105">
          <div className="flex flex-col items-center gap-3 mb-8">
            <OrbitIcon
              className="text-cyan-400 animate-spin hover:scale-105 transition-all"
              size="3.2rem"
            />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">
                Welcome To Orbit
              </h1>
              <p className="text-xs text-neutral-400 tracking-wide font-normal">
                Please login first to use Orbit
              </p>
            </div>
          </div>

          <button
            disabled={isLoading}
            onClick={() => handleLogin({ setIsLoading: setIsloading })}
            className="w-full max-w-xs flex items-center justify-center gap-3 bg-[#2A3447] active:scale-95 hover:bg-[#344158] transition-all py-3.5 px-6 rounded-full font-medium text-sm text-white shadow-lg"
          >
            {isLoading ? (
              <>loading..</>
            ) : (
              <>
                <FcGoogle size="1.4em" />
                <span>Login with Google</span>
              </>
            )}
          </button>
        </div>

        {/* Right Side - Image Banner */}
        <div className="flex-1 relative min-h-75 md:min-h-115 p-2 md:p-3">
          <img
            className="w-full h-125 object-cover rounded-2xl md:rounded-3xl hover:scale-105 transition-all"
            src="./background.jpg"
            alt="Orbit background"
          />
        </div>
      </div>
    </section>
  );
}
