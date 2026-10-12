import { useEffect, useRef } from "react";
import { BackHandler, Platform } from "react-native";

export function useAndroidBackPress(handler, enabled = true) {
  const latestHandler = useRef(handler);
  latestHandler.current = handler;
  useEffect(() => {
    if (Platform.OS !== "android" || !enabled) return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => latestHandler.current());
    return () => subscription.remove();
  }, [enabled]);
}
