import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, layout } from "../theme";
import { ScreenTransition } from "./ScreenTransition";

export function AppScreen({ children }) {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" backgroundColor={colors.white} />
      <SafeAreaView edges={["top", "bottom"]} style={styles.phone}>
        <ScreenTransition routeAware animateOnMount={false}>{children}</ScreenTransition>
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
    backgroundColor: colors.white,
    ...Platform.select({
      web: {
        alignSelf: "center",
        maxWidth: layout.mobileFrameWidth,
        overflowX: "hidden",
        overflowY: "auto",
      },
    }),
  },
});
