import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import BackIcon from "../../assets/images/L.svg";
import CheckboxFillIcon from "../../assets/images/Checkbox_fill.svg";
import CheckboxIcon from "../../assets/images/Checkbox.svg";
import DownIcon from "../../assets/images/Down.svg";
import UpIcon from "../../assets/images/Up.svg";
import { agreeToSignupTerms } from "../../api/auth/consent";
import { extractAuthTokens, setAuthTokens } from "../../api/auth/tokens";
import { AppScreen, Header, PrimaryButton } from "../components";
import { colors, layout, typography } from "../theme";

const TERMS = [
  {
    id: "service",
    title: "서비스 이용약관 동의 (필수)",
    description:
      "온에타 서비스는 회원에게 경기 정보, 기록 관리, 커뮤니티 기능 등 다양한 서비스를 제공합니다. 회원은 서비스를 이용할 때 관련 법령과 본 약관을 준수해야 하며, 타인의 권리를 침해하거나 서비스 운영을 방해하는 행위를 해서는 안 됩니다. 회사는 안정적인 서비스 제공을 위해 필요한 경우 서비스 내용을 변경하거나 점검할 수 있습니다.",
  },
  {
    id: "privacy",
    title: "개인정보 수집 및 이용 동의 (필수)",
    description:
      "회원가입 및 서비스 제공을 위해 이메일, 닉네임, 비밀번호 등 필요한 개인정보를 수집 및 이용합니다. 수집된 정보는 본인 확인, 계정 관리, 서비스 이용 안내 목적으로 사용되며, 관련 법령에 따른 보관 기간 이후 안전하게 파기됩니다.",
  },
];

export function TermsAgreementScreen({
  onBackPress,
  onConfirmPress,
  signupTokens,
}) {
  const [checkedMap, setCheckedMap] = useState({
    service: false,
    privacy: false,
  });
  const [expandedMap, setExpandedMap] = useState({
    service: false,
    privacy: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allChecked = useMemo(
    () => TERMS.every((term) => checkedMap[term.id]),
    [checkedMap],
  );

  const toggleCheck = (id) => {
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
    const nextChecked = !allChecked;

    setCheckedMap(() =>
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
    if (!allChecked) {
      Alert.alert("회원가입", "필수 약관에 모두 동의해 주세요.");
      return;
    }

    if (!signupTokens?.accessToken) {
      Alert.alert("회원가입", "회원가입 정보를 다시 입력해 주세요.");
      onBackPress?.();
      return;
    }

    setIsSubmitting(true);

    try {
      const consentResponse = await agreeToSignupTerms({
        serviceTermsAgreement: checkedMap.service,
        serviceInfoAgreement: checkedMap.privacy,
        accessToken: signupTokens.accessToken,
      });
      const consentTokens = extractAuthTokens(consentResponse);

      setAuthTokens({
        accessToken: consentTokens.accessToken ?? signupTokens.accessToken,
        refreshToken: consentTokens.refreshToken ?? signupTokens.refreshToken,
      });

      onConfirmPress?.();
    } catch (error) {
      Alert.alert(
        "회원가입",
        error?.message ?? "회원가입 요청에 실패했습니다. 다시 시도해 주세요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppScreen>
      <View style={styles.agreementBox}>
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

        <View style={styles.container}>
          <View>
            <Text style={styles.title}>약관에 동의해 주세요</Text>

            <View style={styles.termsList}>
              {TERMS.map((term) => {
                const checked = checkedMap[term.id];
                const expanded = expandedMap[term.id];
                const CheckIcon = checked ? CheckboxFillIcon : CheckboxIcon;
                const ExpandIcon = expanded ? UpIcon : DownIcon;

                return (
                  <View key={term.id} style={styles.termItem}>
                    <View style={styles.termRow}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                        hitSlop={8}
                        onPress={() => toggleCheck(term.id)}
                        style={styles.termToggleButton}
                      >
                        <CheckIcon height={16} width={16} />
                        <Text style={styles.termTitle}>{term.title}</Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${term.title} ${expanded ? "닫기" : "펼치기"}`}
                        onPress={() => toggleExpand(term.id)}
                        style={styles.expandButton}
                      >
                        <View style={styles.expandIcon}>
                          <ExpandIcon height={16} width={16} />
                        </View>
                      </Pressable>
                    </View>

                    {expanded && (
                      <View style={styles.detailBox}>
                        <Text style={styles.detailText}>
                          {term.description}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerDivider} />

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allChecked }}
              onPress={toggleAll}
              style={styles.allAgreeButton}
            >
              <View
                style={[
                  styles.check,
                  styles.allAgreeCheck,
                  allChecked && styles.checkOn,
                ]}
              />
              <Text style={styles.allAgreeText}>전체 동의</Text>
            </Pressable>

            <PrimaryButton
              disabled={isSubmitting}
              onPress={handleConfirmPress}
              style={[
                styles.confirmButton,
                isSubmitting && styles.confirmButtonDisabled,
              ]}
              textStyle={styles.confirmText}
            >
              {isSubmitting ? "처리 중" : "완료"}
            </PrimaryButton>
          </View>
        </View>
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
  container: {
    flex: 1,
    paddingHorizontal: layout.screenMargin,
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
    gap: 10,
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
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray05,
    backgroundColor: colors.gray03,
  },
  checkOn: {
    borderColor: colors.main,
    backgroundColor: colors.main,
  },
  allAgreeCheck: {
    width: 16,
    height: 16,
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: "#E7EEF2",
    backgroundColor: "#EEF3F6",
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
