import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BellIcon from "../../assets/images/icon_bell.svg";
import { startFcm } from "./lifecycle";
import { clearPendingNotification, openNotificationInbox } from "./navigation";

export function PushNotifications() {
  const [message, setMessage] = useState(null);
  const insets = useSafeAreaInsets();

  useEffect(() => startFcm({
    onForegroundMessage: (nextMessage) => {
      if (nextMessage.notification?.title || nextMessage.data?.title) {
        setMessage(nextMessage);
      }
    },
    onNotificationOpen: openNotificationInbox,
    onSessionEnd: () => {
      setMessage(null);
      clearPendingNotification();
    },
  }), []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  const title = message.notification?.title ?? message.data?.title;
  const body = message.notification?.body ?? message.data?.body;

  return (
    <View pointerEvents="box-none" style={[styles.overlay, { top: insets.top + 8 }]}>
      <View accessibilityLiveRegion="polite" style={styles.banner}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. 알림 열기`}
          onPress={() => { setMessage(null); openNotificationInbox(); }}
          style={styles.content}
        >
          <BellIcon width={24} height={24} />
          <View style={styles.copy}>
            <Text numberOfLines={2} style={styles.title}>{title}</Text>
            {body ? <Text numberOfLines={2} style={styles.body}>{body}</Text> : null}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="알림 닫기"
          onPress={() => setMessage(null)}
          style={styles.dismiss}
        >
          <Text style={styles.close}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: 12, right: 12, zIndex: 100, alignItems: "center" },
  banner: {
    width: "100%", maxWidth: 560, flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", borderColor: "#C8D4CD", borderWidth: 1, borderRadius: 8,
    elevation: 6, shadowColor: "#000000", shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6,
  },
  content: { flex: 1, flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  copy: { flex: 1 },
  title: { color: "#202825", fontSize: 14, fontWeight: "600" },
  body: { color: "#59645F", fontSize: 13, lineHeight: 18, marginTop: 4 },
  dismiss: { width: 44, minHeight: 48, alignItems: "center", justifyContent: "center" },
  close: { fontSize: 24, color: "#59645F" },
});
