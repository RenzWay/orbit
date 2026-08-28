import { useState } from "react";
import {
  Send,
  Clipboard,
  Settings,
  UploadCloud,
  Wifi,
  WifiOff,
  FileText,
} from "lucide-react";

// ORBIT — Desktop screen mockup (Tauri)
// Konsisten dengan versi mobile: navy gelap, cincin orbit sebagai signature
// visual koneksi, aksen cyan (#4DE8C7) untuk status aktif.

const devices = [
  { id: 1, name: "Ponsel Rendra", type: "mobile", status: "online" },
  { id: 2, name: "Tablet", type: "mobile", status: "offline" },
];

function OrbitRing({ active, size }: { active: boolean; size: number }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {active && (
        <span
          className="absolute inset-0 rounded-full border border-[#4DE8C7]/60"
          style={{ animation: "spin 3s linear infinite" }}
        />
      )}
      <div
        className="rounded-full bg-[#1C2333] flex items-center justify-center text-[10px] font-medium text-[#8B93A7] border border-white/5"
        style={{ width: size * 0.64, height: size * 0.64 }}
      >
        HP
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function OrbitDesktop() {
  const [selected, setSelected] = useState(devices[0]);

  return (
    <div className="w-180 h-110 mx-auto bg-[#0B0F1A] rounded-xl overflow-hidden border border-white/5 flex font-sans text-white">
      {/* Sidebar */}
      <div className="w-55 bg-[#0E1420] border-r border-white/5 p-4 flex flex-col">
        <div className="mb-6 px-1">
          <p className="text-[10px] uppercase tracking-widest text-[#4DE8C7]/70">
            Orbit
          </p>
          <h1 className="text-base font-semibold">Your device</h1>
        </div>

        <p className="text-[10px] uppercase tracking-wider text-[#8B93A7] mb-2 px-1">
          Available
        </p>
        <div className="flex flex-col gap-1.5">
          {devices.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d)}
              className={`flex items-center gap-2.5 rounded-xl p-2 text-left border transition-colors ${
                selected.id === d.id
                  ? "bg-[#12281F] border-[#4DE8C7]/25"
                  : "bg-transparent border-transparent hover:bg-[#121826]"
              }`}
            >
              <OrbitRing active={d.status === "online"} size={30} />
              <div>
                <p className="text-xs font-medium">{d.name}</p>
                {d.status === "online" ? (
                  <span className="text-[10px] text-[#4DE8C7]">Online</span>
                ) : (
                  <span className="text-[10px] text-[#5A6274] flex items-center gap-1">
                    <WifiOff size={8} /> Offline
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-2 bg-[#12281F] border border-[#4DE8C7]/20 rounded-lg px-2.5 py-2">
          <Wifi size={11} className="text-[#4DE8C7]" />
          <p className="text-[10px] text-[#4DE8C7]">Active in tray</p>
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 p-6 flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <OrbitRing active={selected.status === "online"} size={34} />
            <div>
              <p className="text-sm font-medium">{selected.name}</p>
              <p className="text-[11px] text-[#5A6274]">
                Send files or clipboard
              </p>
            </div>
          </div>
          <button className="w-8 h-8 rounded-full bg-[#121826] flex items-center justify-center border border-white/5">
            <Settings size={14} className="text-[#8B93A7]" />
          </button>
        </div>

        {/* Drop zone */}
        <div className="flex-1 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 mb-4">
          <UploadCloud size={26} className="text-[#5A6274]" />
          <p className="text-xs text-[#8B93A7]">
            Drop a file here, or click to browse
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-2 bg-[#4DE8C7] text-[#0B0F1A] rounded-xl py-2.5 text-xs font-medium">
            <Send size={13} /> Send file
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 bg-[#121826] border border-white/5 rounded-xl py-2.5 text-xs text-[#C7CCD9]">
            <Clipboard size={13} className="text-[#FF6B4A]" /> Sync clipboard
          </button>
          <button className="flex items-center justify-center gap-2 bg-[#121826] border border-white/5 rounded-xl py-2.5 px-3 text-xs text-[#C7CCD9]">
            <FileText size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
