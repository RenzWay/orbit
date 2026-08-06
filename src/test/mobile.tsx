import { useState } from "react";
import { Send, Clipboard, Settings, FileText, Wifi, WifiOff } from "lucide-react";

// ORBIT — Mobile screen mockup
// Tema: "space/orbit" — background gelap, cincin orbit berputar di sekitar
// avatar device sebagai penanda koneksi aktif (signature visual aplikasi).
// Palet: navy gelap (#0B0F1A / #121826), aksen cyan (#4DE8C7), aksen coral (#FF6B4A)

const devices = [
  { id: 1, name: "PC Rendra", type: "desktop", status: "online" },
  { id: 2, name: "Laptop Kerja", type: "desktop", status: "offline" },
];

function OrbitRing({ active }: { active: boolean }) {
  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      {active && (
        <span
          className="absolute inset-0 rounded-full border border-[#4DE8C7]/60"
          style={{ animation: "spin 3s linear infinite" }}
        />
      )}
      {active && (
        <span
          className="absolute w-1.5 h-1.5 rounded-full bg-[#4DE8C7]"
          style={{
            animation: "spin 3s linear infinite",
            transformOrigin: "1.75rem 1.75rem",
          }}
        />
      )}
      <div className="w-9 h-9 rounded-full bg-[#1C2333] flex items-center justify-center text-[10px] font-medium text-[#8B93A7] border border-white/5">
        {active ? "PC" : "LP"}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function OrbitMobile() {
  const [tab, setTab] = useState("devices");

  return (
    <div className="w-[320px] mx-auto bg-[#0B0F1A] rounded-4xl p-4 font-sans text-white min-h-150 border border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-1 pt-2">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[#4DE8C7]/70">Orbit</p>
          <h1 className="text-lg font-semibold text-white">Device kamu</h1>
        </div>
        <button className="w-8 h-8 rounded-full bg-[#1C2333] flex items-center justify-center border border-white/5">
          <Settings size={15} className="text-[#8B93A7]" />
        </button>
      </div>

      {/* Active status banner */}
      <div className="flex items-center gap-2 bg-[#12281F] border border-[#4DE8C7]/20 rounded-xl px-3 py-2 mb-5">
        <Wifi size={13} className="text-[#4DE8C7]" />
        <p className="text-[11px] text-[#4DE8C7]">Orbit aktif, siap menerima file</p>
      </div>

      {/* Device list */}
      <p className="text-[11px] uppercase tracking-wider text-[#8B93A7] mb-2 px-1">Tersedia</p>
      <div className="flex flex-col gap-2 mb-6">
        {devices.map((d) => (
          <button
            key={d.id}
            className="flex items-center gap-3 bg-[#121826] hover:bg-[#161e30] transition-colors rounded-2xl p-2.5 border border-white/5 text-left"
          >
            <OrbitRing active={d.status === "online"} />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{d.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {d.status === "online" ? (
                  <span className="text-[11px] text-[#4DE8C7]">Online</span>
                ) : (
                  <span className="text-[11px] text-[#5A6274] flex items-center gap-1">
                    <WifiOff size={9} /> Offline
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <p className="text-[11px] uppercase tracking-wider text-[#8B93A7] mb-2 px-1">Aksi cepat</p>
      <div className="grid grid-cols-2 gap-2">
        <button className="flex flex-col items-center gap-2 bg-[#121826] border border-white/5 rounded-2xl py-4">
          <Send size={16} className="text-[#4DE8C7]" />
          <span className="text-[11px] text-[#C7CCD9]">Kirim file</span>
        </button>
        <button className="flex flex-col items-center gap-2 bg-[#121826] border border-white/5 rounded-2xl py-4">
          <Clipboard size={16} className="text-[#FF6B4A]" />
          <span className="text-[11px] text-[#C7CCD9]">Sync clipboard</span>
        </button>
      </div>

      {/* Bottom nav */}
      <div className="flex justify-around mt-8 pt-3 border-t border-white/5">
        <button
          onClick={() => setTab("devices")}
          className={`text-[11px] ${tab === "devices" ? "text-[#4DE8C7]" : "text-[#5A6274]"}`}
        >
          Device
        </button>
        <button
          onClick={() => setTab("history")}
          className={`text-[11px] flex items-center gap-1 ${tab === "history" ? "text-[#4DE8C7]" : "text-[#5A6274]"}`}
        >
          <FileText size={11} /> Riwayat
        </button>
      </div>
    </div>
  );
}