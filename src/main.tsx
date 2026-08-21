import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./style/index.css";
import { Routers } from "./router/Router.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Routers />
  </StrictMode>,
);
