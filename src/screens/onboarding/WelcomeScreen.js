import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OnetaLogo from "../../../assets/images/logo_t.svg";
import GoogleLogo from "../../../assets/images/google.svg";
import Svg, { Path } from "react-native-svg";
import { AppScreen } from "../../components/AppScreen";
import { startGoogleAuth } from "../../api/google";
import { colors } from "../../theme";

export function WelcomeScreen({ onSignupPress, onLoginPress }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [isGoogleLoading, setIsGoogleLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleGooglePress() {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    setError("");
    try {
      await startGoogleAuth();
    } catch {
      setError("구글 로그인을 시작하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setIsGoogleLoading(false);
    }
  }

  return (
    <AppScreen>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { minHeight: height - insets.top - insets.bottom }]}
      >
        <View style={styles.logo} accessible accessibilityRole="image" accessibilityLabel="온에타">
          <OnetaLogo width="100%" height="100%" accessible={false} />
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onSignupPress} style={({ pressed }) => [styles.button, styles.emailButton, pressed && styles.pressed]}>
            <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
              <Path d="M7 4h10q5 0 5 5v6q0 5-5 5H7q-5 0-5-5V9q0-5 5-5Z" fill="#86E9AF" />
              <Path d="m5 7 5 4q2 1.5 4 0l5-4" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
            <Text style={[styles.buttonText, styles.emailText]}>이메일로 시작하기</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isGoogleLoading, busy: isGoogleLoading }}
            disabled={isGoogleLoading}
            onPress={handleGooglePress}
            style={({ pressed }) => [styles.button, (pressed || isGoogleLoading) && styles.pressed]}
          >
            <GoogleLogo width={40} height={40} style={styles.googleIcon} accessible={false} />
            <Text style={styles.buttonText}>{isGoogleLoading ? "구글로 연결 중…" : "구글로 시작하기"}</Text>
          </Pressable>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        </View>
        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>계정이 있으신가요?</Text>
          <View style={styles.line} />
        </View>
        <Pressable accessibilityRole="button" onPress={onLoginPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={[styles.buttonText, styles.loginText]}>로그인하기</Text>
        </Pressable>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 40 },
  logo: { width: 156, aspectRatio: 1600 / 662, alignSelf: "center", marginBottom: 42 },
  actions: { gap: 12 },
  button: { height: 56, width: "100%", borderRadius: 8, borderWidth: 1, borderColor: colors.gray03, backgroundColor: "#FBFDFE", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { fontFamily: "SUIT", fontSize: 17, fontWeight: "600", color: colors.gray09 },
  emailButton: { backgroundColor: "#F1FDF5", borderColor: colors.sub },
  emailText: { color: colors.bus },
  loginText: { color: colors.gray08 },
  googleIcon: { marginHorizontal: -8 },
  pressed: { opacity: 0.65 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 28, marginBottom: 24 },
  line: { height: 1, flex: 1, backgroundColor: colors.gray04 },
  dividerText: { fontFamily: "SUIT", fontSize: 12, color: colors.gray06 },
  error: { fontFamily: "SUIT", fontSize: 13, lineHeight: 19, textAlign: "center", color: colors.point },
});
