import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { getAddresses } from "../api/addresses";
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

const homeBackground = colors.gray01;

function getPrimaryTransitSegment(route) {
  return route?.segments?.find((segment) => segment.transitType !== "WALK");
}

function getWalkSegments(route) {
  return route?.segments?.filter((segment) => segment.transitType === "WALK") ?? [];
}

function getSegmentStopName(segment, edge) {
  if (!segment) {
    return "";
  }

  if (edge === "start") {
    return segment.startStation || segment.stations?.[0]?.name || "";
  }

  return (
    segment.endStation ||
    segment.stations?.[segment.stations.length - 1]?.name ||
    ""
  );
}

function getRouteValue(source, key) {
  return source?.[key] ?? source?.raw?.[key];
}

function getNumericRouteValue(source, key) {
  const value = getRouteValue(source, key);
  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}

function formatClockTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return undefined;
  }

  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function formatRouteTime(value) {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    const [hour, minute] = value.split(":");

    return hour && minute
      ? `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
      : value;
  }

  if (typeof value === "object") {
    const hour = Number(value.hour);
    const minute = Number(value.minute);

    return Number.isFinite(hour) && Number.isFinite(minute)
      ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
      : undefined;
  }

  return undefined;
}

function getFirstLastRouteTimes({ firstWalk, primarySegment, route }) {
  const now = new Date();
  const realTimeArrivalSeconds = getNumericRouteValue(
    primarySegment,
    "realTimeArrivalSeconds",
  );
  const busMinutes = getNumericRouteValue(primarySegment, "durationMinutes");
  const walkMinutes = getNumericRouteValue(firstWalk, "durationMinutes") ?? 0;
  const boardingDate = Number.isFinite(realTimeArrivalSeconds)
    ? new Date(now.getTime() + realTimeArrivalSeconds * 1000)
    : null;
  const departureDate = boardingDate
    ? new Date(boardingDate.getTime() - walkMinutes * 60 * 1000)
    : null;
  const arrivalDate =
    boardingDate && Number.isFinite(busMinutes)
      ? new Date(boardingDate.getTime() + busMinutes * 60 * 1000)
      : null;
  const derivedRemainingMinutes = departureDate
    ? Math.max(
        0,
        Math.ceil((departureDate.getTime() - now.getTime()) / 60000),
      )
    : undefined;

  return {
    remainingMinutes:
      getNumericRouteValue(route, "remainingMinutes") ??
      getNumericRouteValue(route, "remainingTimeMinutes") ??
      derivedRemainingMinutes,
    departureTime:
      formatRouteTime(getRouteValue(route, "departureTime")) ??
      formatRouteTime(getRouteValue(route, "startTime")) ??
      formatClockTime(departureDate),
    boardingTime:
      formatRouteTime(getRouteValue(primarySegment, "boardingTime")) ??
      formatRouteTime(getRouteValue(primarySegment, "startTime")) ??
      formatClockTime(boardingDate),
    arrivalTime:
      formatRouteTime(getRouteValue(route, "arrivalTime")) ??
      formatRouteTime(getRouteValue(primarySegment, "arrivalTime")) ??
      formatRouteTime(getRouteValue(primarySegment, "endTime")) ??
      formatClockTime(arrivalDate),
  };
}

function createFirstLastRouteSummary(route, places = {}) {
  const primarySegment = getPrimaryTransitSegment(route);
  const walkSegments = getWalkSegments(route);
  const firstWalk = walkSegments[0];
  const lastWalk = walkSegments[walkSegments.length - 1];
  const totalDuration =
    route?.realTimeDurationMinutes ?? route?.totalDurationMinutes ?? 0;
  const routeTimes = getFirstLastRouteTimes({
    firstWalk,
    primarySegment,
    route,
  });

  return {
    remainingMinutes: routeTimes.remainingMinutes,
    departureTime: routeTimes.departureTime,
    routeNumber: primarySegment?.transitName || "대중교통",
    routeDirection: primarySegment?.endStation
      ? `${primarySegment.endStation} 방면`
      : `${places.destination ?? route?.destinationAddress ?? "도착지"} 방면`,
    walkMinutes: firstWalk?.durationMinutes ?? 5,
    busMinutes: primarySegment?.durationMinutes ?? (totalDuration || 4),
    afterWalkMinutes: lastWalk?.durationMinutes ?? 8,
    boardingStopName:
      getSegmentStopName(primarySegment, "start") ||
      places.origin ||
      route?.originAddress ||
      "출발정류장",
    boardingTime: routeTimes.boardingTime,
    arrivalStopName:
      getSegmentStopName(primarySegment, "end") ||
      places.destination ||
      route?.destinationAddress ||
      "도착정류장",
    arrivalTime: routeTimes.arrivalTime,
    preDepartureAlarmMinutes: 10,
    route,
  };
}

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
  const [firstLastRouteSummary, setFirstLastRouteSummary] = useState(null);

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
      <View style={styles.phone}>
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
                onBackPress={() => setIsAddressManagerVisible(false)}
                onCurrentAddressChange={setCurrentAddressLabel}
              />
            ) : isGarageDepartureAddVisible ? (
              <GarageDepartureAlarmAddScreen
                onBackPress={() => setIsGarageDepartureAddVisible(false)}
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
                  setIsScheduleAlarmAddVisible(false);
                  setScheduleAlarmInitialStep("form");
                }}
                onRouteConfigured={
                  scheduleAlarmInitialStep === "route"
                    ? (route, places) => {
                        setFirstLastRouteSummary(
                          createFirstLastRouteSummary(route, places),
                        );
                        setIsScheduleAlarmAddVisible(false);
                        setScheduleAlarmInitialStep("form");
                      }
                    : undefined
                }
              />
            ) : firstLastRouteSetupStep === "map" ? (
              <ScheduleRouteMapStep
                headerTitle="경로 재설정"
                onBackPress={() => setFirstLastRouteSetupStep(null)}
                onConfirm={(places) => {
                  setFirstLastRoutePlaces(places);
                  setFirstLastRouteSetupStep("result");
                }}
              />
            ) : firstLastRouteSetupStep === "result" ? (
              <ScheduleRouteResultStep
                actionLabel="이 경로로 설정"
                initialDestination={firstLastRoutePlaces.destination}
                initialOrigin={firstLastRoutePlaces.origin}
                onBackPress={() => setFirstLastRouteSetupStep("map")}
                onRouteSelect={() => setFirstLastRouteSetupStep(null)}
              />
            ) : editingCustomAlarm?.type === "schedule" ? (
              <ScheduleAlarmEditScreen
                alarm={editingCustomAlarm.alarm}
                onBackPress={() => setEditingCustomAlarm(null)}
                onSavePress={() => setEditingCustomAlarm(null)}
              />
            ) : editingCustomAlarm?.type === "garage" ? (
              <GarageDepartureAlarmEditScreen
                alarm={editingCustomAlarm.alarm}
                onBackPress={() => setEditingCustomAlarm(null)}
                onChangeBusPress={() => {
                  setEditingCustomAlarm(null);
                  setIsGarageDepartureAddVisible(true);
                }}
                onSavePress={() => setEditingCustomAlarm(null)}
              />
            ) : isRouteDetailVisible ? (
              <FirstLastRouteDetailScreen
                onBackPress={() => setIsRouteDetailVisible(false)}
              />
            ) : (
              <HomeDashboard
                activeHomeTab={activeHomeTab}
                addressLabel={
                  currentAddressLabel ||
                  (activeHomeTab === "firstLast" ? "주소 등록하기" : "우리집")
                }
                notificationCount={notificationCount}
                onAddressPress={() => setIsAddressManagerVisible(true)}
                onBellPress={onOpenNotifications}
                onGarageDepartureAddPress={() =>
                  setIsGarageDepartureAddVisible(true)
                }
                onHomeTabPress={setActiveHomeTab}
                onMyPagePress={() => handleTabPress("myPage")}
                onRouteDetailPress={() => setIsRouteDetailVisible(true)}
                onScheduleAlarmAddPress={() =>
                  setIsScheduleAlarmAddVisible(true)
                }
                onGarageAlarmEditPress={(alarm) =>
                  setEditingCustomAlarm({ type: "garage", alarm })
                }
                onScheduleAlarmEditPress={(alarm) =>
                  setEditingCustomAlarm({ type: "schedule", alarm })
                }
              />
            )
          ) : null}
        </View>
      </View>
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
        <FirstLastRouteScreen onRouteDetailPress={onRouteDetailPress} />
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
});
