import React, { useEffect, useState } from "react";

// Mount only while a request is pending so each request gets its own delay.
export function DelayedLoading({ children, fallback = null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return visible ? children : fallback;
}
