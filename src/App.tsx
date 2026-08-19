import { useCallback, useState } from "react";
import { TransferQr } from "./components/transfer/TransferQr";
import { usePeer } from "./hooks/usePeer";
import { QrScanner } from "./components/transfer/QrScanner";

function App() {
  const { peerId, status, session, connect } = usePeer();

  const [scanning, setScanning] = useState(false);

  const handleScan = useCallback(
    (data: string) => {
      try {
        console.log("RAW QR:", data);

        const payload = JSON.parse(data);

        console.log("QR PAYLOAD:", payload);

        if (!payload.p || !payload.t) {
          throw new Error("Invalid AirTrash QR");
        }

        console.log("CONNECTING TO:", payload.p);

        connect(payload.p);

        setScanning(false);
      } catch (error) {
        console.error("QR ERROR:", error);
      }
    },
    [connect],
  );

  return (
    <section>
      <h1>AirTrash</h1>

      <p>Status: {status}</p>

      {session && <TransferQr session={session} />}

      <hr />

      <button onClick={() => setScanning(true)}>Scan QR</button>

      {scanning && <QrScanner onScan={handleScan} />}

      <p>My Peer ID: {peerId}</p>
    </section>
  );
}
export default App;
