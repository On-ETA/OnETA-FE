import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { changeNickname } from "../../api/mypage/nickname";
import { AppScreen, Header, PrimaryButton } from "../components";
import BackIcon from "../../assets/images/L.svg";
import { colors, layout, typography } from "../theme";

export function AccountInfoScreen({ onBackPress, onConfirmPress }) {
  const [nickname, setNickname] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmPress = async () => {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await changeNickname({ newNickname: nickname });
      onConfirmPress?.();
    } catch (error) {
      setErrorMessage(getNicknameErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppScreen>
      <View style={styles.container}>
        <Header
          type="back"
          title="닉네임 변경"
          BackIcon={BackIcon}
          backButtonStyle={styles.backButton}
          backIconStyle={styles.backIcon}
          headerStyle={styles.headerBox}
          titleStyle={styles.headerTitle}
          onBackPress={onBackPress}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardContainer}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.scroller}
          >
            <View style={styles.content}>
              <TextInput
                cursorColor={colors.black}
                onChangeText={(value) => {
                  setNickname(value);
                  setErrorMessage("");
                }}
                placeholder="닉네임"
                placeholderTextColor={colors.gray06}
                selectionColor={colors.black}
                style={styles.input}
                underlineColorAndroid="transparent"
                value={nickname}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          {errorMessage ? (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}
          <PrimaryButton
            disabled={isSubmitting}
            onPress={handleConfirmPress}
            style={[styles.confirmButton, isSubmitting && styles.disabled]}
            textStyle={styles.confirmText}
          >
            {isSubmitting ? "처리 중" : "확인"}
          </PrimaryButton>
        </View>
      </View>
    </AppScreen>
  );
}

function getNicknameErrorMessage(error) {
  const fieldErrors = error?.data?.data ?? error?.details?.data;

  if (fieldErrors && typeof fieldErrors === "object") {
    return Object.values(fieldErrors).find(Boolean) ?? "닉네임 변경에 실패했습니다.";
  }

  return (
    error?.data?.message ??
    error?.details?.message ??
    error?.message ??
    "닉네임 변경에 실패했습니다. 다시 시도해 주세요."
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  headerBox: {
    display: "flex",
    height: 54,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 12,
    alignSelf: "stretch",
    borderBottomColor: colors.gray03,
  },
  headerTitle: {
    ...typography.head01Sb,
    marginLeft: 0,
    color: colors.black,
  },
  backButton: {
    width: 24,
    height: 24,
  },
  backIcon: {
    width: 24,
    height: 24,
    aspectRatio: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scroller: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: layout.screenMargin,
    paddingTop: 24,
    paddingBottom: 24,
  },
  input: {
    display: "flex",
    width: "100%",
    height: 54,
    padding: 16,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.gray03,
    borderRadius: 8,
    backgroundColor: colors.gray02,
    color: colors.black,
    ...Platform.select({
      web: {
        outlineColor: "transparent",
        outlineStyle: "none",
        outlineWidth: 0,
        boxShadow: "none",
      },
    }),
    ...typography.body01Sb,
    fontStyle: "normal",
    letterSpacing: -0.16,
    textAlign: "left",
  },
  footer: {
    paddingHorizontal: layout.screenMargin,
    paddingBottom: 64,
    alignItems: "center",
  },
  confirmButton: {
    display: "flex",
    width: "100%",
    height: 54,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 8,
    backgroundColor: colors.main,
  },
  confirmText: {
    ...typography.body01Sb,
    color: colors.white,
  },
  disabled: {
    opacity: 0.6,
  },
  errorText: {
    alignSelf: "stretch",
    marginBottom: 8,
    ...typography.caption01M,
    color: colors.point,
  },
});
