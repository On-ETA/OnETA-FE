import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import BackIcon from "../../assets/images/L.svg";
import SettingIcon from "../../assets/images/setting.svg";
import { getArrivalNotifications } from "../api/notifications/arrival";
import { registerDeviceToken } from "../api/notifications/deviceTokens";
import {
  DEFAULT_TEST_FCM_BODY,
  DEFAULT_TEST_FCM_TITLE,
  sendTestFcm,
} from "../api/test/fcm";
import { syncBus } from "../api/test/syncBus";
import { AppScreen, Header } from "../components";
import { getSavedDeviceToken } from "../notifications/deviceTokenRegistration";
import { colors, typography } from "../theme";

const DEFAULT_NOTIFICATIONS = [
  {
    id: "bus-departed",
    type: "success",
    title: "버스가 출고지에서 출발했어요!",
    description: "",
    timeLabel: "방금",
    routeKey: "busTracking",
    payload: { busId: "sample-bus-id" },
  },
  {
    id: "last-train-warning",
    type: "danger",
    title: "막차가 10분 남았어요!",
    description: "지금 출발 안하면 택시비가 12,600원 나와요",
    timeLabel: "어제",
    routeKey: "lastTrainGuide",
    payload: { stationId: "sample-station-id" },
  },
];

/**
 * 알림 페이지
 * - notifications: 서버 응답을 화면용 모델로 매핑해서 주입할 수 있도록 분리한 데이터 소스
 * - onNotificationPress: 카드 클릭 시 routeKey/payload를 기반으로 상세 화면 이동에 사용
 */
export function NotificationsScreen({
  notifications,
  onBackPress,
  onNotificationPress,
  onSettingsPress,
}) {
  const [serverNotifications, setServerNotifications] = useState([]);
  const [notificationsErrorMessage, setNotificationsErrorMessage] =
    useState("");
  const [deviceToken, setDeviceToken] = useState(() => getSavedDeviceToken() ?? "");
  const [testTitle, setTestTitle] = useState(DEFAULT_TEST_FCM_TITLE);
  const [testBody, setTestBody] = useState(DEFAULT_TEST_FCM_BODY);
  const [isRegisteringDeviceToken, setIsRegisteringDeviceToken] =
    useState(false);
  const [isSendingTestFcm, setIsSendingTestFcm] = useState(false);
  const [isSyncingBus, setIsSyncingBus] = useState(false);

  useEffect(() => {
    if (notifications) {
      return undefined;
    }

    let isActive = true;

    async function loadNotifications() {
      setNotificationsErrorMessage("");

      try {
        const nextNotifications = await getArrivalNotifications();

        if (isActive) {
          setServerNotifications(nextNotifications);
        }
      } catch (error) {
        if (isActive) {
          setServerNotifications([]);
          setNotificationsErrorMessage(
            error?.message ?? "알림을 불러오지 못했습니다.",
          );
        }
      }
    }

    loadNotifications();

    return () => {
      isActive = false;
    };
  }, [notifications]);

  const notificationItems = notifications ?? serverNotifications;
  const shouldShowNotificationsError =
    !notifications && notificationsErrorMessage;

  const handleRegisterDeviceToken = async () => {
    if (isRegisteringDeviceToken) {
      return;
    }

    const trimmedDeviceToken = deviceToken.trim();

    if (!trimmedDeviceToken) {
      Alert.alert("디바이스 토큰", "등록할 디바이스 토큰을 입력해 주세요.");
      return;
    }

    setIsRegisteringDeviceToken(true);

    try {
      await registerDeviceToken({ deviceToken: trimmedDeviceToken });
      Alert.alert("디바이스 토큰", "디바이스 토큰을 등록했습니다.");
    } catch (error) {
      Alert.alert(
        "디바이스 토큰 등록 실패",
        error?.message ?? "디바이스 토큰 등록에 실패했습니다.",
      );
    } finally {
      setIsRegisteringDeviceToken(false);
    }
  };

  const handleSendTestFcm = async () => {
    if (isSendingTestFcm) {
      return;
    }

    setIsSendingTestFcm(true);

    try {
      await sendTestFcm({
        title: testTitle,
        body: testBody,
      });
      Alert.alert("테스트 알림", "테스트 푸시를 발송했습니다.");
    } catch (error) {
      Alert.alert(
        "테스트 알림 실패",
        error?.message ?? "테스트 푸시 발송에 실패했습니다.",
      );
    } finally {
      setIsSendingTestFcm(false);
    }
  };

  const handleSyncBus = async () => {
    if (isSyncingBus) {
      return;
    }

    setIsSyncingBus(true);

    try {
      const response = await syncBus();
      Alert.alert(
        "버스 동기화",
        typeof response === "string"
          ? response
          : response?.message ?? "버스 동기화를 실행했습니다.",
      );
    } catch (error) {
      Alert.alert(
        "버스 동기화 실패",
        error?.message ?? "버스 동기화 테스트에 실패했습니다.",
      );
    } finally {
      setIsSyncingBus(false);
    }
  };

  return (
    <AppScreen>
      <View style={styles.container}>
        <Header
          type="back"
          title="알림"
          BackIcon={BackIcon}
          backButtonStyle={styles.backButton}
          backIconStyle={styles.backIcon}
          headerStyle={styles.headerBox}
          rightAccessory={
            <Pressable
              accessibilityLabel="알림 설정"
              accessibilityRole="button"
              hitSlop={12}
              onPress={onSettingsPress}
              style={styles.settingButton}
            >
              <SettingIcon height={24} width={24} />
            </Pressable>
          }
          titleStyle={styles.headerTitle}
          onBackPress={onBackPress}
        />

        <View style={styles.list}>
          <View style={styles.testFcmPanel}>
            <TextInput
              multiline
              onChangeText={setDeviceToken}
              placeholder="디바이스 토큰"
              placeholderTextColor={colors.gray05}
              style={[styles.testInput, styles.deviceTokenInput]}
              value={deviceToken}
            />
            <Pressable
              accessibilityRole="button"
              disabled={isRegisteringDeviceToken}
              onPress={handleRegisterDeviceToken}
              style={[
                styles.syncBusButton,
                isRegisteringDeviceToken && styles.testSendButtonDisabled,
              ]}
            >
              <Text style={styles.syncBusButtonText}>
                {isRegisteringDeviceToken ? "등록 중" : "디바이스 토큰 등록"}
              </Text>
            </Pressable>
            <TextInput
              onChangeText={setTestTitle}
              placeholder="테스트 알림"
              placeholderTextColor={colors.gray05}
              returnKeyType="next"
              style={styles.testInput}
              value={testTitle}
            />
            <TextInput
              multiline
              onChangeText={setTestBody}
              placeholder="이것은 OnETA 테스트 푸시입니다!"
              placeholderTextColor={colors.gray05}
              style={[styles.testInput, styles.testBodyInput]}
              value={testBody}
            />
            <Pressable
              accessibilityRole="button"
              disabled={isSendingTestFcm}
              onPress={handleSendTestFcm}
              style={[
                styles.testSendButton,
                isSendingTestFcm && styles.testSendButtonDisabled,
              ]}
            >
              <Text style={styles.testSendButtonText}>
                {isSendingTestFcm ? "발송 중" : "테스트 알림 보내기"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSyncingBus}
              onPress={handleSyncBus}
              style={[
                styles.syncBusButton,
                isSyncingBus && styles.testSendButtonDisabled,
              ]}
            >
              <Text style={styles.syncBusButtonText}>
                {isSyncingBus ? "동기화 중" : "버스 동기화 테스트"}
              </Text>
            </Pressable>
          </View>

          {shouldShowNotificationsError ? (
            <View style={styles.notificationStatusBox}>
              <Text style={styles.notificationStatusText}>
                {notificationsErrorMessage}
              </Text>
            </View>
          ) : null}

          {notificationItems.map((item) => {
            const isDanger = item.type === "danger";

            return (
              <Pressable
                key={item.id}
                onPress={() => onNotificationPress?.(item)}
                style={[
                  styles.card,
                  isDanger ? styles.cardDanger : styles.cardSuccess,
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.titleWrap}>
                    <View
                      style={[
                        styles.statusDot,
                        isDanger ? styles.dotDanger : styles.dotSuccess,
                      ]}
                    />
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>
                  <Text style={styles.cardTime}>{item.timeLabel}</Text>
                </View>

                {item.description ? (
                  <Text
                    style={[
                      styles.cardDescription,
                      isDanger && styles.cardDescriptionDanger,
                    ]}
                  >
                    {item.description}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </AppScreen>
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
  settingButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  testFcmPanel: {
    alignSelf: "stretch",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray03,
    backgroundColor: colors.white,
    padding: 14,
    gap: 10,
  },
  testInput: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray03,
    backgroundColor: colors.gray01,
    paddingHorizontal: 12,
    ...typography.body03M,
    color: colors.gray09,
  },
  testBodyInput: {
    minHeight: 74,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  deviceTokenInput: {
    minHeight: 88,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  testSendButton: {
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.main,
  },
  testSendButtonDisabled: {
    opacity: 0.6,
  },
  testSendButtonText: {
    ...typography.body03Sb,
    color: colors.white,
  },
  syncBusButton: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gray03,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  syncBusButtonText: {
    ...typography.body03Sb,
    color: colors.gray09,
  },
  notificationStatusBox: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 8,
    borderColor: colors.gray03,
    backgroundColor: colors.gray01,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  notificationStatusText: {
    ...typography.body03M,
    color: colors.gray07,
    textAlign: "center",
  },
  card: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: "space-between",
  },
  cardSuccess: {
    alignItems: "center",
    backgroundColor: colors.sub,
    borderColor: "#CAF9DA",
  },
  cardDanger: {
    alignItems: "flex-start",
    backgroundColor: "#FFEFEF",
    borderColor: "#FFE3E3",
  },
  cardTopRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
  },
  statusDot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    marginRight: 12,
  },
  dotSuccess: {
    backgroundColor: "#35C777",
  },
  dotDanger: {
    backgroundColor: "#F4666D",
  },
  cardTitle: {
    ...typography.body02M,
    color: colors.gray09,
    fontStyle: "normal",
    letterSpacing: -0.14,
    textAlign: "left",
  },
  cardTime: {
    minWidth: 28,
    fontFamily: "SUIT",
    fontSize: 12,
    fontStyle: "normal",
    lineHeight: 19.2,
    fontWeight: "500",
    color: colors.gray07,
    letterSpacing: -0.12,
    textAlign: "center",
  },
  cardDescription: {
    marginTop: 8,
    marginLeft: 25,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: "#7F8B97",
  },
  cardDescriptionDanger: {
    color: colors.point,
    fontFamily: "SUIT",
    fontSize: 11,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 15.4,
    letterSpacing: -0.11,
  },
});
