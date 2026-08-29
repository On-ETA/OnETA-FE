import React, { useState } from "react";
import {
  Alert,
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

import { sendEmailVerificationCode } from "../api/auth/email/send";
import { verifyEmailCode } from "../api/auth/email/verify";
import { signup } from "../api/auth/signup";
import { extractAuthTokens } from "../api/auth/tokens";
import { AppScreen, Header, PrimaryButton } from "../components";
import BackIcon from "../../assets/images/L.svg";
import HiddenIcon from "../../assets/images/icon_password_hidden.svg";
import VisibleIcon from "../../assets/images/icon_visible.svg";
import { colors, layout, typography } from "../theme";

const EMAIL_AUTH_STATUS = {
  idle: "idle",
  sending: "sending",
  sent: "sent",
  verifying: "verifying",
  verified: "verified",
  failed: "failed",
};

function getSignupErrorReason(error) {
  const detailMessage = error?.details?.data;

  if (detailMessage && typeof detailMessage === "object") {
    const fieldMessage = Object.values(detailMessage).find(
      (value) => typeof value === "string" && value.trim().length > 0,
    );

    if (fieldMessage) {
      return fieldMessage;
    }
  }

  const message =
    error?.details?.message ??
    error?.message ??
    "회원가입 요청에 실패했습니다. 다시 시도해 주세요.";

  return message.replace(/^\[?[A-Z]\d{3,}\]?\s*:?\s*/, "");
}

export function SignupScreen({ onBackPress, onNextPress }) {
  const { height, width } = useWindowDimensions();
  const frameWidth = Math.min(width, layout.mobileFrameWidth);
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [signupErrorMessage, setSignupErrorMessage] = useState("");
  const [emailAuthStatus, setEmailAuthStatus] = useState(
    EMAIL_AUTH_STATUS.idle,
  );

  const trimmedEmail = email.trim();
  const trimmedNickname = nickname.trim();
  const trimmedVerificationCode = verificationCode.trim();
  const isEmailVerified = Boolean(verifiedEmail && verifiedEmail === trimmedEmail);
  const isEmailEntered = trimmedEmail.length > 0;
  const isVerificationCodeEntered = trimmedVerificationCode.length > 0;
  const canSendEmailCode =
    isEmailEntered &&
    !isSendingEmail &&
    !isVerifyingEmail &&
    emailAuthStatus !== EMAIL_AUTH_STATUS.sent &&
    !isEmailVerified;
  const canVerifyEmailCode =
    isVerificationCodeEntered &&
    emailAuthStatus === EMAIL_AUTH_STATUS.sent &&
    !isSendingEmail &&
    !isVerifyingEmail &&
    !isEmailVerified;
  const isSendEmailButtonActive =
    isEmailEntered &&
    (canSendEmailCode ||
      isSendingEmail ||
      emailAuthStatus === EMAIL_AUTH_STATUS.sent ||
      isEmailVerified);
  const isVerifyEmailButtonActive =
    canVerifyEmailCode || isVerifyingEmail || isEmailVerified;

  const handleEmailChange = (value) => {
    setEmail(value);
    setEmailStatus(null);
    setSignupErrorMessage("");
    setEmailAuthStatus(EMAIL_AUTH_STATUS.idle);

    if (verifiedEmail && value.trim() !== verifiedEmail) {
      setVerifiedEmail("");
    }
  };

  const handleSendEmailCode = async () => {
    setSignupErrorMessage("");

    if (!trimmedEmail) {
      setEmailStatus({
        type: "error",
        message: "이메일을 입력해 주세요.",
      });
      Alert.alert("회원가입", "이메일을 입력해 주세요.");
      return;
    }

    setEmailStatus({
      type: "info",
      message: "인증번호를 요청하고 있습니다.",
    });
    setEmailAuthStatus(EMAIL_AUTH_STATUS.sending);
    setIsSendingEmail(true);

    try {
      await sendEmailVerificationCode({ email: trimmedEmail });
      setVerifiedEmail("");
      setEmailAuthStatus(EMAIL_AUTH_STATUS.sent);
      setEmailStatus({
        type: "success",
        message: "인증번호를 이메일로 보냈습니다.",
      });
      Alert.alert("회원가입", "인증번호를 이메일로 보냈습니다.");
    } catch (error) {
      const errorMessage =
        error?.message ?? "인증번호 발송에 실패했습니다. 다시 시도해 주세요.";

      setEmailStatus({
        type: "error",
        message: errorMessage,
      });
      setEmailAuthStatus(EMAIL_AUTH_STATUS.idle);
      Alert.alert(
        "회원가입",
        errorMessage,
      );
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleVerifyEmailCode = async () => {
    setSignupErrorMessage("");

    if (!trimmedEmail || !trimmedVerificationCode) {
      setEmailStatus({
        type: "error",
        message: "이메일과 인증번호를 입력해 주세요.",
      });
      Alert.alert("회원가입", "이메일과 인증번호를 입력해 주세요.");
      return;
    }

    setEmailStatus({
      type: "info",
      message: "인증번호를 확인하고 있습니다.",
    });
    setEmailAuthStatus(EMAIL_AUTH_STATUS.verifying);
    setIsVerifyingEmail(true);

    try {
      await verifyEmailCode({
        email: trimmedEmail,
        code: trimmedVerificationCode,
      });
      setVerifiedEmail(trimmedEmail);
      setEmailAuthStatus(EMAIL_AUTH_STATUS.verified);
      setEmailStatus({
        type: "success",
        message: "이메일 인증이 완료되었습니다.",
      });
      Alert.alert("회원가입", "이메일 인증이 완료되었습니다.");
    } catch (error) {
      const errorMessage =
        error?.message ?? "인증번호 확인에 실패했습니다. 다시 시도해 주세요.";

      setVerifiedEmail("");
      setEmailAuthStatus(EMAIL_AUTH_STATUS.failed);
      setEmailStatus({
        type: "error",
        message: errorMessage,
      });
      Alert.alert(
        "회원가입",
        errorMessage,
      );
    } finally {
      setIsVerifyingEmail(false);
    }
  };
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const availableContentWidth =
    frameWidth - layout.screenMargin * 2;
  const shouldShowInputPreview = availableContentWidth < 340;
  const shouldUseInlineFooter = frameWidth > height || height < 640;

  const handleNextPress = async () => {
    setSignupErrorMessage("");

    if (!trimmedEmail || !password || !passwordConfirm || !trimmedNickname) {
      setSignupErrorMessage("필수 정보를 모두 입력해 주세요.");
      return;
    }

    if (!isEmailVerified) {
      setSignupErrorMessage("이메일 인증을 완료해 주세요.");
      return;
    }

    if (password !== passwordConfirm) {
      setSignupErrorMessage("비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      const signupResponse = await signup({
        email: trimmedEmail,
        nickname: trimmedNickname,
        password,
        passwordConfirm,
      });
      const signupTokens = extractAuthTokens(signupResponse);

      if (!signupTokens.accessToken) {
        throw new Error("회원가입 인증 토큰을 받을 수 없습니다.");
      }

      onNextPress?.({ signupTokens });
    } catch (error) {
      setSignupErrorMessage(getSignupErrorReason(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextButton = (
    <>
      {signupErrorMessage ? (
        <Text style={styles.signupError}>{signupErrorMessage}</Text>
      ) : null}
      <PrimaryButton
        disabled={isSubmitting}
        onPress={handleNextPress}
        style={styles.nextButton}
        textStyle={styles.nextText}
      >
        다음
      </PrimaryButton>
    </>
  );

  return (
    <AppScreen>
      <Header
        type="back"
        title="회원가입"
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
            <View style={styles.emailGroup}>
              <View style={styles.row}>
                <SignupInput
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  onChangeText={handleEmailChange}
                  placeholder="이메일 *"
                  style={styles.emailInput}
                  value={email}
                />
                <SideButton
                  active={!isEmailVerified && isSendEmailButtonActive}
                  disabled={isEmailVerified || !canSendEmailCode}
                  onPress={handleSendEmailCode}
                >
                  {isEmailVerified ? "완료" : isSendingEmail ? "전송" : "인증"}
                </SideButton>
              </View>
              {shouldShowInputPreview && trimmedEmail && (
                <Text style={styles.inputPreview}>
                  이메일 : {trimmedEmail}
                </Text>
              )}
              <View style={styles.row}>
                <SignupInput
                  keyboardType="number-pad"
                  onChangeText={(value) => {
                    setVerificationCode(value);
                    setSignupErrorMessage("");
                  }}
                  placeholder="인증번호 입력 *"
                  style={styles.emailInput}
                  value={verificationCode}
                />
                <SideButton
                  active={!isEmailVerified && isVerifyEmailButtonActive}
                  disabled={isEmailVerified || !canVerifyEmailCode}
                  onPress={handleVerifyEmailCode}
                >
                  {isEmailVerified ? "완료" : isVerifyingEmail ? "확인" : "확인"}
                </SideButton>
              </View>
              {shouldShowInputPreview && trimmedVerificationCode && (
                <Text style={styles.inputPreview}>
                  인증번호: {trimmedVerificationCode}
                </Text>
              )}
              {emailStatus && (
                <Text
                  style={[
                    styles.emailStatus,
                    emailStatus.type === "success" && styles.emailStatusSuccess,
                    emailStatus.type === "error" && styles.emailStatusError,
                  ]}
                >
                  {emailStatus.message}
                </Text>
              )}
            </View>

            <View style={styles.passwordGroup}>
              <PasswordInput
                autoCapitalize="none"
                autoComplete="password"
                onChangeText={(value) => {
                  setPassword(value);
                  setSignupErrorMessage("");
                }}
                onToggleVisibility={() => setShowPassword((value) => !value)}
                placeholder="비밀번호 *"
                secureTextEntry={!showPassword}
                style={styles.stretchInput}
                value={password}
              />
              <PasswordInput
                autoCapitalize="none"
                autoComplete="password"
                onChangeText={(value) => {
                  setPasswordConfirm(value);
                  setSignupErrorMessage("");
                }}
                onToggleVisibility={() =>
                  setShowPasswordConfirm((value) => !value)
                }
                placeholder="비밀번호 확인 *"
                secureTextEntry={!showPasswordConfirm}
                style={styles.stretchInput}
                value={passwordConfirm}
              />
            </View>

            <Text style={styles.helper}>
              (영문 대/소문자, 숫자/특수문자 중 2가지 이상 조합, 8~16자)
            </Text>

            <SignupInput
              onChangeText={(value) => {
                setNickname(value);
                setSignupErrorMessage("");
              }}
              placeholder="닉네임 *"
              style={[styles.stretchInput, styles.nicknameInput]}
              value={nickname}
            />

            {shouldUseInlineFooter && (
              <View style={styles.inlineFooter}>{nextButton}</View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {!shouldUseInlineFooter && <View style={styles.footer}>{nextButton}</View>}
    </AppScreen>
  );
}

function SignupInput({ style, ...props }) {
  return (
    <TextInput
      cursorColor={colors.black}
      placeholderTextColor={colors.gray06}
      selectionColor={colors.black}
      style={[styles.input, style]}
      underlineColorAndroid="transparent"
      {...props}
    />
  );
}

function PasswordInput({
  onToggleVisibility,
  secureTextEntry,
  style,
  ...props
}) {
  const VisibilityIcon = secureTextEntry ? HiddenIcon : VisibleIcon;

  return (
    <View style={styles.passwordInputWrap}>
      <TextInput
        cursorColor={colors.black}
        placeholderTextColor={colors.gray06}
        selectionColor={colors.black}
        secureTextEntry={secureTextEntry}
        style={[styles.input, style, styles.passwordInput]}
        underlineColorAndroid="transparent"
        {...props}
      />
      <Pressable
        accessibilityLabel={secureTextEntry ? "비밀번호 보기" : "비밀번호 숨기기"}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onToggleVisibility}
        style={styles.eyeButton}
      >
        <VisibilityIcon />
      </Pressable>
    </View>
  );
}

function SideButton({ active, children, disabled = false, onPress }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      // 인증 요청 중에는 버튼을 비활성화해서 중복 요청을 막습니다.
      style={[
        styles.sideButton,
        active && styles.sideButtonActive,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[styles.sideButtonText, active && styles.sideButtonTextActive]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  emailGroup: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emailInput: {
    display: "flex",
    flex: 1,
    minWidth: 0,
    height: 54,
    padding: 16,
    alignItems: "center",
    gap: 10,
  },
  stretchInput: {
    display: "flex",
    height: 54,
    padding: 16,
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
  },
  input: {
    height: 54,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.gray03,
    borderRadius: 8,
    backgroundColor: colors.gray02,
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
    color: colors.black,
  },
  sideButton: {
    display: "flex",
    flexShrink: 0,
    width: 72,
    height: 54,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 8,
    backgroundColor: colors.gray04,
  },
  sideButtonActive: {
    backgroundColor: colors.main,
  },
  sideButtonText: {
    ...typography.body01Sb,
    fontStyle: "normal",
    letterSpacing: -0.16,
    textAlign: "center",
    color: colors.gray07,
  },
  sideButtonTextActive: {
    color: colors.white,
  },
  inputPreview: {
    ...typography.caption01M,
    lineHeight: 18,
    letterSpacing: -0.12,
    color: colors.gray06,
  },
  emailStatus: {
    ...typography.caption01M,
    lineHeight: 18,
    letterSpacing: -0.12,
    color: colors.gray07,
  },
  emailStatusSuccess: {
    color: colors.main,
  },
  emailStatusError: {
    color: colors.point,
  },
  disabled: {
    opacity: 0.6,
  },
  passwordGroup: {
    marginTop: 32,
    gap: 8,
  },
  passwordInputWrap: {
    justifyContent: "center",
  },
  passwordInput: {
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
  nicknameInput: {
    marginTop: 32,
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
  nextButton: {
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
  signupError: {
    alignSelf: "stretch",
    marginBottom: 8,
    ...typography.caption01M,
    color: colors.point,
  },
  nextText: {
    ...typography.body01Sb,
    color: colors.white,
  },
});
