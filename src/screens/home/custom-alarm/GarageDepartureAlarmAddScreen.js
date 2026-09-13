import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Header } from "../../../components";
import {
  getBusRouteDirections,
  getBusRouteLocations,
  searchBusRoutes,
} from "../../../api/busRoutes";
import { createDepotNotification } from "../../../api/notifications/depot";
import { colors, typography } from "../../../theme";

function createDirection({ id, title, departurePoint }) {
  return {
    id,
    title,
    description: `${departurePoint} 정류장에서 출고 시 1회 알림`,
  };
}

function normalizeGarageBusResult(route) {
  const routeId = route.routeId;
  const routeName = route.routeName || route.routeNm || "";
  const startPoint = route.startPoint || "기점";
  const endPoint = route.endPoint || "종점";

  return {
    id: routeId,
    routeId,
    name: `${routeName}번`,
    interval: route.term ? `${route.term}분` : "정보 없음",
    route: `${startPoint} - ${endPoint}`,
    directions: [
      createDirection({
        id: `${routeId}-to-end`,
        title: `${endPoint} 방면`,
        departurePoint: startPoint,
      }),
      createDirection({
        id: `${routeId}-to-start`,
        title: `${startPoint} 방면`,
        departurePoint: endPoint,
      }),
    ],
  };
}

function formatBusInterval(interval) {
  if (interval === undefined || interval === null || interval === "") {
    return "배차 간격 정보 없음";
  }

  return interval === "-" ? "배차 간격 정보 없음" : `배차 간격 ${interval}분`;
}

function getDirectionDepartureInfo(direction, locations) {
  if (!locations) {
    return "";
  }

  const directionType = direction?.type ?? direction?.id;
  const isDepotDirection = directionType === "DEPOT";
  const departed = isDepotDirection
    ? locations.depotDeparted
    : locations.turnaroundDeparted;
  const busNo = isDepotDirection
    ? locations.depotDepartedBusNo
    : locations.turnaroundDepartedBusNo;

  if (!departed) {
    return "아직 출발 정보가 없습니다.";
  }

  return busNo ? `최근 출발 차량 ${busNo}` : "최근 출발 차량이 있습니다.";
}

function getLocationSummary(locations) {
  if (!locations) {
    return "";
  }

  const activeBusCount = locations.activeBuses.length;
  const atStopCount = locations.activeBuses.filter((bus) => bus.atStop).length;

  return `현재 운행 중 ${activeBusCount}대 · 정류장 정차 ${atStopCount}대`;
}

function getBusNumber(bus) {
  return String(bus?.busNumber ?? bus?.routeNumber ?? bus?.name ?? "")
    .replace(/번$/, "")
    .trim();
}

function getDirectionType(direction) {
  return direction?.type ?? direction?.direction ?? direction?.id ?? "";
}

function getDirectionTitleName(direction) {
  return String(direction?.title ?? "")
    .replace(/\s*방면$/, "")
    .trim();
}

function getDirectionName(bus, direction) {
  const directionType = getDirectionType(direction);
  const titleName = getDirectionTitleName(direction);

  if (directionType === "DEPOT") {
    return (
      bus?.depotName ||
      direction?.name ||
      direction?.directionName ||
      titleName
    );
  }

  if (directionType === "TURNAROUND") {
    return (
      bus?.turnaroundName ||
      direction?.name ||
      direction?.directionName ||
      titleName
    );
  }

  return direction?.name || direction?.directionName || titleName;
}

export function GarageDepartureAlarmAddScreen({ onBackPress }) {
  const [selectedBus, setSelectedBus] = useState(null);
  const [selectedDirectionId, setSelectedDirectionId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [busResults, setBusResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchErrorMessage, setSearchErrorMessage] = useState("");
  const [loadingDirectionRouteId, setLoadingDirectionRouteId] = useState(null);
  const [busLocations, setBusLocations] = useState(null);
  const [isLoadingBusLocations, setIsLoadingBusLocations] = useState(false);
  const [busLocationError, setBusLocationError] = useState("");
  const [isSubmittingAlarm, setIsSubmittingAlarm] = useState(false);
  const isDirectionStep = Boolean(selectedBus);
  const trimmedSearchText = searchText.trim();
  const hasSearchText = trimmedSearchText.length > 0;
  const selectedDirection = selectedBus?.directions.find(
    (direction) => direction.id === selectedDirectionId,
  );

  useEffect(() => {
    if (!hasSearchText) {
      setBusResults([]);
      setIsSearching(false);
      setSearchErrorMessage("");
      return undefined;
    }

    const controller = new AbortController();
    let isActive = true;
    const debounceId = setTimeout(async () => {
      setIsSearching(true);
      setSearchErrorMessage("");

      try {
        const response = await searchBusRoutes({
          query: trimmedSearchText,
          signal: controller.signal,
        });

        if (!isActive) {
          return;
        }

        setBusResults(Array.isArray(response) ? response : []);
      } catch (error) {
        if (!isActive || error?.name === "AbortError") {
          return;
        }

        setBusResults([]);
        setSearchErrorMessage(
          error?.message || "버스 검색에 실패했습니다.",
        );
      } finally {
        if (isActive) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      isActive = false;
      clearTimeout(debounceId);
      controller.abort();
    };
  }, [hasSearchText, trimmedSearchText]);

  const handleBackPress = () => {
    if (isDirectionStep) {
      setSelectedBus(null);
      setSelectedDirectionId(null);
      return;
    }

    onBackPress?.();
  };

  const handleAlarmSubmit = async () => {
    if (!selectedBus || !selectedDirection || isSubmittingAlarm) {
      return;
    }

    const routeId = selectedBus.routeId ?? selectedBus.id;
    const busNumber = getBusNumber(selectedBus);
    const direction = getDirectionType(selectedDirection);
    const directionName = getDirectionName(selectedBus, selectedDirection);

    if (!routeId || !busNumber || !direction || !directionName) {
      Alert.alert(
        "알림 등록 실패",
        "버스 알림 등록에 필요한 정보를 확인하지 못했습니다.",
      );
      return;
    }

    setIsSubmittingAlarm(true);

    try {
      await createDepotNotification({
        payload: {
          routeId,
          busNumber,
          direction,
          directionName,
        },
      });

      onBackPress?.();
    } catch (error) {
      Alert.alert(
        "알림 등록 실패",
        error?.message ?? "차고지 출발 알림 등록에 실패했습니다.",
      );
    } finally {
      setIsSubmittingAlarm(false);
    }
  };

  const handleBusPress = async (bus) => {
    const routeId = bus.routeId ?? bus.id;

    if (!routeId || loadingDirectionRouteId === routeId) {
      return;
    }

    setLoadingDirectionRouteId(routeId);

    try {
      const busWithDirections = await getBusRouteDirections({ routeId });

      setSelectedBus({
        ...bus,
        ...busWithDirections,
        id: bus.id,
        routeId,
        name: busWithDirections.name || bus.name,
        interval: busWithDirections.interval || bus.interval,
        route: busWithDirections.route || bus.route,
      });
      setSelectedDirectionId(null);
    } catch (error) {
      Alert.alert(
        "버스 방향 조회 실패",
        error?.message ?? "버스 방향 정보를 불러오지 못했습니다.",
      );
    } finally {
      setLoadingDirectionRouteId(null);
    }
  };

  useEffect(() => {
    const routeId = selectedBus?.routeId ?? selectedBus?.id;

    if (!routeId) {
      setBusLocations(null);
      setBusLocationError("");
      setIsLoadingBusLocations(false);
      return undefined;
    }

    let isActive = true;
    const controller = new AbortController();

    async function loadBusLocations() {
      setIsLoadingBusLocations(true);
      setBusLocationError("");

      try {
        const locations = await getBusRouteLocations({
          routeId,
          signal: controller.signal,
        });

        if (isActive) {
          setBusLocations(locations);
        }
      } catch (error) {
        if (isActive) {
          setBusLocations(null);
          setBusLocationError(
            error?.message ?? "버스 위치 정보를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingBusLocations(false);
        }
      }
    }

    loadBusLocations();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [selectedBus?.id, selectedBus?.routeId]);

  return (
    <View style={styles.screen}>
      <Header
        headerStyle={styles.header}
        onBackPress={handleBackPress}
        title="알림 추가"
        titleStyle={styles.headerTitle}
        type="back"
      />

      {isDirectionStep ? (
        <BusDirectionStep
          bus={selectedBus}
          busLocationError={busLocationError}
          busLocations={busLocations}
          isLoadingBusLocations={isLoadingBusLocations}
          isSubmitting={isSubmittingAlarm}
          onChangeBus={() => {
            setSelectedBus(null);
            setSelectedDirectionId(null);
          }}
          onDirectionPress={setSelectedDirectionId}
          onSubmit={handleAlarmSubmit}
          selectedDirectionId={selectedDirectionId}
        />
      ) : (
        <View style={styles.content}>
          <Text style={styles.heading}>알림 받을 버스를 검색해주세요</Text>

          <View style={styles.searchBox}>
            <SearchIcon />
            <TextInput
              autoCapitalize="none"
              cursorColor={colors.black}
              onChangeText={setSearchText}
              placeholder="버스 이름으로 검색"
              placeholderTextColor={colors.gray06}
              selectionColor={colors.black}
              style={styles.searchInput}
              underlineColorAndroid="transparent"
              value={searchText}
            />
            {hasSearchText ? (
              <Pressable
                accessibilityLabel="검색어 지우기"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setSearchText("")}
                style={styles.clearButton}
              >
                <ClearIcon />
              </Pressable>
            ) : null}
          </View>

          {isSearching ? (
            <Text style={styles.searchStateText}>검색 중입니다.</Text>
          ) : searchErrorMessage ? (
            <Text style={styles.searchStateText}>{searchErrorMessage}</Text>
          ) : hasSearchText && busResults.length === 0 ? (
            <Text style={styles.searchStateText}>검색 결과가 없습니다.</Text>
          ) : null}

          {busResults.length > 0 ? (
            <ScrollView
              contentContainerStyle={styles.resultList}
              showsVerticalScrollIndicator={false}
            >
              {busResults.map((bus, index) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={loadingDirectionRouteId === (bus.routeId ?? bus.id)}
                  key={bus.id}
                  onPress={() => handleBusPress(bus)}
                  style={[
                    styles.resultItem,
                    index < busResults.length - 1 && styles.resultItemDivider,
                    loadingDirectionRouteId === (bus.routeId ?? bus.id) &&
                      styles.resultItemDisabled,
                  ]}
                >
                  <BusIcon />
                  <View style={styles.resultTextGroup}>
                    <Text style={styles.resultTitle}>{bus.name}</Text>
                    <Text style={styles.resultDescription}>
                      {formatBusInterval(bus.interval)}
                      {bus.route ? ` · ${bus.route}` : ""}
                    </Text>
                    {loadingDirectionRouteId === (bus.routeId ?? bus.id) ? (
                      <Text style={styles.resultLoadingText}>
                        방향 정보를 불러오는 중입니다.
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
      )}
    </View>
  );
}

function BusDirectionStep({
  bus,
  busLocationError,
  busLocations,
  isLoadingBusLocations,
  isSubmitting,
  onChangeBus,
  onDirectionPress,
  onSubmit,
  selectedDirectionId,
}) {
  const canSubmit = Boolean(selectedDirectionId) && !isSubmitting;
  const locationSummary = getLocationSummary(busLocations);

  return (
    <View style={styles.directionStep}>
      <View style={styles.directionContent}>
        <View style={styles.selectedBusHeader}>
          <View style={styles.selectedBusTitleRow}>
            <BusIcon />
            <View style={styles.selectedBusTextGroup}>
              <Text style={styles.selectedBusName}>{bus.name}</Text>
              <Text style={styles.selectedBusDescription}>
                {formatBusInterval(bus.interval)}
                {bus.route ? ` · ${bus.route}` : ""}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onChangeBus}
            style={styles.changeBusButton}
          >
            <Text style={styles.changeBusButtonText}>변경</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.directionList}
          showsVerticalScrollIndicator={false}
        >
          {bus.directions.map((direction) => {
            const selected = selectedDirectionId === direction.id;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={direction.id}
                onPress={() => onDirectionPress(direction.id)}
                style={[
                  styles.directionCard,
                  selected && styles.directionCardSelected,
                ]}
              >
                <Text style={styles.directionTitle}>{direction.title}</Text>
                <Text style={styles.directionDescription}>
                  {direction.description}
                </Text>
                {isLoadingBusLocations ? (
                  <Text style={styles.directionMeta}>
                    실시간 위치를 불러오는 중입니다.
                  </Text>
                ) : null}
                {!isLoadingBusLocations && getDirectionDepartureInfo(
                  direction,
                  busLocations,
                ) ? (
                  <Text style={styles.directionMeta}>
                    {getDirectionDepartureInfo(direction, busLocations)}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.directionFooter}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            버스가 차고지에서 출발할 때 알려드릴게요.
          </Text>
          <Text style={styles.infoText}>
            {isLoadingBusLocations
              ? "실시간 버스 위치를 확인하고 있습니다."
              : busLocationError || locationSummary ||
                "알림은 1회 발송 후 자동으로 꺼지니 필요할 때 다시 켜주세요."}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={onSubmit}
          style={[styles.alarmButton, canSubmit && styles.alarmButtonActive]}
        >
          <Text
            style={[
              styles.alarmButtonText,
              canSubmit && styles.alarmButtonTextActive,
            ]}
          >
            {isSubmitting ? "등록 중" : "알림 설정"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function SearchIcon() {
  return (
    <View pointerEvents="none" style={styles.searchIcon}>
      <View style={styles.searchIconCircle} />
      <View style={styles.searchIconHandle} />
    </View>
  );
}

function ClearIcon() {
  return (
    <View pointerEvents="none" style={styles.clearIcon}>
      <View style={[styles.clearIconLine, styles.clearIconLineA]} />
      <View style={[styles.clearIconLine, styles.clearIconLineB]} />
    </View>
  );
}

function BusIcon() {
  return (
    <View style={styles.busIconCircle}>
      <View style={styles.busBody}>
        <View style={styles.busWindowRow}>
          <View style={styles.busWindow} />
          <View style={styles.busWindow} />
        </View>
        <View style={styles.busFront} />
        <View style={styles.busWheelRow}>
          <View style={styles.busWheel} />
          <View style={styles.busWheel} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    borderBottomColor: colors.gray04,
  },
  headerTitle: {
    ...typography.head01Sb,
    color: colors.black,
  },
  content: {
    flex: 1,
    paddingTop: 36,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
  },
  heading: {
    fontFamily: "SUIT",
    fontSize: 22,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 30.8,
    letterSpacing: -0.22,
    color: colors.black,
  },
  searchBox: {
    height: 82,
    marginTop: 28,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  searchIcon: {
    width: 24,
    height: 24,
    marginRight: 14,
  },
  searchIconCircle: {
    position: "absolute",
    top: 3,
    left: 3,
    width: 14,
    height: 14,
    borderWidth: 2,
    borderColor: colors.gray05,
    borderRadius: 7,
  },
  searchIconHandle: {
    position: "absolute",
    right: 3,
    bottom: 3,
    width: 9,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.gray05,
    transform: [{ rotate: "45deg" }],
  },
  searchInput: {
    flex: 1,
    height: "100%",
    minWidth: 0,
    ...typography.body01Sb,
    color: colors.black,
    ...Platform.select({
      web: {
        outlineColor: "transparent",
        outlineStyle: "none",
        outlineWidth: 0,
        boxShadow: "none",
      },
    }),
  },
  clearButton: {
    width: 32,
    height: 32,
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  clearIcon: {
    width: 22,
    height: 22,
  },
  clearIconLine: {
    position: "absolute",
    top: 10,
    left: 1,
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.gray05,
  },
  clearIconLineA: {
    transform: [{ rotate: "45deg" }],
  },
  clearIconLineB: {
    transform: [{ rotate: "-45deg" }],
  },
  resultList: {
    marginTop: 24,
    paddingBottom: 32,
  },
  searchStateText: {
    marginTop: 24,
    ...typography.body03M,
    color: colors.gray07,
  },
  resultItem: {
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
  },
  resultItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray03,
  },
  resultItemDisabled: {
    opacity: 0.6,
  },
  busIconCircle: {
    width: 32,
    height: 32,
    marginRight: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.main,
  },
  busBody: {
    width: 16,
    height: 18,
    alignItems: "center",
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  busWindowRow: {
    width: 12,
    marginTop: 3,
    flexDirection: "row",
    gap: 2,
  },
  busWindow: {
    flex: 1,
    height: 5,
    borderRadius: 1,
    backgroundColor: colors.main,
  },
  busFront: {
    width: 10,
    height: 3,
    marginTop: 2,
    borderRadius: 1.5,
    backgroundColor: colors.main,
  },
  busWheelRow: {
    position: "absolute",
    bottom: 2,
    width: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  busWheel: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.main,
  },
  resultTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    fontFamily: "SUIT",
    fontSize: 20,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 28,
    letterSpacing: -0.2,
    color: colors.gray09,
  },
  resultDescription: {
    marginTop: 4,
    ...typography.body03M,
    color: colors.gray07,
  },
  resultLoadingText: {
    marginTop: 4,
    ...typography.caption01M,
    color: colors.gray06,
  },
  resultStatus: {
    minHeight: 96,
    marginTop: 24,
    justifyContent: "center",
  },
  resultStatusText: {
    ...typography.body03M,
    color: colors.gray06,
  },
  directionStep: {
    flex: 1,
    backgroundColor: colors.white,
  },
  directionContent: {
    flex: 1,
    paddingTop: 32,
    paddingHorizontal: 20,
  },
  selectedBusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedBusTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingRight: 12,
  },
  selectedBusTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  selectedBusName: {
    fontFamily: "SUIT",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    color: colors.gray09,
  },
  selectedBusDescription: {
    marginTop: 4,
    ...typography.body03M,
    color: colors.gray07,
  },
  changeBusButton: {
    height: 34,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray05,
    borderRadius: 17,
    backgroundColor: colors.white,
  },
  changeBusButtonText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16.8,
    color: colors.gray08,
  },
  directionList: {
    paddingTop: 28,
    paddingBottom: 24,
    gap: 12,
  },
  directionCard: {
    minHeight: 110,
    paddingVertical: 24,
    paddingHorizontal: 22,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  directionCardSelected: {
    borderColor: colors.main,
    backgroundColor: colors.sub,
  },
  directionTitle: {
    fontFamily: "SUIT",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 25.2,
    color: colors.gray08,
  },
  directionDescription: {
    marginTop: 9,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray06,
  },
  directionMeta: {
    marginTop: 8,
    ...typography.caption01M,
    color: colors.gray07,
  },
  directionFooter: {
    paddingHorizontal: 20,
    paddingBottom: 34,
    gap: 16,
    backgroundColor: colors.white,
  },
  infoBox: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: colors.gray02,
  },
  infoText: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 22,
    color: colors.gray07,
  },
  alarmButton: {
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.gray05,
  },
  alarmButtonActive: {
    backgroundColor: colors.main,
  },
  alarmButtonText: {
    fontFamily: "SUIT",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 25.2,
    color: colors.gray07,
  },
  alarmButtonTextActive: {
    color: colors.white,
  },
});
