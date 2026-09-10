import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import BackIcon from "../../assets/images/L.svg";
import SettingIcon from "../../assets/images/setting.svg";
import { getArrivalNotifications } from "../api/notifications/arrival";
import { AppScreen, Header } from "../components";
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

  useEffect(() => {
    if (notifications) {
      return undefined;
    }

    let isActive = true;

    async function loadNotifications() {
      try {
        const nextNotifications = await getArrivalNotifications();

        if (isActive) {
          setServerNotifications(nextNotifications);
        }
      } catch {
        if (isActive) {
          setServerNotifications(DEFAULT_NOTIFICATIONS);
        }
      }
    }

    loadNotifications();

    return () => {
      isActive = false;
    };
  }, [notifications]);

  const notificationItems = notifications ?? serverNotifications;

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
