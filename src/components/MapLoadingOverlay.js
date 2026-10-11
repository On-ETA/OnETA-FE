import React from "react";
import { StyleSheet, Text } from "react-native";
import { colors, typography } from "../theme";

export function MapLoadingOverlay() {
  return (
    <Text pointerEvents="none" accessibilityLiveRegion="polite" style={styles.label}>지도를 불러오는 중</Text>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.caption01M, color: colors.point, fontStyle: "normal", lineHeight: 19.2, letterSpacing: -0.12, textAlign: "center", marginBottom: 7 },
});
