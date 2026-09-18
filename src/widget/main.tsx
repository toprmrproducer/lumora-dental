import { createRoot } from "react-dom/client";
import { Widget } from "./Widget";
import css from "./widget.css?inline";

function mount() {
  if (document.querySelector(".mola-voice-root")) return;
  const style = document.createElement("style");
  style.setAttribute("data-mola", "widget");
  style.textContent = css;
  document.head.appendChild(style);

  const host = document.createElement("div");
  host.className = "mola-voice-root";
  document.body.appendChild(host);
  createRoot(host).render(<Widget />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
