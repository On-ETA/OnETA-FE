import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import BackIcon from "../../assets/images/L.svg";
import CheckboxFillIcon from "../../assets/images/Checkbox_fill.svg";
import CheckboxIcon from "../../assets/images/Checkbox.svg";
import DownIcon from "../../assets/images/Down.svg";
import UpIcon from "../../assets/images/Up.svg";

import { PRIVACY_POLICY_TEXT, TERMS_OF_SERVICE_TEXT } from "../constants/legal";

import { agreeToSignupTerms } from "../api/auth/consent";
import {
  AppScreen,
  Header,
  PrimaryButton,
} from "../components";
import {
  colors,
  layout,
  typography,
} from "../theme";

const TERMS = [
  {
    id: "age",
    title: "만 14세 이상입니까? (필수)",
  },
  {
    id: "service",
    title: "서비스 이용약관 동의 (필수)",
    description: TERMS_OF_SERVICE_TEXT,
  },
  {
    id: "privacy",
    title: "개인정보 수집 및 이용 동의 (필수)",
    description: PRIVACY_POLICY_TEXT
      .replace(
        "- 생년월일\\r\\n\\r\\n생년월일은 이용자가 만 14세 이상인지 확인하기 위한 목적으로만 이용하며, 연령 확인이 완료된 후 별도로 저장하지 않습니다.",
        "- 만 14세 이상 여부\\r\\n\\r\\n회원가입 시 이용자의 확인을 통해 만 14세 이상 여부를 확인하며, 만 14세 미만은 회원가입이 제한됩니다.",
      )
      .replace(
        "**2026년 9월 23일**",
        "**2026년 10월 15일**",
      ),
  },
  {
    id: "notifications",
    title: "알림 수신 동의 (필수)",
    description:
      "경로 및 일정 알림 등 서비스 이용에 필요한 알림을 제공하기 위해 알림 수신 동의를 받습니다.",
  },
];

function getConsentErrorMessage(error) {
  const detailData = error?.details?.data;

  if (detailData && typeof detailData === "object") {
    const fieldMessage = Object.values(
      detailData,
    ).find(
      (value) =>
        typeof value === "string" &&
        value.trim().length > 0,
    );

    if (fieldMessage) {
      return fieldMessage;
    }
  }

  const message =
    error?.details?.message ??
    error?.message ??
    "약관 동의 처리에 실패했습니다. 다시 시도해 주세요.";

  if (typeof message !== "string") {
    return "약관 동의 처리에 실패했습니다. 다시 시도해 주세요.";
  }

  return message.replace(
    /^\[?[A-Z]\d{3,}\]?\s*:?\s*/,
    "",
  );
}

export function TermsAgreementScreen({
  onBackPress,
  onConfirmPress,
  tempId,
}) {
    const [checkedMap, setCheckedMap] =
    useState({
      age: false,
      service: false,
      privacy: false,
      notifications: false,
    });

  const [expandedMap, setExpandedMap] =
    useState({
      service: false,
      privacy: false,
    });

  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const submittingRef = useRef(false);

  const allChecked = useMemo(
    () =>
      TERMS.every(
        (term) => checkedMap[term.id],
      ),
    [checkedMap],
  );

  const toggleCheck = (id) => {
    if (submittingRef.current) return;
    setCheckedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleExpand = (id) => {
    setExpandedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleAll = () => {
    if (submittingRef.current) return;
    const nextChecked = !allChecked;

    setCheckedMap(
      TERMS.reduce(
        (acc, term) => ({
          ...acc,
          [term.id]: nextChecked,
        }),
        {},
      ),
    );
  };

  const handleConfirmPress = async () => {
    if (submittingRef.current) return;
    if (!allChecked) {
      Alert.alert(
        "회원가입",
        "필수 약관에 모두 동의해 주세요.",
      );
      return;
    }

    /*
     * 회원가입 첫 단계에서 발급받은 tempId가
     * 반드시 필요합니다.
     *
     * accessToken / refreshToken은 더 이상
     * 사용하지 않습니다.
     */
    if (
      tempId === null ||
      tempId === undefined ||
      (typeof tempId === "string" &&
        tempId.trim().length === 0)
    ) {
      Alert.alert(
        "회원가입",
        "회원가입 정보가 만료되었거나 존재하지 않습니다. 다시 회원가입을 진행해 주세요.",
      );
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      /*
       * 기존:
       *
       * {
       *   serviceTermsAgreement,
       *   personalInfoAgreement,
       *   accessToken,
       *   tempId
       * }
       *
       * 변경:
       *
       * {
       *   serviceTermsAgreement,
       *   personalInfoAgreement,
       *   tempId
       * }
       */
      const response =
        await agreeToSignupTerms({
          tempId,
          serviceTermsAgreement:
            checkedMap.service,
          personalInfoAgreement:
            checkedMap.privacy,
          notificationAgreement:
            checkedMap.notifications,
        });

      if (response?.code && response.code !== "SUCCESS") {
        throw new Error(response.message || "약관 동의 처리에 실패했습니다. 다시 시도해 주세요.");
      }
      onConfirmPress?.(response);
    } catch (error) {
      Alert.alert(
        "회원가입",
        getConsentErrorMessage(error),
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <AppScreen>
      <View style={styles.agreementBox}>
        <Header
          topSpacerStyle={{ height: 0 }}
          type="back"
          title="회원가입"
          BackIcon={BackIcon}
          backButtonStyle={
            styles.backButton
          }
          backIconStyle={styles.backIcon}
          headerStyle={styles.headerBox}
          titleStyle={styles.headerTitle}
          onBackPress={onBackPress}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator
        >
          <View>
            <Text style={styles.title}>
              약관에 동의해 주세요
            </Text>

            <View style={styles.termsList}>
              {TERMS.map((term) => {
                const checked =
                  checkedMap[term.id];

                const expanded =
                  expandedMap[term.id];

                const CheckIcon = checked
                  ? CheckboxFillIcon
                  : CheckboxIcon;

                const ExpandIcon = expanded
                  ? UpIcon
                  : DownIcon;

                return (
                  <View
                    key={term.id}
                    style={styles.termItem}
                  >
                    <View
                      style={styles.termRow}
                    >
                      <Pressable
                        accessibilityRole="checkbox"
                        disabled={isSubmitting}
                        accessibilityState={{
                          checked,
                        }}
                        hitSlop={8}
                        onPress={() =>
                          toggleCheck(
                            term.id,
                          )
                        }
                        style={
                          styles.termToggleButton
                        }
                      >
                        <CheckIcon
                          height={16}
                          width={16}
                        />

                        <Text
                          style={
                            styles.termTitle
                          }
                        >
                          {term.title}
                        </Text>
                      </Pressable>

                      {term.description ? <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${term.title} ${
                          expanded
                            ? "닫기"
                            : "펼치기"
                        }`}
                        onPress={() =>
                          toggleExpand(
                            term.id,
                          )
                        }
                        style={
                          styles.expandButton
                        }
                      >
                        <View
                          style={
                            styles.expandIcon
                          }
                        >
                          <ExpandIcon
                            height={16}
                            width={16}
                          />
                        </View>
                      </Pressable> : null}
                    </View>

                    {expanded && (
                      <View
                        style={
                          styles.detailBox
                        }
                      >
                        <Text
                          style={
                            styles.detailText
                          }
                        >
                          {
                            term.description
                          }
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.footer}>
            <View
              style={styles.footerDivider}
            />

            <Pressable
              accessibilityRole="checkbox"
              disabled={isSubmitting}
              accessibilityState={{
                checked: allChecked,
              }}
              onPress={toggleAll}
              style={
                styles.allAgreeButton
              }
            >
              {allChecked ? (
                <CheckboxFillIcon
                  height={16}
                  width={16}
                />
              ) : (
                <CheckboxIcon
                  height={16}
                  width={16}
                />
              )}

              <Text
                style={
                  styles.allAgreeText
                }
              >
                전체 동의
              </Text>
            </Pressable>

            <PrimaryButton
              disabled={
                isSubmitting ||
                !allChecked
              }
              onPress={
                handleConfirmPress
              }
              style={[
                styles.confirmButton,
                (isSubmitting ||
                  !allChecked) &&
                  styles.confirmButtonDisabled,
              ]}
              textStyle={
                styles.confirmText
              }
            >
              {isSubmitting
                ? "처리 중"
                : "완료"}
            </PrimaryButton>
          </View>
        </ScrollView>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  agreementBox: {
    flex: 1,
    width: "100%",
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
    color: colors.gray08,
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

  scrollView: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal:
      layout.screenMargin,
    paddingTop: 24,
    justifyContent: "space-between",
  },

  title: {
    fontFamily: "SUIT",
    fontSize: 20,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 20,
    letterSpacing: -0.2,
    color: "#161718",
  },

  termsList: {
    marginTop: 32,
    gap: 16,
  },

  termItem: {
    gap: 8,
  },

  termRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
  },

  termToggleButton: {
    flex: 1,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  expandButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  termTitle: {
    flex: 1,
    fontFamily: "SUIT",
    fontSize: 14,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.6,
    letterSpacing: -0.14,
    color: "#50575D",
  },

  expandIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  detailBox: {
    flexDirection: "row",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.gray03,
  },

  detailText: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 0,
    fontFamily: "SUIT",
    fontSize: 11,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 15.4,
    letterSpacing: -0.11,
    color: "#8F9CA7",
  },

  footer: {
    paddingBottom: 64,
    alignItems: "center",
  },

  footerDivider: {
    alignSelf: "stretch",
    height: 1,
    backgroundColor: colors.gray04,
  },

  allAgreeButton: {
    alignSelf: "stretch",
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  allAgreeText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.6,
    letterSpacing: -0.14,
    color: "#8F9CA7",
  },

  confirmButton: {
    marginTop: 24,
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
    fontFamily: "SUIT",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 22.4,
    letterSpacing: -0.16,
    textAlign: "center",
    color: "#FFF",
  },

  confirmButtonDisabled: {
    backgroundColor: colors.gray05,
  },
});
