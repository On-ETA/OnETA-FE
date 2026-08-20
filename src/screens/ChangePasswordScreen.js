import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { changePassword } from "../../api/mypage/password";
import { AppScreen, Header, PrimaryButton } from "../components";
import BackIcon from "../../assets/images/L.svg";
import HiddenIcon from "../../assets/images/icon_password_hidden.svg";
import VisibleIcon from "../../assets/images/icon_visible.svg";
import { colors, layout, typography } from "../theme";

export function ChangePasswordScreen({ onBackPress }) {
  const { height, width } = useWindowDimensions();
  const frameWidth = Math.min(width, layout.mobileFrameWidth);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const shouldUseInlineFooter = frameWidth > height || height < 640;

  const clearStatus = () => {
    setStatusMessage("");
    setStatusType(null);
  };

  const handleConfirmPress = async () => {
    clearStatus();
    setIsSubmitting(true);

    try {
      await changePassword({
        currentPassword,
        newPassword,
        newPasswordConfirm,
      });
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setStatusType("success");
      setStatusMessage("비밀번호가 변경되었습니다.");
    } catch (error) {
      setStatusType("error");
      setStatusMessage(getPasswordErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmButton = (
    <>
      {statusMessage ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.statusText,
            statusType === "success" && styles.successText,
            statusType === "error" && styles.errorText,
          ]}
        >
          {statusMessage}
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
    </>
  );

  return (
    <AppScreen>
      <View style={styles.container}>
        <Header
          type="back"
          title="비밀번호 변경"
          BackIcon={BackIcon}
          backButtonStyle={styles.backButton}
          backIconStyle={styles.backIcon}
          headerStyle={styles.headerBox}
          showRightPlaceholder={false}
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
              <View style={styles.currentPasswordGroup}>
                <PasswordInput
                  onChangeText={(value) => {
                    setCurrentPassword(value);
                    clearStatus();
                  }}
                  onToggleVisibility={() =>
                    setShowCurrentPassword((value) => !value)
                  }
                  placeholder="현재 비밀번호"
                  secureTextEntry={!showCurrentPassword}
                  value={currentPassword}
                  withEye
                />
              </View>
              <View style={styles.passwordGroup}>
                <PasswordInput
                  onChangeText={(value) => {
                    setNewPassword(value);
                    clearStatus();
                  }}
                  onToggleVisibility={() =>
                    setShowNewPassword((value) => !value)
                  }
                  placeholder="새 비밀번호"
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  withEye
                />
                <PasswordInput
                  onChangeText={(value) => {
                    setNewPasswordConfirm(value);
                    clearStatus();
                  }}
                  onToggleVisibility={() =>
                    setShowNewPasswordConfirm((value) => !value)
                  }
                  placeholder="새 비밀번호 확인"
                  secureTextEntry={!showNewPasswordConfirm}
                  value={newPasswordConfirm}
                  withEye
                />
              </View>
              <Text style={styles.helper}>
                (영문 대/소문자, 숫자/특수문자 중 2가지 이상 조합, 8~16자)
              </Text>

              {shouldUseInlineFooter && (
                <View style={styles.inlineFooter}>{confirmButton}</View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {!shouldUseInlineFooter && (
          <View style={styles.footer}>{confirmButton}</View>
        )}
      </View>
    </AppScreen>
  );
}

function getPasswordErrorMessage(error) {
  const fieldErrors = error?.data?.data ?? error?.data ?? error?.details?.data;

  if (fieldErrors && typeof fieldErrors === "object") {
    return Object.values(fieldErrors).find(Boolean) ?? "비밀번호 변경에 실패했습니다.";
  }

  return (
    error?.data?.message ??
    error?.details?.message ??
    error?.message ??
    "비밀번호 변경에 실패했습니다. 다시 시도해 주세요."
  );
}

function PasswordInput({
  onToggleVisibility,
  secureTextEntry,
  style,
  withEye = false,
  ...props
}) {
  const VisibilityIcon = secureTextEntry ? HiddenIcon : VisibleIcon;

  return (
    <View style={styles.inputWrap}>
      <TextInput
        cursorColor={colors.black}
        placeholderTextColor={colors.gray06}
        selectionColor={colors.black}
        secureTextEntry={secureTextEntry}
        style={[styles.input, withEye && styles.inputWithEye, style]}
        underlineColorAndroid="transparent"
        {...props}
      />
      {withEye && (
        <Pressable
          accessibilityLabel={secureTextEntry ? "비밀번호 보기" : "비밀번호 숨기기"}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onToggleVisibility}
          style={styles.eyeButton}
        >
          <VisibilityIcon />
        </Pressable>
      )}
    </View>
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
    justifyContent: "flex-start",
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
  scroller: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: layout.screenMargin,
    paddingTop: 24,
    paddingBottom: 24,
  },
  currentPasswordGroup: {
    marginBottom: 32,
  },
  passwordGroup: {
    gap: 8,
  },
  inputWrap: {
    justifyContent: "center",
  },
  input: {
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray03,
    backgroundColor: colors.gray02,
    paddingHorizontal: 16,
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
  inputWithEye: {
    paddingRight: 58,
  },
  eyeButton: {
    position: "absolute",
    right: 16,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  helper: {
    marginTop: 8,
    ...typography.caption01M,
    fontStyle: "normal",
    lineHeight: 19.2,
    letterSpacing: -0.12,
    color: colors.gray06,
  },
  footer: {
    paddingHorizontal: layout.screenMargin,
    paddingBottom: 64,
    alignItems: "center",
  },
  inlineFooter: {
    marginTop: 24,
    paddingBottom: 24,
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
  statusText: {
    alignSelf: "stretch",
    marginBottom: 8,
    ...typography.caption01M,
  },
  successText: {
    color: colors.main,
  },
  errorText: {
    color: colors.point,
  },
});
