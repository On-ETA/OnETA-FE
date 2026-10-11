import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, typography } from "../theme";

export function DeletionProgressModal({ visible }) {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    setDotCount(1);
    if (!visible) return undefined;
    const timer = setInterval(() => setDotCount(count => count % 3 + 1), 500);
    return () => clearInterval(timer);
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={() => {}}>
      {visible ? (
        <SafeAreaView edges={["bottom"]} style={styles.overlay}>
          <Text accessibilityRole="progressbar" accessibilityLabel="삭제중입니다" style={styles.label}>
            {`삭제중입니다 ${".".repeat(dotCount)}`}
          </Text>
        </SafeAreaView>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 20, paddingBottom: 24 },
  label: { ...typography.caption01M, color: colors.point, fontStyle: "normal", lineHeight: 19.2, letterSpacing: -0.12, textAlign: "center" },
});
