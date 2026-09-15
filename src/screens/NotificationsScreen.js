import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import BackIcon from "../../assets/images/L.svg";
import SettingIcon from "../../assets/images/setting.svg";
import { getNotifications } from "../api/notifications/list";
import { AppScreen, Header } from "../components";
import { colors, typography } from "../theme";

export function NotificationsScreen({
  notifications,
  onBackPress,
  onNotificationPress,
  onSettingsPress,
}) {
  const [serverNotifications, setServerNotifications] = useState([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationsErrorMessage, setNotificationsErrorMessage] =
    useState("");

  useEffect(() => {
    if (notifications) {
      return undefined;
    }

    let isActive = true;
    const controller = new AbortController();

    async function loadNotifications() {
      setIsLoadingNotifications(true);
      setNotificationsErrorMessage("");

      try {
        const nextNotifications = await getNotifications({
          signal: controller.signal,
        });

        if (isActive) {
          setServerNotifications(nextNotifications);
        }
      } catch (error) {
        if (isActive && error?.name !== "AbortError") {
          setServerNotifications([]);
          setNotificationsErrorMessage(
            error?.message ?? "알림을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingNotifications(false);
        }
      }
    }

    loadNotifications();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [notifications]);

  const notificationItems = notifications ?? serverNotifications;
  const shouldShowNotificationsError =
    !notifications && notificationsErrorMessage;
  const shouldShowEmptyState =
    !isLoadingNotifications &&
    !shouldShowNotificationsError &&
    notificationItems.length === 0;

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

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator
          style={styles.scroller}
        >
          {isLoadingNotifications ? (
            <StatusBox text="알림을 불러오는 중입니다." />
          ) : null}

          {shouldShowNotificationsError ? (
            <StatusBox text={notificationsErrorMessage} />
          ) : null}

          {shouldShowEmptyState ? (
            <StatusBox text="받은 알림이 없습니다." />
          ) : null}

          {notificationItems.map((item) => (
            <NotificationCard
              item={item}
              key={item.id}
              onPress={() => onNotificationPress?.(item)}
            />
          ))}
        </ScrollView>
      </View>
    </AppScreen>
  );
}

function StatusBox({ text }) {
  return (
    <View style={styles.notificationStatusBox}>
      <Text style={styles.notificationStatusText}>{text}</Text>
    </View>
  );
}

function NotificationCard({ item, onPress }) {
  const isDanger = item.type === "danger";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, isDanger ? styles.cardDanger : styles.cardSuccess]}
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
  scroller: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 34,
    paddingBottom: 40,
    gap: 14,
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
    marginLeft: 27,
    fontFamily: "SUIT",
    fontSize: 14,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 20,
    color: "#7F8B97",
  },
  cardDescriptionDanger: {
    color: colors.point,
    fontSize: 11,
    lineHeight: 15.4,
    letterSpacing: -0.11,
  },
});
