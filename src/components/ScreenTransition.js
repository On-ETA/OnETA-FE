import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { useIsFocused, useNavigationState } from "@react-navigation/native";

export function ScreenTransition({ children, transitionKey, active = true, animateOnMount = true, direction, transitionDepth = 0, style }) {
  const progress = useRef(new Animated.Value(1)).current;
  const mounted = useRef(false);
  const previousTransition = useRef({ key: transitionKey, depth: transitionDepth });
  const inferredDirection = useRef("forward");
  if (previousTransition.current.key !== transitionKey) {
    inferredDirection.current = transitionDepth < previousTransition.current.depth ? "backward" : "forward";
    previousTransition.current = { key: transitionKey, depth: transitionDepth };
  }
  const resolvedDirection = direction ?? inferredDirection.current;
  const startOffset = resolvedDirection === "backward" ? -24 : 24;

  useEffect(() => {
    const shouldAnimate = active && (mounted.current || animateOnMount);
    mounted.current = true;
    let cancelled = false;
    let animation;
    progress.stopAnimation();
    progress.setValue(1);
    const finish = () => { animation?.stop(); progress.setValue(1); };
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", reduced => {
      if (reduced) { cancelled = true; finish(); }
    });
    if (shouldAnimate) {
      AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
        if (cancelled || reduced) return;
        progress.setValue(0);
        animation = Animated.timing(progress, {
          toValue: 1, duration: 220, easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        });
        animation.start();
      }).catch(() => { if (!cancelled) finish(); });
    }
    return () => { cancelled = true; animation?.stop(); subscription.remove(); };
  }, [active, transitionKey, animateOnMount, resolvedDirection, progress]);

  return (
    <View style={[styles.frame, style]}>
      <Animated.View style={[styles.content, {
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
        transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [startOffset, 0] }) }],
      }]}>{children}</Animated.View>
    </View>
  );
}

export function NavigationScreenTransition({ children }) {
  const active = useIsFocused();
  const state = useNavigationState(value => value);
  const previousState = useRef(state);
  const direction = useRef("forward");
  if (previousState.current !== state) {
    direction.current = state.index < previousState.current.index ? "backward" : "forward";
    previousState.current = state;
  }
  return <ScreenTransition active={active} direction={direction.current}>{children}</ScreenTransition>;
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 0, overflow: "hidden" },
  content: { flex: 1, minHeight: 0 },
});
