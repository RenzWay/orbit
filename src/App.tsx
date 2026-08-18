import { useState } from "react";
import { usePeer } from "./hooks/usePeer";

function App() {
  const { peerId, status, connect } = usePeer();
  const [targetPeerId, setTargetPeerId] = useState("");

  return (
    <section>
      <h1>AirTrash</h1>

      <p>Status: {status}</p>
      <p>Peer ID: {peerId}</p>
      <hr />

      <input
        value={targetPeerId}
        onChange={(event) => {
          setTargetPeerId(event.target.value);
        }}
        placeholder="Peer Id destination"
      />

      <button
        onClick={() => {
          connect(targetPeerId);
        }}>
        Connect
      </button>
    </section>
  );
}
export default App;
