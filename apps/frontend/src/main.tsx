import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

// Mark successful app boot so index.html offline fallback can stay hidden.
(window as Window & { __MINIERP_BOOTED__?: boolean }).__MINIERP_BOOTED__ = true;

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
