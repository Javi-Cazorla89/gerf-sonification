import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import OfflineReadyBadge from "./components/OfflineReadyBadge";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <OfflineReadyBadge />
  </React.StrictMode>,
);
