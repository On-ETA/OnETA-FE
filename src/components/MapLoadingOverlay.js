import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, typography } from "../theme";

export function MapLoadingOverlay() {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(progress, {
      toValue: 1, duration: 1200, useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Text accessibilityLiveRegion="polite" style={styles.label}>지도를 불러오는 중</Text>
      <View accessibilityRole="progressbar" accessibilityLabel="지도 로딩" style={styles.track}>
        <Animated.View style={[styles.bar, {
          transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-72, 180] }) }],
        }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.9)" },
  label: { ...typography.body01Sb, color: colors.gray09, marginBottom: 16 },
  track: { width: 180, height: 4, borderRadius: 2, backgroundColor: colors.gray03, overflow: "hidden" },
  bar: { width: 72, height: 4, borderRadius: 2, backgroundColor: colors.main },
});
