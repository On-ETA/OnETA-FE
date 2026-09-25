import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { getAddresses } from "../api/addresses";
import { homeCacheKeys, readHomeCache, writeHomeCache } from "../api/homeCache";
import { HomeTopSection } from "../components";
import { AddressManagementScreen } from "./AddressManagementScreen";
import { CustomAlarmScreen } from "./home/custom-alarm/CustomAlarmScreen";
import {
  GarageDepartureAlarmEditScreen,
  ScheduleAlarmEditScreen,
} from "./home/custom-alarm/CustomAlarmEditScreen";
import { GarageDepartureAlarmAddScreen } from "./home/custom-alarm/GarageDepartureAlarmAddScreen";
import {
  ScheduleAlarmAddScreen,
  ScheduleRouteMapStep,
  ScheduleRouteResultStep,
} from "./home/custom-alarm/ScheduleAlarmAddScreen";
import { FirstLastRouteDetailScreen } from "./home/first-last/FirstLastRouteDetailScreen";
import { FirstLastRouteScreen } from "./home/first-last/FirstLastRouteScreen";
import { MyPageScreen } from "./MyPageScreen";
import { colors, layout } from "../theme";
import { blurActiveElement } from "../utils/accessibility";
import { createFirstLastRouteSummary } from "../utils/firstLastRouteSummary";

const homeBackground = colors.gray01;


function getCurrentAddressLabel(addresses) {
  const currentAddress = addresses.find((address) => address.isCurrent);
  const displayAddress = currentAddress ?? addresses[0];

  return displayAddress?.name ?? "";
}

export function HomeScreen({
  notificationCount = 0,
  initialTab = "home",
  onOpenAccountInfo,
  onOpenPassword,
  onOpenNotifications,
  onOpenNotices,
  onOpenFaqs,
  onOpenContact,
  onOpenPrivacy,
  onOpenTerms,
  onLogoutComplete,
  onWithdrawComplete,
  onTabPress,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeHomeTab, setActiveHomeTab] = useState("firstLast");
  const [isAddressManagerVisible, setIsAddressManagerVisible] = useState(false);
  const [isRouteDetailVisible, setIsRouteDetailVisible] = useState(false);
  const [firstLastRouteSetupStep, setFirstLastRouteSetupStep] = useState(null);
  const [firstLastRoutePlaces, setFirstLastRoutePlaces] = useState({
    origin: "마포구 와우산로 94",
    destination: "우리집",
  });
  const [isScheduleAlarmAddVisible, setIsScheduleAlarmAddVisible] =
    useState(false);
  const [scheduleAlarmInitialStep, setScheduleAlarmInitialStep] =
    useState("form");
  const [isGarageDepartureAddVisible, setIsGarageDepartureAddVisible] =
    useState(false);
  const [editingCustomAlarm, setEditingCustomAlarm] = useState(null);
  const [currentAddressLabel, setCurrentAddressLabel] = useState("");
  const [firstLastRouteSummary, setFirstLastRouteSummary] = useState(() =>
    readHomeCache(homeCacheKeys.firstLastRoute, null),
  );

  const setCachedFirstLastRouteSummary = (summary) => {
    setFirstLastRouteSummary(summary);
    writeHomeCache(homeCacheKeys.firstLastRoute, summary);
  };

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    async function loadCurrentAddressLabel() {
      try {
        const addresses = await getAddresses({
          signal: controller.signal,
        });

        if (isActive) {
          setCurrentAddressLabel(getCurrentAddressLabel(addresses));
        }
      } catch {
        if (isActive) {
          setCurrentAddressLabel("");
        }
      }
    }

    loadCurrentAddressLabel();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const handleTabPress = (tabKey) => {
    blurActiveElement();
    setIsAddressManagerVisible(false);
    setIsRouteDetailVisible(false);
    setFirstLastRouteSetupStep(null);
    setIsScheduleAlarmAddVisible(false);
    setScheduleAlarmInitialStep("form");
    setIsGarageDepartureAddVisible(false);
    setEditingCustomAlarm(null);

    if (onTabPress?.(tabKey)) {
      return;
    }

    setActiveTab(tabKey);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" backgroundColor={homeBackground} />
      <SafeAreaView edges={["top", "bottom"]} style={styles.phone}>
        <View style={styles.content}>
          {activeTab === "myPage" ? (
            <MyPageScreen
              embedded
              onBackPress={() => handleTabPress("home")}
              onProfilePress={onOpenAccountInfo}
              onOpenNotifications={onOpenNotifications}
              onOpenPassword={onOpenPassword}
              onOpenContact={onOpenContact}
              onOpenFaqs={onOpenFaqs}
              onOpenNotices={onOpenNotices}
              onOpenPrivacy={onOpenPrivacy}
              onOpenTerms={onOpenTerms}
              onLogoutComplete={onLogoutComplete}
              onWithdrawComplete={onWithdrawComplete}
              notificationCount={notificationCount}
            />
          ) : activeTab === "home" ? (
            isAddressManagerVisible ? (
              <AddressManagementScreen
                onAuthRequired={onLogoutComplete}
                onBackPress={() => {
                  blurActiveElement();
                  setIsAddressManagerVisible(false);
                }}
                onCurrentAddressChange={setCurrentAddressLabel}
              />
            ) : isGarageDepartureAddVisible ? (
              <GarageDepartureAlarmAddScreen
                onBackPress={() => {
                  blurActiveElement();
                  setIsGarageDepartureAddVisible(false);
                }}
              />
            ) : isScheduleAlarmAddVisible ? (
              <ScheduleAlarmAddScreen
                initialStep={scheduleAlarmInitialStep}
                mapTitle={
                  scheduleAlarmInitialStep === "route"
                    ? "경로 재설정"
                    : "알림 추가"
                }
                onBackPress={() => {
                  blurActiveElement();
                  setIsScheduleAlarmAddVisible(false);
                  setScheduleAlarmInitialStep("form");
                }}
                onRouteConfigured={
                  scheduleAlarmInitialStep === "route"
                    ? (route, places) => {
                        setCachedFirstLastRouteSummary(
                          createFirstLastRouteSummary(route, places),
                        );
                        blurActiveElement();
                        setIsScheduleAlarmAddVisible(false);
                        setScheduleAlarmInitialStep("form");
                      }
                    : undefined
                }
              />
            ) : firstLastRouteSetupStep === "map" ? (
              <ScheduleRouteMapStep
                headerTitle="경로 재설정"
                onBackPress={() => {
                  blurActiveElement();
                  setFirstLastRouteSetupStep(null);
                }}
                onConfirm={(places) => {
                  blurActiveElement();
                  setFirstLastRoutePlaces(places);
                  setFirstLastRouteSetupStep("result");
                }}
              />
            ) : firstLastRouteSetupStep === "result" ? (
              <ScheduleRouteResultStep
                actionLabel="이 경로로 설정"
                initialDestination={firstLastRoutePlaces.destination}
                initialOrigin={firstLastRoutePlaces.origin}
                onBackPress={() => {
                  blurActiveElement();
                  setFirstLastRouteSetupStep("map");
                }}
                onRouteSelect={(route, places) => {
                  setCachedFirstLastRouteSummary(
                    createFirstLastRouteSummary(route, places),
                  );
                  blurActiveElement();
                  setFirstLastRouteSetupStep(null);
                }}
              />
            ) : editingCustomAlarm?.type === "schedule" ? (
              <ScheduleAlarmEditScreen
                alarm={editingCustomAlarm.alarm}
                onBackPress={() => {
                  blurActiveElement();
                  setEditingCustomAlarm(null);
                }}
                onSavePress={() => {
                  blurActiveElement();
                  setEditingCustomAlarm(null);
                }}
              />
            ) : editingCustomAlarm?.type === "garage" ? (
              <GarageDepartureAlarmEditScreen
                alarm={editingCustomAlarm.alarm}
                onBackPress={() => {
                  blurActiveElement();
                  setEditingCustomAlarm(null);
                }}
                onChangeBusPress={() => {
                  blurActiveElement();
                  setEditingCustomAlarm(null);
                  setIsGarageDepartureAddVisible(true);
                }}
                onSavePress={() => {
                  blurActiveElement();
                  setEditingCustomAlarm(null);
                }}
              />
            ) : isRouteDetailVisible ? (
              <FirstLastRouteDetailScreen
                onBackPress={() => {
                  blurActiveElement();
                  setIsRouteDetailVisible(false);
                }}
              />
            ) : (
              <HomeDashboard
                activeHomeTab={activeHomeTab}
                addressLabel={
                  currentAddressLabel ||
                  (activeHomeTab === "firstLast" ? "주소 등록하기" : "주소 등록하기")
                }
                notificationCount={notificationCount}
                onAddressPress={() => {
                  blurActiveElement();
                  setIsAddressManagerVisible(true);
                }}
                onBellPress={onOpenNotifications}
                onGarageDepartureAddPress={() => {
                  blurActiveElement();
                  setIsGarageDepartureAddVisible(true);
                }}
                onHomeTabPress={setActiveHomeTab}
                onMyPagePress={() => handleTabPress("myPage")}
                onRouteDetailPress={() => {
                  blurActiveElement();
                  setIsRouteDetailVisible(true);
                }}
                onRouteSetupPress={() => {
                  blurActiveElement();
                  setIsScheduleAlarmAddVisible(true);
                  setScheduleAlarmInitialStep("route");
                }}
                firstLastRouteSummary={firstLastRouteSummary}
                onScheduleAlarmAddPress={() => {
                  blurActiveElement();
                  setIsScheduleAlarmAddVisible(true);
                }}
                onGarageAlarmEditPress={(alarm) => {
                  blurActiveElement();
                  setEditingCustomAlarm({ type: "garage", alarm });
                }}
                onScheduleAlarmEditPress={(alarm) => {
                  blurActiveElement();
                  setEditingCustomAlarm({ type: "schedule", alarm });
                }}
              />
            )
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

function HomeDashboard({
  activeHomeTab,
  addressLabel,
  notificationCount,
  onAddressPress,
  onBellPress,
  onGarageDepartureAddPress,
  onGarageAlarmEditPress,
  onHomeTabPress,
  onMyPagePress,
  onFirstLastRouteSetupPress,
  firstLastRouteSummary,
  onRouteDetailPress,
  onRouteSetupPress,
  onScheduleAlarmAddPress,
  onScheduleAlarmEditPress,
}) {
  return (
    <>
      <HomeTopSection
        activeTab={activeHomeTab}
        addressLabel={addressLabel}
        notificationCount={notificationCount}
        onAddressPress={onAddressPress}
        onBellPress={onBellPress}
        onMyPagePress={onMyPagePress}
        onTabPress={onHomeTabPress}
        showMyPageButton
      />
      {activeHomeTab === "customAlarm" ? (
        <CustomAlarmScreen
          onGarageDepartureAddPress={onGarageDepartureAddPress}
          onGarageAlarmEditPress={onGarageAlarmEditPress}
          onScheduleAlarmAddPress={onScheduleAlarmAddPress}
          onScheduleAlarmEditPress={onScheduleAlarmEditPress}
        />
      ) : (
        <FirstLastRouteScreen
          onRouteDetailPress={onRouteDetailPress}
          onRouteSetupPress={onRouteSetupPress}
          routeSummary={firstLastRouteSummary}
        />
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
        overflowX: "hidden",
        overflowY: "auto",
      },
    }),
  },
  content: {
    flex: 1,
    backgroundColor: homeBackground,
  },
});
