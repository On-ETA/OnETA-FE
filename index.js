import { registerRootComponent } from "expo";

import App from "./App";

registerRootComponent(App);

if (
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA registration is optional; the app should still run normally.
    });
  });
}
