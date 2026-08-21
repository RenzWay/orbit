import { useCallback, useState } from "react";
import { QrScanner } from "../components/transfer/QrScanner";
import { TransferQr } from "../components/transfer/TransferQr";
import { usePeer } from "../hooks/usePeer";
import { FilePicker } from "../components/transfer/FilePicker";

function App() {
  const { peerId, status, session, connect, sendFile, sendingFiles } =
    usePeer();

  const [scanning, setScanning] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  const handleConnect = () => {
    const token = tokenInput.trim().toUpperCase();

    if (!token) return;
    connect(token);
  };

  const handleScan = useCallback(
    (data: string) => {
      console.log("🔥 QR DATA:", data);

      const peerId = data.trim();

      console.log("🔥 CONNECTING:", peerId);

      connect(peerId);
      setScanning(false);
    },
    [connect],
  );

  return (
    <main>
      <h1>AirTrash</h1>

      <p>Status: {status}</p>

      {/* SENDER */}
      {session && (
        <>
          <h3>My Token</h3>
          <h1>{peerId}</h1>

          <TransferQr session={session} />
        </>
      )}

      <hr />

      {/* RECEIVER */}
      <h3>Connect with Token</h3>

      <input
        type="text"
        placeholder="Contoh: 8KQ4XM"
        value={tokenInput}
        onChange={(e) => setTokenInput(e.target.value)}
      />

      <button onClick={handleConnect}>Connect</button>

      <hr />
      {status === "connected" && (
        <>
          <h2>Connected</h2>

          <FilePicker onSend={sendFile} sendingFiles={sendingFiles} />
        </>
      )}

      <button onClick={() => setScanning(true)}>Scan QR</button>

      {scanning && <QrScanner onScan={handleScan} />}
    </main>
  );
}

export default App;
