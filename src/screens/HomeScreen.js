import React, { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { HomeTopSection, MainTabBar } from "../components";
import { AddressManagementScreen } from "./AddressManagementScreen";
import { CustomAlarmScreen } from "./home/custom-alarm/CustomAlarmScreen";
import { GarageDepartureAlarmAddScreen } from "./home/custom-alarm/GarageDepartureAlarmAddScreen";
import { FirstLastRouteScreen } from "./home/first-last/FirstLastRouteScreen";
import { MyPageScreen } from "./MyPageScreen";
import { colors, layout, typography } from "../theme";

const homeBackground = colors.gray01;

export function HomeScreen({
  notificationCount = 0,
  initialTab = "home",
  onOpenAccountInfo,
  onOpenPassword,
  onOpenNotifications,
  onOpenNotices,
  onOpenContact,
  onOpenPrivacy,
  onOpenTerms,
  onWithdrawComplete,
  onTabPress,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeHomeTab, setActiveHomeTab] = useState("firstLast");
  const [isAddressManagerVisible, setIsAddressManagerVisible] = useState(false);
  const [isGarageDepartureAddVisible, setIsGarageDepartureAddVisible] =
    useState(false);

  const handleTabPress = (tabKey) => {
    setIsAddressManagerVisible(false);
    setIsGarageDepartureAddVisible(false);

    if (onTabPress?.(tabKey)) {
      return;
    }

    setActiveTab(tabKey);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" backgroundColor={homeBackground} />
      <View style={styles.phone}>
        <View style={styles.content}>
          {activeTab === "myPage" ? (
            <MyPageScreen
              embedded
              onProfilePress={onOpenAccountInfo}
              onOpenNotifications={onOpenNotifications}
              onOpenPassword={onOpenPassword}
              onOpenContact={onOpenContact}
              onOpenNotices={onOpenNotices}
              onOpenPrivacy={onOpenPrivacy}
              onOpenTerms={onOpenTerms}
              onWithdrawComplete={onWithdrawComplete}
              notificationCount={notificationCount}
            />
          ) : activeTab === "character" ? (
            <>
              <HomeTopSection
                notificationCount={notificationCount}
                onBellPress={onOpenNotifications}
                showAddress={false}
                showTabs={false}
              />
              <View style={styles.placeholder}>
                <Text style={styles.placeholderTitle}>캐릭터</Text>
              </View>
            </>
          ) : activeTab === "home" ? (
            isAddressManagerVisible ? (
              <AddressManagementScreen
                onBackPress={() => setIsAddressManagerVisible(false)}
              />
            ) : isGarageDepartureAddVisible ? (
              <GarageDepartureAlarmAddScreen
                onBackPress={() => setIsGarageDepartureAddVisible(false)}
              />
            ) : (
              <HomeDashboard
                activeHomeTab={activeHomeTab}
                notificationCount={notificationCount}
                onAddressPress={() => setIsAddressManagerVisible(true)}
                onBellPress={onOpenNotifications}
                onGarageDepartureAddPress={() =>
                  setIsGarageDepartureAddVisible(true)
                }
                onHomeTabPress={setActiveHomeTab}
              />
            )
          ) : null}
        </View>

        {isAddressManagerVisible || isGarageDepartureAddVisible ? null : (
          <MainTabBar activeTab={activeTab} onTabPress={handleTabPress} />
        )}
      </View>
    </View>
  );
}

function HomeDashboard({
  activeHomeTab,
  notificationCount,
  onAddressPress,
  onBellPress,
  onGarageDepartureAddPress,
  onHomeTabPress,
}) {
  return (
    <>
      <HomeTopSection
        activeTab={activeHomeTab}
        notificationCount={notificationCount}
        onAddressPress={onAddressPress}
        onBellPress={onBellPress}
        onTabPress={onHomeTabPress}
      />
      {activeHomeTab === "customAlarm" ? (
        <CustomAlarmScreen
          onGarageDepartureAddPress={onGarageDepartureAddPress}
        />
      ) : (
        <FirstLastRouteScreen />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.gray03,
  },
  phone: {
    flex: 1,
    width: "100%",
    backgroundColor: homeBackground,
    ...Platform.select({
      web: {
        alignSelf: "center",
        maxWidth: layout.mobileFrameWidth,
      },
    }),
  },
  content: {
    flex: 1,
    backgroundColor: homeBackground,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderTitle: {
    ...typography.head01Sb,
    color: colors.gray09,
  },
});
