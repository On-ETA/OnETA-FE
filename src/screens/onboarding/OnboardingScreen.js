import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import OnetaLogo from "../../../assets/images/logo_white.svg";
import { colors, layout } from "../../theme";

// The system draws the status and navigation bars; only the brand artwork lives here.
export function OnboardingScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" backgroundColor="#29D575" />
      <SafeAreaView edges={["bottom"]} style={styles.phone}>
        <View style={styles.content}>
          <Svg
            width="100%"
            height="100%"
            style={StyleSheet.absoluteFill}
            accessible={false}
          >
            <Defs>
              <LinearGradient id="onboardingBackground" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#29D575" />
                <Stop offset="1" stopColor="#3DF18D" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#onboardingBackground)" />
          </Svg>
          <View style={styles.brand} accessible accessibilityRole="image" accessibilityLabel="온에타">
            <OnetaLogo width="100%" height="100%" accessible={false} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.gray03,
  },
  phone: {
    flex: 1,
    width: "100%",
    backgroundColor: colors.gray02,
    ...Platform.select({
      web: {
        alignSelf: "center",
        maxWidth: layout.mobileFrameWidth,
      },
    }),
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#29D575",
    paddingBottom: "17%",
  },
  brand: {
    width: "49%",
    maxWidth: 280,
    aspectRatio: 1600 / 662,
  },
});
