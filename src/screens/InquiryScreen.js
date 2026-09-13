import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { sendInquiry } from "../api/mypage/inquiry";
import { AppScreen, Header, PrimaryButton } from "../components";
import { colors, typography } from "../theme";

export function InquiryScreen({ onBackPress }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await sendInquiry({
        title,
        content,
      });
      Alert.alert("문의하기", "문의가 등록되었습니다.", [
        {
          text: "확인",
          onPress: onBackPress,
        },
      ]);
    } catch (error) {
      setErrorMessage(getInquiryErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppScreen>
      <View style={styles.container}>
        <Header type="back" title="문의하기" onBackPress={onBackPress} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              onChangeText={(value) => {
                setTitle(value);
                setErrorMessage("");
              }}
              placeholder="제목"
              placeholderTextColor={colors.gray06}
              style={styles.titleInput}
              textAlign="left"
              value={title}
            />

            <TextInput
              multiline
              onChangeText={(value) => {
                setContent(value);
                setErrorMessage("");
              }}
              placeholder="문의 내용을 작성해주세요"
              placeholderTextColor={colors.gray06}
              style={styles.contentInput}
              textAlign="left"
              textAlignVertical="top"
              value={content}
            />

            {errorMessage ? (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {errorMessage}
              </Text>
            ) : null}

            <PrimaryButton
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={styles.submitButton}
              textStyle={styles.submitText}
            >
              등록
            </PrimaryButton>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </AppScreen>
  );
}

function getInquiryErrorMessage(error) {
  const fieldErrors = error?.data?.data ?? error?.details?.data ?? error?.data;

  if (fieldErrors && typeof fieldErrors === "object") {
    return Object.values(fieldErrors).find(Boolean) ?? "문의 전송에 실패했습니다.";
  }

  return (
    error?.data?.message ??
    error?.details?.message ??
    error?.message ??
    "문의 전송에 실패했습니다. 다시 시도해주세요."
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 38,
  },
  titleInput: {
    display: "flex",
    height: 54,
    padding: 16,
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: colors.gray03,
    borderRadius: 8,
    backgroundColor: colors.gray02,
    color: colors.gray06,
    ...typography.body01Sb,
  },
  contentInput: {
    display: "flex",
    height: 466,
    marginTop: 20,
    padding: 16,
    alignItems: "flex-start",
    gap: 10,
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: colors.gray03,
    borderRadius: 8,
    backgroundColor: colors.gray02,
    color: colors.gray06,
    ...typography.body01Sb,
  },
  errorText: {
    alignSelf: "stretch",
    marginTop: 30,
    marginBottom: 8,
    ...typography.caption01M,
    color: colors.point,
  },
  submitButton: {
    marginTop: 8,
    display: "flex",
    width: "100%",
    height: 54,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    alignSelf: "stretch",
    borderRadius: 8,
    backgroundColor: colors.main,
  },
  submitText: {
    ...typography.body01Sb,
    color: colors.white,
  },
});
