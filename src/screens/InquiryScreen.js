import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);

  const handleSuccessModalClose = () => {
    setIsSuccessModalVisible(false);
    onBackPress?.();
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await sendInquiry({
        title: title.trim(),
        content: content.trim(),
      });

      setIsSuccessModalVisible(true);
    } catch (error) {
      const message = getInquiryErrorMessage(error);

      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppScreen>
      <View style={styles.container}>
        <Header topSpacerStyle={{ height: 0 }}
          type="back"
          title="문의하기"
          onBackPress={onBackPress}
        />

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
              <Text
                accessibilityLiveRegion="polite"
                style={styles.errorText}
              >
                {errorMessage}
              </Text>
            ) : null}

            <PrimaryButton
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={styles.submitButton}
              textStyle={styles.submitText}
            >
              {isSubmitting ? "등록 중..." : "등록"}
            </PrimaryButton>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
      <Modal
        animationType="fade"
        onRequestClose={handleSuccessModalClose}
        transparent
        visible={isSuccessModalVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>문의가 등록되었습니다.</Text>
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={handleSuccessModalClose}
                style={styles.modalConfirmButton}
              >
                <Text style={styles.modalConfirmText}>확인</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}
function getInquiryErrorMessage(error) {
  const errorCode =
    error?.code ??
    error?.data?.code ??
    error?.details?.code ??
    error?.response?.data?.code;

  // 토큰 없음
  if (errorCode === "C007" || errorCode === "007") {
    return "다시 로그인해주세요.";
  }

  const fieldErrors =
    error?.data?.data ??
    error?.details?.data ??
    error?.data;

  if (fieldErrors && typeof fieldErrors === "object") {
    return (
      Object.values(fieldErrors).find(
        (value) => typeof value === "string" && value,
      ) ?? "문의 전송에 실패했습니다."
    );
  }

  return (
    error?.data?.message ??
    error?.details?.message ??
    error?.response?.data?.message ??
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
    color: colors.black,
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
    color: colors.black,
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

  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(52, 56, 59, 0.32)",
  },
  modalCard: {
    width: 328,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray03,
    backgroundColor: colors.white,
    shadowColor: "#B9C8D0",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    boxShadow: "0 0 20px rgba(185, 200, 208, 0.15)",
    elevation: 3,
  },
  modalTitle: {
    width: "100%",
    fontFamily: typography.body01Sb.fontFamily,
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 22.4,
    letterSpacing: -0.16,
    color: colors.gray09,
    textAlign: "center",
  },
  modalActions: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmButton: {
    paddingVertical: 8,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 50,
    backgroundColor: colors.main,
  },
  modalConfirmText: {
    fontFamily: typography.body03M.fontFamily,
    fontSize: 13,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 18.2,
    letterSpacing: -0.13,
    color: colors.white,
    textAlign: "center",
  },
});
