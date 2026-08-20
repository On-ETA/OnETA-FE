import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppScreen, PrimaryButton } from "../components";
import { colors, layout, typography } from "../theme";

export function SignupCompleteScreen({ onHomePress, onLoginPress }) {
  return (
    <AppScreen>
      <View style={styles.completeBox}>
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.messageBox}>
              <Text style={styles.title}>회원가입이 완료되었어요!</Text>
              <Text style={styles.description}>
                온에타에 오신 걸 환영합니다.
                {"\n"}
                지금 바로 다양한 서비스를 이용해 보세요!
              </Text>
            </View>

            <View style={styles.graphicPlaceholder} />
          </View>

          <View style={styles.footer}>
            <PrimaryButton
              onPress={onLoginPress}
              style={styles.loginButton}
              textStyle={styles.loginButtonText}
            >
              로그인하기
            </PrimaryButton>

            <Pressable onPress={onHomePress} style={styles.homeButton}>
              <Text style={styles.homeButtonText}>홈으로</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  completeBox: {
    flex: 1,
    width: "100%",
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
    paddingHorizontal: layout.screenMargin,
    paddingBottom: 52,
    justifyContent: "space-between",
  },
  content: {
    alignItems: "center",
  },
  graphicPlaceholder: {
    width: "78%",
    maxWidth: 320,
    aspectRatio: 1,
    marginTop: 40,
    borderRadius: 160,
    backgroundColor: colors.gray03,
  },
  messageBox: {
    marginTop: 96,
    alignItems: "center",
    gap: 20,
  },
  title: {
    fontFamily: "SUIT",
    fontSize: 20,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 20,
    letterSpacing: -0.2,
    color: colors.black,
    textAlign: "center",
  },
  description: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 18.2,
    letterSpacing: -0.13,
    color: colors.gray08,
    textAlign: "center",
  },
  footer: {
    gap: 12,
  },
  loginButton: {
    height: 54,
    padding: 10,
    alignSelf: "stretch",
    gap: 10,
    borderRadius: 8,
    backgroundColor: colors.main,
  },
  loginButtonText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 22.4,
    letterSpacing: -0.16,
    color: colors.white,
    textAlign: "center",
  },
  homeButton: {
    height: 54,
    padding: 10,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 8,
    backgroundColor: colors.gray04,
  },
  homeButtonText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 22.4,
    letterSpacing: -0.16,
    color: colors.gray07,
    textAlign: "center",
  },
});
