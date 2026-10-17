import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AppScreen, Header } from "../components";
import { colors } from "../theme";

import { PRIVACY_POLICY_TEXT } from "../constants/legal";

export function PrivacyPolicyScreen({ onBackPress }) {
  return (
    <AppScreen>
      <View style={styles.container}>
        <Header type="back" title="개인정보 처리방침" onBackPress={onBackPress} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
        >
          <Text style={styles.body}>{PRIVACY_POLICY_TEXT}</Text>
        </ScrollView>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    paddingTop: 24,
    paddingRight: 16,
    paddingBottom: 40,
    paddingLeft: 16,
  },
  body: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.2,
    letterSpacing: -0.12,
    color: colors.gray08,
  },
});
