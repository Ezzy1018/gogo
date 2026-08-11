import React from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./styles/tokens.css"
import "./styles/components.css"

const host = document.getElementById("root")
if (!host) throw new Error("Missing #root element in index.html")

createRoot(host).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
