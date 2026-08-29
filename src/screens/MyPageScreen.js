import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import MailIcon from "../../assets/images/icon_mail.svg";
import MessageIcon from "../../assets/images/icon_message.svg";
import MypageIcon from "../../assets/images/icon_mypage.svg";
import NoteIcon from "../../assets/images/icon_note.svg";
import PenIcon from "../../assets/images/icon_pen.svg";
import LockIcon from "../../assets/images/icon_lock.svg";
import RightIcon from "../../assets/images/R.svg";
import packageJson from "../../package.json";
import { getMyPage } from "../../api/mypage";
import { AppScreen, HomeTopSection } from "../components";
import { colors, typography } from "../theme";

const defaultMyPageInfo = {
  appVersion: packageJson.version,
  email: "abcdg@gmail.com",
  nickname: "홍길동",
};

const ACCOUNT_ITEMS = [
  { key: "nickname", label: "닉네임 변경", Icon: PenIcon },
  { key: "password", label: "비밀번호 변경", Icon: LockIcon },
];

const SERVICE_ITEMS = [
  { key: "notice", label: "공지사항", Icon: MessageIcon },
  { key: "contact", label: "문의하기", Icon: MailIcon },
  {
    key: "privacy",
    label: "개인정보 처리 방침",
    Icon: MypageIcon,
  },
  { key: "terms", label: "이용약관", Icon: NoteIcon },
];

export function MyPageScreen({
  embedded = false,
  onBackPress,
  onProfilePress,
  showHeader = true,
  notificationCount = 0,
  onOpenNotifications,
  onOpenNotices,
  onOpenContact,
  onOpenPassword,
  onOpenPrivacy,
  onOpenTerms,
  onWithdrawComplete,
}) {
  const [withdrawStep, setWithdrawStep] = useState(null);
  const [myPageInfo, setMyPageInfo] = useState(defaultMyPageInfo);

  useEffect(() => {
    let isActive = true;

    async function loadMyPageInfo() {
      try {
        const data = await getMyPage();

        if (!isActive) {
          return;
        }

        setMyPageInfo({
          appVersion: data.appVersion ?? defaultMyPageInfo.appVersion,
          email: data.email ?? defaultMyPageInfo.email,
          nickname: data.nickname ?? defaultMyPageInfo.nickname,
        });
      } catch {
        if (isActive) {
          setMyPageInfo(defaultMyPageInfo);
        }
      }
    }

    loadMyPageInfo();

    return () => {
      isActive = false;
    };
  }, []);

  const openWithdrawConfirm = () => {
    setWithdrawStep("confirm");
  };

  const closeWithdrawModal = () => {
    setWithdrawStep(null);
  };

  const handleWithdrawPress = () => {
    setWithdrawStep("complete");
  };

  const handleWithdrawCompletePress = () => {
    closeWithdrawModal();
    onWithdrawComplete?.();
  };

  const handleMenuPress = (menuKey) => {
    if (menuKey === "nickname") {
      onProfilePress?.();
    }

    if (menuKey === "password") {
      onOpenPassword?.();
    }

    if (menuKey === "notice") {
      onOpenNotices?.();
    }

    if (menuKey === "contact") {
      onOpenContact?.();
    }

    if (menuKey === "privacy") {
      onOpenPrivacy?.();
    }

    if (menuKey === "terms") {
      onOpenTerms?.();
    }
  };

  const content = (
    <View style={styles.container}>
      {showHeader ? (
        <HomeTopSection
          notificationCount={notificationCount}
          onBackPress={onBackPress}
          onBellPress={onOpenNotifications}
          showAddress={false}
          showBackButton
          showTabs={false}
          title="마이페이지"
        />
      ) : null}

      <View style={styles.body}>
        <View style={styles.contentGroup}>
          <View style={styles.card}>
            <View style={styles.profileTextWrap}>
              <Text style={styles.profileName}>{`${myPageInfo.nickname}님`}</Text>
              <Text style={styles.profileEmail}>{myPageInfo.email}</Text>
            </View>

            {ACCOUNT_ITEMS.map((item, index) => (
              <Pressable
                key={item.key}
                onPress={() => handleMenuPress(item.key)}
                style={[
                  styles.menuRow,
                  styles.accountRow,
                  index !== ACCOUNT_ITEMS.length - 1 && styles.menuDivider,
                ]}
              >
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconWrap}>
                    <item.Icon height={24} width={24} />
                  </View>
                  <Text style={styles.menuText}>{item.label}</Text>
                </View>
                <RightIcon height={18} width={18} />
              </Pressable>
            ))}
          </View>

          <View style={[styles.card, styles.serviceCard]}>
            {SERVICE_ITEMS.map((item, index) => (
              <Pressable
                key={item.key}
                onPress={() => handleMenuPress(item.key)}
                style={[
                  styles.menuRow,
                  styles.serviceRow,
                  index !== SERVICE_ITEMS.length - 1 && styles.menuDivider,
                ]}
              >
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconWrap}>
                    <item.Icon height={24} width={24} />
                  </View>
                  <Text style={styles.menuText}>{item.label}</Text>
                </View>
                <RightIcon height={18} width={18} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.bottomActions}>
          <View style={styles.accountActions}>
            <Pressable style={styles.logoutButton}>
              <Text style={styles.logoutButtonText}>로그아웃</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={openWithdrawConfirm}
            >
              <Text style={styles.withdrawText}>회원 탈퇴</Text>
            </Pressable>
          </View>

          <Pressable style={styles.versionButton}>
            <Text style={styles.versionText}>
              {`앱 버전 ${myPageInfo.appVersion}`}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const screen = embedded ? content : <AppScreen>{content}</AppScreen>;

  return (
    <>
      {screen}
      <Modal
        animationType="fade"
        onRequestClose={closeWithdrawModal}
        transparent
        visible={withdrawStep !== null}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {withdrawStep === "confirm" ? (
              <>
                <Text style={styles.modalTitle}>회원 탈퇴를 진행할까요?</Text>
                <Text style={styles.modalDescription}>
                  회원 탈퇴 시 개인정보는 관련 법령에 따라 파기되며,{"\n"}
                  서비스 이용 기록, 포인트, 쿠폰 등은 복구가 불가능합니다.{"\n"}
                  또한, 동일한 정보로 재가입이 제한될 수 있습니다.
                </Text>
                <View style={styles.modalActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={closeWithdrawModal}
                    style={styles.cancelButton}
                  >
                    <Text style={[styles.modalButtonText, styles.cancelText]}>
                      취소
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleWithdrawPress}
                    style={styles.withdrawButton}
                  >
                    <Text
                      style={[
                        styles.modalButtonText,
                        styles.withdrawButtonText,
                      ]}
                    >
                      탈퇴
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>회원 탈퇴가 완료되었습니다.</Text>
                <Text style={styles.modalDescription}>
                  전자상거래 등 관련 법령에 따라 거래 내역은{"\n"}
                  일정 기간 보관될 수 있습니다.{"\n"}
                  그동안 서비스를 이용해주셔서 진심으로 감사드립니다.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleWithdrawCompletePress}
                  style={styles.completeButton}
                >
                  <Text style={[styles.modalButtonText, styles.completeText]}>
                    확인
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray01,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 29,
    paddingBottom: 17,
  },
  contentGroup: {
    alignSelf: "stretch",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray03,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  profileTextWrap: {
    paddingTop: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray03,
  },
  profileName: {
    ...typography.body01Sb,
    color: colors.gray09,
  },
  profileEmail: {
    marginTop: 4,
    ...typography.body02M,
    color: colors.gray07,
  },
  serviceCard: {
    marginTop: 14,
    paddingBottom: 0,
  },
  menuRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accountRow: {
    alignSelf: "stretch",
    height: 58,
    minHeight: 58,
    paddingVertical: 20,
  },
  serviceRow: {
    alignSelf: "stretch",
    height: 58,
    minHeight: 58,
    paddingVertical: 20,
  },
  menuDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray03,
  },
  menuLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  menuIconWrap: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 22,
  },
  menuText: {
    ...typography.body02M,
    color: colors.gray09,
  },
  bottomActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    marginTop: 12,
  },
  accountActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoutButton: {
    minWidth: 72,
    height: 27,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: colors.gray06,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonText: {
    ...typography.caption01M,
    color: colors.white,
  },
  withdrawText: {
    ...typography.caption01M,
    color: colors.gray06,
  },
  versionButton: {
    justifyContent: "center",
  },
  versionText: {
    ...typography.caption01Underline,
    color: colors.gray07,
    textDecorationLine: "underline",
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
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    rowGap: 12,
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
  modalDescription: {
    width: "100%",
    fontFamily: typography.caption02M.fontFamily,
    fontSize: 11,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 15.4,
    letterSpacing: -0.11,
    color: colors.gray07,
    textAlign: "center",
  },
  modalActions: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  modalButton: {
    width: 134,
    height: 61,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    fontFamily: typography.body03M.fontFamily,
    fontSize: 13,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 18.2,
    letterSpacing: -0.13,
    textAlign: "center",
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 28,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.gray04,
  },
  cancelText: {
    color: colors.gray07,
  },
  withdrawButton: {
    paddingVertical: 8,
    paddingHorizontal: 28,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.main,
  },
  withdrawButtonText: {
    color: colors.white,
  },
  completeButton: {
    paddingVertical: 8,
    paddingHorizontal: 28,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.gray04,
  },
  completeText: {
    color: colors.gray07,
  },
});
