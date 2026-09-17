import { registerRootComponent } from "expo";
import React, { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { isHeadlessLaunch, registerBackgroundFcmHandler } from "./src/service/fcm";

import App from "./App";

registerBackgroundFcmHandler();

function AppEntry({ isHeadless }) {
  const [ready, setReady] = useState(Platform.OS !== "ios" && !isHeadless);
  useEffect(() => {
    let mounted = true;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setReady(true);
    });
    if (Platform.OS === "ios") {
      isHeadlessLaunch().then((headless) => {
        if (mounted && !headless) setReady(true);
      }).catch((error) => console.warn("[FCM] Headless check failed", error?.code));
    }
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return ready ? <App /> : null;
}

registerRootComponent(AppEntry);
