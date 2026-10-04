import React, { useCallback, useEffect, useState } from "react";
import { AppState, BackHandler, Platform, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { getAddresses } from "../api/addresses";
import {
  homeCacheKeys,
  readHomeCache,
  readHomeCacheAsync,
  removeHomeCache,
  writeHomeCache,
} from "../api/homeCache";
import {
  createTransitNotification,
  getTransitNotifications,
  TRANSIT_SCHEDULE_TYPES,
} from "../api/notifications/transit";
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
import {
  createFirstLastRouteSummary,
  formatSeoulTime,
  parseEstimatedDepartureAt,
} from "../utils/firstLastRouteSummary";

const homeBackground = colors.gray01;
const CUSTOM_ALARM_REFRESH_KEY = 0;


function createFirstLastRouteSummaryFromNotification(notification) {
  const details = notification?.route ?? {};
  const route = details?.route ?? details;
  const places = {
    origin:
      details?.origin ??
      details?.originAddress ??
      route?.originAddress,
    destination:
      details?.destination ??
      details?.destinationAddress ??
      route?.destinationAddress,
  };
  const estimatedDepartureAt =
    notification?.estimatedDepartureAt ??
    notification?.payload?.estimatedDepartureAt;
  const estimatedDepartureTimestamp =
    parseEstimatedDepartureAt(estimatedDepartureAt);
  const summary = createFirstLastRouteSummary(route, {
    ...places,
    ...(estimatedDepartureTimestamp !== undefined
      ? { departureTimestamp: estimatedDepartureTimestamp }
      : {}),
  });
  const reminderOffsetMinutes = Array.isArray(notification?.reminderOffsetMinutes)
    ? notification.reminderOffsetMinutes
    : [];

  return {
    ...summary,
    originPlace: details?.originPlace ?? (typeof details?.origin === "object" ? details.origin : undefined),
    destinationPlace:
      details?.destinationPlace ??
      (typeof details?.destination === "object" ? details.destination : undefined),
    originAddress: details?.originAddress ?? route?.originAddress,
    destinationAddress: details?.destinationAddress ?? route?.destinationAddress,
    notificationId: notification?.notificationId,
    routeName: notification?.routeName,
    arrivalTime: notification?.arrivalTime || summary.arrivalTime,
    estimatedDepartureAt,
    estimatedDepartureTimestamp,
    departureTime:
      formatSeoulTime(estimatedDepartureTimestamp) ?? summary.departureTime,
    remainingMinutes:
      estimatedDepartureTimestamp !== undefined
        ? Math.max(
            0,
            Math.ceil((estimatedDepartureTimestamp - Date.now()) / 60000),
          )
        : summary.remainingMinutes,
    preDepartureAlarmMinutes:
      reminderOffsetMinutes[0] ?? summary.preDepartureAlarmMinutes,
    route,
    scheduleType: notification?.scheduleType ?? TRANSIT_SCHEDULE_TYPES.first,
  };
}

function createTransitNotificationPayload(route, summary, scheduleType = TRANSIT_SCHEDULE_TYPES.first) {
  const routeDetails = route?.raw ?? route;

  return {
    reminderOffsetMinutes: [summary?.preDepartureAlarmMinutes ?? 10],
    routeDetails: JSON.stringify({
      ...routeDetails,
      origin: summary?.originPlace ?? summary?.origin ?? routeDetails?.origin,
      destination:
        summary?.destinationPlace ?? summary?.destination ?? routeDetails?.destination,
      originAddress:
        summary?.originAddress ?? routeDetails?.originAddress,
      destinationAddress:
        summary?.destinationAddress ?? routeDetails?.destinationAddress,
      originX: summary?.originPlace?.x ?? routeDetails?.originX,
      originY: summary?.originPlace?.y ?? routeDetails?.originY,
      destX: summary?.destinationPlace?.x ?? routeDetails?.destX,
      destY: summary?.destinationPlace?.y ?? routeDetails?.destY,
    }),
    scheduleType: summary?.scheduleType ?? route?.scheduleType ?? scheduleType,
  };
}

function getPlaceAddress(place) {
  if (typeof place === "string") return place;
  return place?.address ?? place?.roadAddress ?? place?.detail ?? place?.label ?? place?.name ?? "";
}

function getRouteSetupPlace(place, address, x, y) {
  const source = place && typeof place === "object" ? place : {};
  const routePlace = source.raw ?? source;
  const rawLatitude = source.y ?? routePlace.y ?? y;
  const rawLongitude = source.x ?? routePlace.x ?? x;
  const latitude = rawLatitude == null || rawLatitude === "" ? NaN : Number(rawLatitude);
  const longitude = rawLongitude == null || rawLongitude === "" ? NaN : Number(rawLongitude);
  const label =
    source.label ||
    source.name ||
    source.placeName ||
    (typeof place === "string" ? place : "") ||
    source.address ||
    address ||
    "";
  const placeAddress =
    source.address ??
    source.roadAddress ??
    address ??
    (typeof place === "string" ? place : label);

  return {
    ...source,
    label,
    name: source.name ?? label,
    address: placeAddress,
    x: Number.isFinite(longitude) ? longitude : undefined,
    y: Number.isFinite(latitude) ? latitude : undefined,
  };
}

function getFirstLastRouteSetupPlaces(summary) {
  const details = summary?.route ?? {};
  const route = details?.route ?? details;
  const raw = route?.raw ?? route;

  return {
    origin: getRouteSetupPlace(
      summary?.originPlace ?? details?.originPlace ?? details?.origin ?? route?.originPlace ?? route?.origin,
      summary?.originAddress ?? details?.originAddress ?? route?.originAddress ?? raw?.originAddress,
      summary?.originPlace?.x ?? details?.originX ?? route?.originX ?? raw?.originX,
      summary?.originPlace?.y ?? details?.originY ?? route?.originY ?? raw?.originY,
    ),
    destination: getRouteSetupPlace(
      summary?.destinationPlace ?? details?.destinationPlace ?? details?.destination ?? route?.destinationPlace ?? route?.destination,
      summary?.destinationAddress ?? details?.destinationAddress ?? route?.destinationAddress ?? raw?.destinationAddress,
      summary?.destinationPlace?.x ?? details?.destX ?? route?.destX ?? raw?.destX,
      summary?.destinationPlace?.y ?? details?.destY ?? route?.destY ?? raw?.destY,
    ),
  };
}

function getCurrentAddressLabel(addresses) {
  const currentAddress = addresses.find((address) => address.isCurrent);
  const displayAddress = currentAddress ?? addresses[0];

  return displayAddress?.name ?? "";
}

function getCreatedNotificationId(response) {
  return response?.notificationId ?? response?.id ?? response;
}

function getFirstLastRouteCacheKey(scheduleType) {
  return scheduleType === TRANSIT_SCHEDULE_TYPES.last
    ? homeCacheKeys.lastTransitRoute
    : homeCacheKeys.firstTransitRoute;
}

function readCachedFirstLastRouteSummary(scheduleType = TRANSIT_SCHEDULE_TYPES.first) {
  const summary = readHomeCache(getFirstLastRouteCacheKey(scheduleType), null);
  return summary?.cacheVersion === 2 && summary.scheduleType === scheduleType
    ? summary
    : null;
}

function writeCachedFirstLastRouteSummary(summary, scheduleType = TRANSIT_SCHEDULE_TYPES.first) {
  if (summary) {
    writeHomeCache(getFirstLastRouteCacheKey(scheduleType), {
      ...summary,
      cacheVersion: 2,
      scheduleType,
    });
  }

  return summary
    ? {
        ...summary,
        cacheVersion: 2,
        scheduleType,
      }
    : summary;
}

function clearCachedFirstLastRouteSummary(scheduleType = TRANSIT_SCHEDULE_TYPES.first) {
  removeHomeCache(getFirstLastRouteCacheKey(scheduleType));
  return null;
}

function findTransitNotificationById(notifications, notificationId) {
  if (notificationId === undefined || notificationId === null || notificationId === "") {
    return null;
  }

  return notifications.find(
    (notification) =>
      String(notification.notificationId) === String(notificationId),
  ) ?? null;
}

export function HomeScreen({
  backHandlingEnabled = true,
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
  const [activeFirstLastScheduleType, setActiveFirstLastScheduleType] =
    useState(TRANSIT_SCHEDULE_TYPES.first);
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
  const [scheduleAlarmInitialValues, setScheduleAlarmInitialValues] =
    useState(null);
  const [isGarageDepartureAddVisible, setIsGarageDepartureAddVisible] =
    useState(false);
  const [editingCustomAlarm, setEditingCustomAlarm] = useState(null);
  const [currentAddressLabel, setCurrentAddressLabel] = useState("");
  const [firstLastRouteSummaries, setFirstLastRouteSummaries] = useState(() => ({
    [TRANSIT_SCHEDULE_TYPES.first]: readCachedFirstLastRouteSummary(TRANSIT_SCHEDULE_TYPES.first),
    [TRANSIT_SCHEDULE_TYPES.last]: readCachedFirstLastRouteSummary(TRANSIT_SCHEDULE_TYPES.last),
  }));
  const firstLastRouteSummary = firstLastRouteSummaries[activeFirstLastScheduleType] ?? null;
  const customAlarmRefreshKey = CUSTOM_ALARM_REFRESH_KEY;

  useEffect(() => {
    let isActive = true;

    readHomeCacheAsync(getFirstLastRouteCacheKey(activeFirstLastScheduleType), null).then((cachedSummary) => {
      if (isActive) {
        const summary = readCachedFirstLastRouteSummary(activeFirstLastScheduleType) ??
          (cachedSummary?.cacheVersion === 2 &&
          cachedSummary.scheduleType === activeFirstLastScheduleType
            ? cachedSummary
            : null);
        setFirstLastRouteSummaries((current) => ({
          ...current,
          [activeFirstLastScheduleType]: summary,
        }));
      }
    });

    return () => {
      isActive = false;
    };
  }, [activeFirstLastScheduleType]);

  const loadFirstLastTransitNotifications = useCallback(async ({
    scheduleType = activeFirstLastScheduleType,
    forceRefresh = false,
    signal,
  } = {}) => {
    const notifications = await getTransitNotifications({ scheduleType, forceRefresh, signal });

    if (signal?.aborted) return;

    const cached = readCachedFirstLastRouteSummary(scheduleType);
    const selectedNotification =
      findTransitNotificationById(notifications, cached?.notificationId) ??
      notifications.find((notification) => notification.isActive) ??
      notifications[0] ??
      null;

    if (selectedNotification) {
      const summary = createFirstLastRouteSummaryFromNotification(selectedNotification);
      writeCachedFirstLastRouteSummary(summary, scheduleType);
      setFirstLastRouteSummaries((current) => ({ ...current, [scheduleType]: summary }));
    } else {
      setFirstLastRouteSummaries((current) => ({ ...current, [scheduleType]: cached }));
    }
  }, [activeFirstLastScheduleType]);

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

  useEffect(() => {
    const controller = new AbortController();

    loadFirstLastTransitNotifications({
      scheduleType: activeFirstLastScheduleType,
      signal: controller.signal,
    }).catch((error) => {
      if (error?.name !== "AbortError") {
        console.warn("첫막차 경로 조회 실패:", error?.code ?? error?.message);
      }
    });

    return () => {
      controller.abort();
    };
  }, [activeFirstLastScheduleType, loadFirstLastTransitNotifications]);

  useEffect(() => {
    let controller;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      controller?.abort();
      controller = new AbortController();
      loadFirstLastTransitNotifications({
        scheduleType: activeFirstLastScheduleType,
        forceRefresh: true,
        signal: controller.signal,
      }).catch((error) => {
        if (error?.name !== "AbortError") {
          console.warn("첫차·막차 경로 갱신 실패:", error?.code ?? error?.message);
        }
      });
    });

    return () => {
      controller?.abort();
      subscription.remove();
    };
  }, [activeFirstLastScheduleType, loadFirstLastTransitNotifications]);

  const saveFirstLastRoute = useCallback(async (route, places) => {
    const scheduleType = activeFirstLastScheduleType;
    const originPlace = places?.originPlace ?? places?.origin;
    const destinationPlace = places?.destinationPlace ?? places?.destination;
    const estimatedDepartureTimestamp = parseEstimatedDepartureAt(route?.estimatedDepartureAt);
    const routeSummary = createFirstLastRouteSummary(route, {
      ...places,
      ...(estimatedDepartureTimestamp !== undefined
        ? { departureTimestamp: estimatedDepartureTimestamp }
        : {}),
    });
    const summary = {
      ...routeSummary,
      originPlace,
      destinationPlace,
      originAddress: getPlaceAddress(originPlace),
      destinationAddress: getPlaceAddress(destinationPlace),
      estimatedDepartureAt: route?.estimatedDepartureAt,
      estimatedDepartureTimestamp,
      departureTime: formatSeoulTime(estimatedDepartureTimestamp) ?? routeSummary.departureTime,
      arrivalTime: formatSeoulTime(
        estimatedDepartureTimestamp + routeSummary.totalDurationMinutes * 60000,
      ) ?? routeSummary.arrivalTime,
      remainingMinutes: estimatedDepartureTimestamp !== undefined
        ? Math.max(0, Math.ceil((estimatedDepartureTimestamp - Date.now()) / 60000))
        : routeSummary.remainingMinutes,
      scheduleType,
    };

    try {
      const notificationResponse = await createTransitNotification({
        payload: createTransitNotificationPayload(route, summary, scheduleType),
      });
      const notificationId = getCreatedNotificationId(notificationResponse);

      const savedSummary = writeCachedFirstLastRouteSummary(
        notificationId !== undefined && notificationId !== null
          ? { ...summary, notificationId }
          : summary,
        scheduleType,
      );
      setFirstLastRouteSummaries((current) => ({
        ...current,
        [scheduleType]: savedSummary,
      }));
    } catch (error) {
      console.warn("첫막차 경로 등록 실패:", error?.code ?? error?.message);
      throw error;
    }
  }, [activeFirstLastScheduleType]);

  const handleFirstLastRouteConfigured = useCallback(async (route, places) => {
    await saveFirstLastRoute(route, places);
    blurActiveElement();
    setIsScheduleAlarmAddVisible(false);
    setScheduleAlarmInitialStep("form");
    setScheduleAlarmInitialValues(null);
  }, [saveFirstLastRoute]);

  const handleScheduleAlarmSaved = useCallback(() => {
    blurActiveElement();
    setIsScheduleAlarmAddVisible(false);
    setScheduleAlarmInitialStep("form");
    setScheduleAlarmInitialValues(null);
    setActiveTab("home");
    setActiveHomeTab("customAlarm");
  }, []);

  const handleTabPress = useCallback((tabKey) => {
    blurActiveElement();
    setIsAddressManagerVisible(false);
    setIsRouteDetailVisible(false);
    setFirstLastRouteSetupStep(null);
    setIsScheduleAlarmAddVisible(false);
    setScheduleAlarmInitialStep("form");
    setScheduleAlarmInitialValues(null);
    setIsGarageDepartureAddVisible(false);
    setEditingCustomAlarm(null);

    if (onTabPress?.(tabKey)) {
      return;
    }

    setActiveTab(tabKey);
  }, [onTabPress]);

  const dashboardAddressLabel = currentAddressLabel || "주소 등록하기";

  const handleAddressPress = useCallback(() => {
    blurActiveElement();
    setIsAddressManagerVisible(true);
  }, []);

  const handleGarageDepartureAddPress = useCallback(() => {
    blurActiveElement();
    setIsGarageDepartureAddVisible(true);
  }, []);

  const handleMyPagePress = useCallback(() => {
    handleTabPress("myPage");
  }, [handleTabPress]);

  const handleRouteDetailPress = useCallback(() => {
    blurActiveElement();
    setIsRouteDetailVisible(true);
  }, []);

  const handleRouteSetupPress = useCallback(() => {
    blurActiveElement();
    setIsScheduleAlarmAddVisible(true);
    setScheduleAlarmInitialStep("routeSetup");
    setScheduleAlarmInitialValues({
      routePlaces: getFirstLastRouteSetupPlaces(firstLastRouteSummary),
    });
  }, [firstLastRouteSummary]);

  const handleScheduleAlarmAddPress = useCallback(() => {
    blurActiveElement();
    setIsScheduleAlarmAddVisible(true);
    setScheduleAlarmInitialStep("form");
    setScheduleAlarmInitialValues(null);
  }, []);

  const handleGarageAlarmEditPress = useCallback((alarm) => {
    blurActiveElement();
    setEditingCustomAlarm({ type: "garage", alarm });
  }, []);

  const handleScheduleAlarmEditPress = useCallback((alarm) => {
    blurActiveElement();
    setEditingCustomAlarm({ type: "schedule", alarm });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android" || !backHandlingEnabled) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (activeTab === "myPage") {
          handleTabPress("home");
          return true;
        }

        if (activeTab !== "home") {
          return false;
        }

        if (isAddressManagerVisible) {
          blurActiveElement();
          setIsAddressManagerVisible(false);
          return true;
        }

        if (isGarageDepartureAddVisible) {
          blurActiveElement();
          setIsGarageDepartureAddVisible(false);
          return true;
        }

        if (isScheduleAlarmAddVisible) {
          blurActiveElement();
          setIsScheduleAlarmAddVisible(false);
          setScheduleAlarmInitialStep("form");
          setScheduleAlarmInitialValues(null);
          return true;
        }

        if (firstLastRouteSetupStep === "result") {
          blurActiveElement();
          setFirstLastRouteSetupStep("map");
          return true;
        }

        if (firstLastRouteSetupStep === "map") {
          blurActiveElement();
          setFirstLastRouteSetupStep(null);
          return true;
        }

        if (editingCustomAlarm) {
          blurActiveElement();
          setEditingCustomAlarm(null);
          return true;
        }

        if (isRouteDetailVisible) {
          blurActiveElement();
          setIsRouteDetailVisible(false);
          return true;
        }

        return false;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [
    activeTab,
    backHandlingEnabled,
    editingCustomAlarm,
    firstLastRouteSetupStep,
    handleTabPress,
    isAddressManagerVisible,
    isGarageDepartureAddVisible,
    isRouteDetailVisible,
    isScheduleAlarmAddVisible,
  ]);

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
                initialValues={scheduleAlarmInitialValues}
                scheduleType={
                  scheduleAlarmInitialStep === "routeSetup"
                    ? activeFirstLastScheduleType
                    : "NORMAL"
                }
                mapTitle={
                  scheduleAlarmInitialStep === "routeSetup"
                    ? "경로 재설정"
                    : "알림 추가"
                }
                onBackPress={() => {
                  blurActiveElement();
                  setIsScheduleAlarmAddVisible(false);
                  setScheduleAlarmInitialStep("form");
                  setScheduleAlarmInitialValues(null);
                }}
                onSaveComplete={handleScheduleAlarmSaved}
                onRouteConfigured={
                  scheduleAlarmInitialStep === "routeSetup"
                    ? handleFirstLastRouteConfigured
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
                scheduleType={activeFirstLastScheduleType}
                onBackPress={() => {
                  blurActiveElement();
                  setFirstLastRouteSetupStep("map");
                }}
                onRouteSelect={async (route, places) => {
                  await saveFirstLastRoute(route, places);
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
                onResetRoutePress={(initialValues) => {
                  blurActiveElement();
                  setEditingCustomAlarm(null);
                  setIsScheduleAlarmAddVisible(true);
                  setScheduleAlarmInitialStep("form");
                  setScheduleAlarmInitialValues(initialValues ?? null);
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
                notificationId={firstLastRouteSummary?.notificationId}
                routeSummary={firstLastRouteSummary}
                onBackPress={() => {
                  blurActiveElement();
                  setIsRouteDetailVisible(false);
                }}
              />
            ) : (
              <HomeDashboard
                activeHomeTab={activeHomeTab}
                addressLabel={dashboardAddressLabel}
                notificationCount={notificationCount}
                customAlarmRefreshKey={customAlarmRefreshKey}
                onAddressPress={handleAddressPress}
                onBellPress={onOpenNotifications}
                onGarageDepartureAddPress={handleGarageDepartureAddPress}
                onHomeTabPress={setActiveHomeTab}
                activeFirstLastScheduleType={activeFirstLastScheduleType}
                onFirstLastScheduleTypeChange={setActiveFirstLastScheduleType}
                onMyPagePress={handleMyPagePress}
                onRouteDetailPress={handleRouteDetailPress}
                onRouteSetupPress={handleRouteSetupPress}
                firstLastRouteSummary={firstLastRouteSummary}
                onScheduleAlarmAddPress={handleScheduleAlarmAddPress}
                onGarageAlarmEditPress={handleGarageAlarmEditPress}
                onScheduleAlarmEditPress={handleScheduleAlarmEditPress}
              />
            )
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const HomeDashboard = React.memo(function HomeDashboard({
  activeHomeTab,
  activeFirstLastScheduleType,
  addressLabel,
  customAlarmRefreshKey,
  notificationCount,
  onAddressPress,
  onBellPress,
  onGarageDepartureAddPress,
  onGarageAlarmEditPress,
  onFirstLastScheduleTypeChange,
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
          refreshKey={customAlarmRefreshKey}
          onGarageDepartureAddPress={onGarageDepartureAddPress}
          onGarageAlarmEditPress={onGarageAlarmEditPress}
          onScheduleAlarmAddPress={onScheduleAlarmAddPress}
          onScheduleAlarmEditPress={onScheduleAlarmEditPress}
        />
      ) : (
        <FirstLastRouteScreen
          activeScheduleType={activeFirstLastScheduleType}
          onScheduleTypeChange={onFirstLastScheduleTypeChange}
          onRouteDetailPress={onRouteDetailPress}
          onRouteSetupPress={onRouteSetupPress}
          routeSummary={firstLastRouteSummary}
        />
      )}
    </>
  );
});

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
