import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Rute } from "./router/router.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Rute />
  </StrictMode>,
);
