import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { useIsFocused, useNavigationState } from "@react-navigation/native";

let reducedMotionPreference;
let preferencePromise;

function preloadPreference() {
  if (!preferencePromise) {
    preferencePromise = AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (reducedMotionPreference === undefined) reducedMotionPreference = reduced;
      return reducedMotionPreference;
    }).catch(() => { preferencePromise = null; });
  }
  return preferencePromise;
}

export function initializeScreenTransitions() {
  const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", reduced => {
    reducedMotionPreference = reduced;
  });
  preloadPreference();
  return () => subscription.remove();
}

export function ScreenTransition({ children, transitionKey, active = true, animateOnMount = true, direction, transitionDepth = 0, style }) {
  const progressRef = useRef(null);
  if (!progressRef.current) progressRef.current = new Animated.Value(1);
  const progress = progressRef.current;
  const mounted = useRef(false);
  const previousTransition = useRef({ key: transitionKey, depth: transitionDepth });
  const inferredDirection = useRef("forward");
  const webRun = useRef(0);
  const [webAnimation, setWebAnimation] = useState(null);
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
    setWebAnimation(null);
    const finish = () => { animation?.stop(); progress.setValue(1); setWebAnimation(null); };
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", reduced => {
      reducedMotionPreference = reduced;
      if (reduced) { cancelled = true; finish(); }
    });
    const start = () => {
      if (cancelled || reducedMotionPreference !== false) return;
      if (Platform.OS === "web") {
        const suffix = ++webRun.current % 2 ? "A" : "B";
        setWebAnimation(styles[resolvedDirection + suffix]);
        return;
      }
      progress.setValue(0);
      animation = Animated.timing(progress, {
        toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      });
      animation.start();
    };
    if (shouldAnimate) {
      if (reducedMotionPreference !== undefined) start();
      else preloadPreference().then(start);
    }
    return () => { cancelled = true; animation?.stop(); subscription.remove(); };
  }, [active, transitionKey, animateOnMount, resolvedDirection, progress]);

  return (
    <View style={[styles.frame, style]}>
      {Platform.OS === "web" ? (
        <View style={[styles.content, styles.webAnimation, webAnimation]}>{children}</View>
      ) : (
        <Animated.View style={[styles.content, {
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
          transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [startOffset, 0] }) }],
        }]}>{children}</Animated.View>
      )}
    </View>
  );
}

export function NavigationScreenTransition({ children }) {
  const active = useIsFocused();
  const index = useNavigationState(state => state.index);
  const previousIndex = useRef(index);
  const direction = useRef("forward");
  if (previousIndex.current !== index) {
    direction.current = index < previousIndex.current ? "backward" : "forward";
    previousIndex.current = index;
  }
  return <ScreenTransition active={active} direction={direction.current}>{children}</ScreenTransition>;
}

function webFrames(offset, alternate = false) {
  return {
    [alternate ? "0%" : "from"]: { opacity: 0.6, transform: "translateX(" + offset + "px)" },
    [alternate ? "100%" : "to"]: { opacity: 1, transform: "translateX(0px)" },
  };
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 0, overflow: "hidden" },
  content: { flex: 1, minHeight: 0 },
  ...(Platform.OS === "web" ? {
    webAnimation: { animationDuration: "180ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "both" },
    forwardA: { animationKeyframes: webFrames(24) },
    forwardB: { animationKeyframes: webFrames(24, true) },
    backwardA: { animationKeyframes: webFrames(-24) },
    backwardB: { animationKeyframes: webFrames(-24, true) },
  } : {}),
});
