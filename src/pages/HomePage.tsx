import { useState, useCallback } from "react";
import { usePeer } from "../hooks/usePeer";
import { FilePicker } from "../components/transfer/FilePicker";
import { QrScanner } from "../components/transfer/QrScanner";
import { TransferQr } from "../components/transfer/TransferQr";

export default function HomePage() {
  const { peerId, status, session, connect, sendFile, sendingFiles } =
    usePeer();
  const [scanning, setScanning] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [activeTab, setActiveTab] = useState<"send" | "receive">("send");

  const handleConnect = () => {
    const token = tokenInput.trim().toUpperCase();
    if (!token) return;
    connect(token);
  };

  const handleScan = useCallback(
    (data: string) => {
      connect(data.trim());
      setScanning(false);
    },
    [connect],
  );

  const getStatusBadge = () => {
    switch (status) {
      case "connected":
        return (
          <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-xs font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />{" "}
            Connected
          </span>
        );
      case "connecting":
        return (
          <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 rounded-full text-xs font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-ping" />{" "}
            Connecting...
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded-full text-xs font-semibold">
            Offline
          </span>
        );
    }
  };

  return (
    <section className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between pb-6 border-b border-zinc-800">
          <div>
            <h1 className="text-2xl font-bold tracking-wider text-white">
              AirTrash<span className="text-blue-500">.</span>
            </h1>
            <p className="text-xs text-zinc-400">P2P Instant File Transfer</p>
          </div>
          {getStatusBadge()}
        </header>

        {/* Dynamic Connected View */}
        {status === "connected" ? (
          <div className="py-6 space-y-4">
            <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50 text-center">
              <p className="text-sm text-zinc-400">Siap Mengirim File</p>
            </div>
            <FilePicker onSend={sendFile} sendingFiles={sendingFiles} />
          </div>
        ) : (
          /* Normal Tab View */
          <div className="mt-6">
            <div className="grid grid-cols-2 p-1 bg-zinc-950 rounded-xl mb-6">
              <button
                onClick={() => setActiveTab("send")}
                className={`py-2 text-sm font-medium rounded-lg transition-all ${activeTab === "send" ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"}`}>
                Accept (QR Code)
              </button>
              <button
                onClick={() => setActiveTab("receive")}
                className={`py-2 text-sm font-medium rounded-lg transition-all ${activeTab === "receive" ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"}`}>
                Connect (Input)
              </button>
            </div>

            {/* TAB SEND / SHOW QR */}
            {activeTab === "send" && session && (
              <div className="flex flex-col items-center text-center space-y-4">
                <p className="text-xs text-zinc-400">
                  Show the QR code or share this token with the recipient.
                </p>
                <div className="p-4 bg-white rounded-xl shadow-inner">
                  <TransferQr session={session} />
                </div>

                <div className="w-full bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <span className="text-xs text-zinc-500 block">
                    YOUR TOKEN
                  </span>
                  <span className="text-2xl font-mono font-bold tracking-widest text-blue-400">
                    {peerId || "------"}
                  </span>
                </div>
              </div>
            )}

            {/* TAB RECEIVE / CONNECT */}
            {activeTab === "receive" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400">
                    Enter Token from Another Device
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Contoh: 8KQ4XM"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 font-mono text-center text-lg uppercase tracking-wider focus:outline-none focus:border-blue-500 transition-all"
                    />
                    <button
                      onClick={handleConnect}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 rounded-xl transition-all">
                      Connect
                    </button>
                  </div>
                </div>

                <div className="relative my-4 flex items-center justify-center">
                  <hr className="w-full border-zinc-800" />
                  <span className="absolute bg-zinc-900 px-3 text-xs text-zinc-500">
                    Or
                  </span>
                </div>

                <button
                  onClick={() => setScanning(true)}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl border border-zinc-700/50 transition-all flex items-center justify-center gap-2">
                  📷 Scan QR Code
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal QR Scanner */}
        {scanning && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm bg-zinc-900 rounded-2xl p-4 space-y-4 border border-zinc-800">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-zinc-200">
                  Arahkan Kamera ke QR Code
                </h3>
                <button
                  onClick={() => setScanning(false)}
                  className="text-zinc-500 hover:text-white text-sm">
                  Tutup
                </button>
              </div>
              <div className="overflow-hidden rounded-xl">
                <QrScanner onScan={handleScan} />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
