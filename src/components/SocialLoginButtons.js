import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import GoogleLogo from "../../assets/images/google.svg";
import { colors } from "../theme";

export function SocialLoginButtons({
  buttonStyle,
  iconSize = 32,
  isGoogleLoading = false,
  onGooglePress,
  style,
}) {
  return (
    <View style={[styles.socials, style]}>
      <Pressable
        accessibilityLabel="구글로 로그인"
        accessibilityRole="button"
        accessibilityState={{ disabled: isGoogleLoading }}
        disabled={isGoogleLoading}
        onPress={onGooglePress}
        style={[
          styles.google,
          buttonStyle,
          isGoogleLoading && styles.disabled,
        ]}
      >
        <GoogleLogo height={iconSize} width={iconSize} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  socials: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "center",
    gap: 36,
  },
  google: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: colors.socialBorder,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  disabled: {
    opacity: 0.6,
  },
});
