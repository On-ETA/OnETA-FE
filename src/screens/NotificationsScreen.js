import React, { memo, useCallback, useRef, useState } from "react";
import { AppState, FlatList, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import BackIcon from "../../assets/images/L.svg";
import SettingIcon from "../../assets/images/setting.svg";
import { getNotifications } from "../api/notifications/list";
import { AppScreen, Header } from "../components";
import { colors, typography } from "../theme";
import { subscribeNotifications } from "../notifications/events";

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

  const refreshRef = useRef(() => {});

  useFocusEffect(useCallback(() => {
    if (notifications) {
      return undefined;
    }

    let isActive = true;
    let controller;
    let refreshTimer;

    async function loadNotifications() {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      setIsLoadingNotifications(true);
      setNotificationsErrorMessage("");

      try {
        const nextNotifications = await getNotifications({
          signal: requestController.signal,
        });

        if (isActive && !requestController.signal.aborted) {
          setServerNotifications(nextNotifications);
        }
      } catch (error) {
        if (isActive && !requestController.signal.aborted) {
          setNotificationsErrorMessage(
            error?.message ?? "알림을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (isActive && !requestController.signal.aborted) {
          setIsLoadingNotifications(false);
        }
      }
    }

    function scheduleRefresh() {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(loadNotifications, 300);
    }
    const unsubscribe = subscribeNotifications(scheduleRefresh);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") scheduleRefresh();
    });
    refreshRef.current = loadNotifications;
    loadNotifications();

    return () => {
      isActive = false;
      clearTimeout(refreshTimer);
      controller?.abort();
      unsubscribe();
      appStateSubscription.remove();
      refreshRef.current = () => {};
    };
  }, [notifications]));

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
        <Header topSpacerStyle={{ height: 0 }}
          type="back"
          title="알림"
          BackIcon={BackIcon}
          backButtonStyle={styles.backButton}
          backIconStyle={styles.backIcon}
          headerStyle={styles.headerBox}
          rightAccessory={onSettingsPress || Platform.OS !== "web" ? (
            <Pressable
              accessibilityLabel="알림 설정"
              accessibilityRole="button"
              hitSlop={12}
              onPress={onSettingsPress ?? (() => Linking.openSettings().catch(() => {}))}
              style={styles.settingButton}
            >
              <SettingIcon height={24} width={24} />
            </Pressable>
          ) : null}
          titleStyle={styles.headerTitle}
          onBackPress={onBackPress}
        />

        <FlatList
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator
          style={styles.scroller}
          data={notificationItems}
          keyExtractor={(item) => String(item.id)}
          refreshing={isLoadingNotifications}
          onRefresh={notifications ? undefined : () => refreshRef.current()}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          ListHeaderComponent={shouldShowNotificationsError ? (
            <StatusBox text={notificationsErrorMessage} />
          ) : null}
          ListEmptyComponent={isLoadingNotifications ? (
            <StatusBox text="알림을 불러오는 중입니다." />
          ) : shouldShowEmptyState ? (
            <StatusBox text="받은 알림이 없습니다." />
          ) : null}
          renderItem={({ item }) => (
            <NotificationCard
              item={item}
              onPress={onNotificationPress}
            />
          )}
        />
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

const NotificationCard = memo(function NotificationCard({ item, onPress }) {
  const isDanger = item.type === "danger";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress?.(item)}
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
});

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
