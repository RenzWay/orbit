import { MoonIcon, SunIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
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
      type="button"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={isDark}
      className="group flex w-full items-center gap-2 rounded-xl border border-black/5 bg-white p-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
      onClick={() => setIsDark((current) => !current)}>
      <motion.span
        aria-hidden="true"
        className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-amber-100 text-amber-600 dark:bg-indigo-400/15 dark:text-indigo-300"
        animate={{
          backgroundColor: isDark ? "rgba(129, 140, 248, 0.15)" : "rgba(254, 243, 199, 1)",
        }}
        transition={{ duration: 0.25 }}>
        <AnimatePresence initial={false} mode="wait">
          {isDark ? (
            <motion.span
              key="moon"
              initial={{ opacity: 0, rotate: -50, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 50, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}>
              <MoonIcon size={17} />
            </motion.span>
          ) : (
            <motion.span
              key="sun"
              initial={{ opacity: 0, rotate: 50, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: -50, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}>
              <SunIcon size={17} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>

      <span className="flex-1 text-left">Appearance</span>

      <span className="relative h-6 w-11 rounded-full bg-slate-200 p-0.5 transition-colors dark:bg-slate-600">
        <motion.span
          className="block h-5 w-5 rounded-full bg-white shadow-sm"
          animate={{ x: isDark ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </span>

      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={isDark ? "dark" : "light"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="w-10 text-right text-xs text-slate-500 dark:text-zinc-400">
          {isDark ? "Dark" : "Light"}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
