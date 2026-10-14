import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export function RouteSearchLoadingScreen({ onFindAnotherRoute }) {
  const dotsRef = useRef(null);
  if (!dotsRef.current) dotsRef.current = [0, 1, 2].map(() => new Animated.Value(0));
  const dots = dotsRef.current;

  useEffect(() => {
    let disposed = false;
    let animation;
    const stop = () => {
      animation?.stop();
      dots.forEach(dot => dot.setValue(0));
    };
    const animate = reduced => {
      stop();
      if (disposed || reduced) return;
      animation = Animated.loop(Animated.parallel(dots.map((dot, index) => Animated.sequence([
        Animated.delay(index * 140),
        Animated.timing(dot, { toValue: 1, duration: 240, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 240, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(520 - index * 140),
      ]))));
      animation.start();
    };
    let preferenceChanged = false;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", reduced => {
      preferenceChanged = true;
      animate(reduced);
    });
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!preferenceChanged) animate(reduced);
    }).catch(() => {});
    return () => { disposed = true; stop(); subscription.remove(); };
  }, [dots]);

  return (
    <View style={styles.screen}>
      <View accessibilityRole="progressbar" accessibilityLabel="이동 경로를 찾고 있어요" style={styles.dots}>
        {dots.map((dot, index) => (
          <Animated.View key={index} style={[styles.dot, {
            opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }),
            transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
          }]} />
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.title}>이동 경로를 찾고 있어요</Text>
      <Pressable accessibilityRole="button" hitSlop={4} onPress={onFindAnotherRoute} style={styles.button}>
        <Text style={styles.buttonText}>다른 경로로 찾기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.gray01, paddingHorizontal: 24 },
  dots: { flexDirection: "row", alignItems: "center", gap: 8, height: 19, marginBottom: 27 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#64D680" },
  title: { fontFamily: "SUIT", fontSize: 17, fontWeight: "600", lineHeight: 24, color: colors.gray09, textAlign: "center" },
  button: { minWidth: 140, minHeight: 41, marginTop: 14, paddingHorizontal: 17, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.gray04, borderRadius: 8, backgroundColor: colors.white },
  buttonText: { fontFamily: "SUIT", fontSize: 14, fontWeight: "500", lineHeight: 19, color: colors.gray08 },
});
