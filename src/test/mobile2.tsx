import { useState } from "react";
import { Send, Clipboard, Settings } from "lucide-react";

// ORBIT — Mobile, v2
// Konsep: bukan list device biasa — akun kamu jadi "pusat", device jadi
// satelit yang mengorbit di jalur elips. Ini navigasi utama, bukan dekorasi.
// Palet: indigo gelap (#14172B), emas pudar (#E8A54B), off-white hangat (#EDE6D6)
// Tipografi: monospace untuk label status (kesan mission-control), sans untuk nama

const satellites = [
  { id: 1, name: "PC Rendra", status: "online", angle: -35, radius: 92 },
  { id: 2, name: "Laptop Kerja", status: "offline", angle: 150, radius: 78 },
];

function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius * 0.55 };
}

export default function OrbitMobile2() {
  const [selected, setSelected] = useState(satellites[0]);

  return (
    <div
      className="w-[320px] mx-auto rounded-[2rem] p-5 min-h-[600px] border border-white/5"
      style={{ background: "#14172B", color: "#EDE6D6", fontFamily: "ui-sans-serif, system-ui" }}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] tracking-[0.2em]" style={{ fontFamily: "ui-monospace", color: "#E8A54B99" }}>
          ORBIT
        </p>
        <button className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#1D2138" }}>
          <Settings size={13} style={{ color: "#8B8E9E" }} />
        </button>
      </div>

      {/* Orbit map */}
      <div className="relative flex items-center justify-center" style={{ height: 220 }}>
        {/* orbit path */}
        <div
          className="absolute rounded-full border"
          style={{ width: 184, height: 100, borderColor: "#E8A54B22", borderStyle: "dashed" }}
        />
        {/* center = you */}
        <div
          className="absolute rounded-full flex items-center justify-center text-[10px]"
          style={{ width: 44, height: 44, background: "#1D2138", border: "1px solid #E8A54B44", fontFamily: "ui-monospace" }}
        >
          YOU
        </div>
        {/* satellites */}
        {satellites.map((s) => {
          const pos = polar(s.angle, s.radius);
          const active = s.status === "online";
          return (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="absolute flex flex-col items-center gap-1"
              style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
            >
              <div
                className="rounded-full flex items-center justify-center text-[9px]"
                style={{
                  width: 30,
                  height: 30,
                  background: active ? "#E8A54B" : "#1D2138",
                  color: active ? "#14172B" : "#6E7180",
                  border: active ? "none" : "1px solid #ffffff14",
                  boxShadow: active ? "0 0 0 4px #E8A54B1A" : "none",
                }}
              >
                {s.name.slice(0, 2).toUpperCase()}
              </div>
            </button>
          );
        })}
      </div>

      {/* selected device panel */}
      <div className="rounded-2xl p-3.5 mt-2" style={{ background: "#1A1E33", border: "1px solid #ffffff0d" }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium">{selected.name}</p>
          <span
            className="text-[9px] tracking-widest"
            style={{ fontFamily: "ui-monospace", color: selected.status === "online" ? "#E8A54B" : "#6E7180" }}
          >
            {selected.status === "online" ? "ONLINE" : "STANDBY"}
          </span>
        </div>
        <p className="text-[11px] mb-3" style={{ color: "#8B8E9E" }}>
          {selected.status === "online" ? "Ready to receive files or clipboard" : "Last seen 2 hours ago"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px]"
            style={{ background: "#E8A54B", color: "#14172B" }}
          >
            <Send size={12} /> Send file
          </button>
          <button
            className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px]"
            style={{ background: "#1D2138", color: "#EDE6D6", border: "1px solid #ffffff14" }}
          >
            <Clipboard size={12} /> Clipboard
          </button>
        </div>
      </div>

      <p className="text-center text-[9px] mt-4" style={{ fontFamily: "ui-monospace", color: "#4E5266" }}>
        1 ACTIVE SATELLITE · STABLE SIGNAL
      </p>
    </div>
  );
}