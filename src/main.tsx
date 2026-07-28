import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@/styles/globals.css";

const storedTheme = localStorage.getItem('theme');
document.documentElement.classList.toggle('dark', storedTheme !== 'light');

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
