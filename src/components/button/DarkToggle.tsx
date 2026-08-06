import { MoonIcon, SunIcon } from "lucide-react";
import { useEffect, useState } from "react";

export function DarkToggle() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return true;
    // return window.matchMedia("(prefers-colors-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  return (
    <button
      className={`flex gap-2 p-2 rounded-full justify-center items-center ${isDark ? "bg-zinc-700/75" : "bg-white"}`}
      onClick={() => setIsDark(!isDark)}
    >
      {isDark ? <MoonIcon /> : <SunIcon />}
      <span className="">{isDark ? "Dark Mode" : "Light Mode"}</span>
    </button>
  );
}
