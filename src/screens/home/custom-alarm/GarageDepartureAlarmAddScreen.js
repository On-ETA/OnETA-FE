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

import BigBusAsset from "../../../../assets/images/bigbus.svg";
import SearchAsset from "../../../../assets/images/search.svg";
import ClearAsset from "../../../../assets/images/x.svg";
import { Header } from "../../../components";
import {
  getBusRouteDirections,
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
              showsVerticalScrollIndicator
            >
              {busResults.map((bus) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={loadingDirectionRouteId === (bus.routeId ?? bus.id)}
                  key={bus.id}
                  onPress={() => handleBusPress(bus)}
                  style={[
                    styles.resultItem,
                    loadingDirectionRouteId === (bus.routeId ?? bus.id) &&
                      styles.resultItemDisabled,
                  ]}
                >
                  <View style={styles.resultTitleRow}>
                    <BusIcon />
                    <Text style={styles.resultTitle}>{bus.name}</Text>
                  </View>
                  <Text style={styles.resultDescription}>
                    {formatBusInterval(bus.interval)}
                    {bus.route ? ` · ${bus.route}` : ""}
                  </Text>
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
  isSubmitting,
  onChangeBus,
  onDirectionPress,
  onSubmit,
  selectedDirectionId,
}) {
  const canSubmit = Boolean(selectedDirectionId) && !isSubmitting;

  return (
    <View style={styles.directionStep}>
      <View style={styles.directionContent}>
        <View style={styles.selectedBusHeader}>
          <View style={styles.selectedBusTextGroup}>
            <View style={styles.selectedBusTitleRow}>
              <BusIcon />
              <Text style={styles.selectedBusName}>{bus.name}</Text>
            </View>
            <Text style={styles.selectedBusDescription}>
              {formatBusInterval(bus.interval)}
              {bus.route ? ` · ${bus.route}` : ""}
            </Text>
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
          showsVerticalScrollIndicator
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
            알림은 1회 발송 후 자동으로 꺼지니 필요할 때 다시 켜주세요.
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
  return <SearchAsset height={20} width={20} />;
}

function ClearIcon() {
  return <ClearAsset height={20} width={20} />;
}

function BusIcon() {
  return (
    <View style={styles.busIconCircle}>
      <BigBusAsset height={10} width={9} />
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
    paddingTop: 24,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
  },
  heading: {
    fontFamily: "SUIT",
    fontSize: 20,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 20,
    letterSpacing: -0.2,
    color: colors.gray09,
  },
  searchBox: {
    display: "flex",
    width: 328,
    maxWidth: "100%",
    height: 48,
    marginTop: 20,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
    borderWidth: 1,
    borderColor: colors.gray03,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    minWidth: 0,
    marginHorizontal: 8,
    fontFamily: "SUIT",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 22.4,
    letterSpacing: -0.16,
    textAlign: "left",
    color: colors.gray09,
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
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  resultList: {
    width: 328,
    maxWidth: "100%",
    marginTop: 8,
    paddingBottom: 32,
  },
  searchStateText: {
    marginTop: 24,
    ...typography.body03M,
    color: colors.gray07,
  },
  resultItem: {
    display: "flex",
    width: 328,
    maxWidth: "100%",
    height: 72,
    paddingVertical: 16,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray03,
  },
  resultItemDisabled: {
    opacity: 0.6,
  },
  busIconCircle: {
    display: "flex",
    width: 20,
    height: 20,
    gap: 12.5,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 50,
    backgroundColor: colors.main,
  },
  resultTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  resultTitle: {
    fontFamily: "SUIT",
    fontSize: 18,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 20,
    letterSpacing: -0.2,
    color: colors.gray09,
  },
  resultDescription: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 16.8,
    letterSpacing: -0.12,
    color: colors.gray07,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  selectedBusTextGroup: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  selectedBusName: {
    fontFamily: "SUIT",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    color: colors.gray09,
  },
  selectedBusDescription: {
    marginTop: 5,
    fontFamily: "SUIT",
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.2,
    letterSpacing: -0.12,
    color: colors.gray07,
  },
  changeBusButton: {
    display: "flex",
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.gray05,
    borderRadius: 100,
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
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  directionCard: {
    display: "flex",
    padding: 16,
    flexDirection: "column",
    alignItems: "flex-start",
    alignSelf: "stretch",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.gray03,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  directionCardSelected: {
    borderColor: colors.main,
    backgroundColor: colors.sub,
  },
  directionTitle: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 22.4,
    letterSpacing: -0.16,
    color: colors.gray08,
  },
  directionDescription: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 18.2,
    letterSpacing: -0.13,
    color: colors.gray06,
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
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.2,
    letterSpacing: -0.12,
    color: colors.gray07,
  },
  alarmButton: {
    display: "flex",
    height: 54,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    alignSelf: "stretch",
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
