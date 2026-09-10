import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Header } from "../../../components";
import { searchBusRoutes } from "../../../api/busRoutes";
import { colors, typography } from "../../../theme";

const GARAGE_BUS_RESULTS = [
  {
    id: "147-1",
    interval: "15분",
    route: "망원유수지 - 신촌역",
  },
  {
    id: "147-2",
    interval: "15분",
    route: "망원유수지 - 신촌역",
  },
];

export function GarageDepartureAlarmAddScreen({ onBackPress }) {
  const [searchText, setSearchText] = useState("");
  const [serverBusResults, setServerBusResults] = useState([]);
  const trimmedSearchText = searchText.trim();
  const hasSearchText = trimmedSearchText.length > 0;
  const busResults = useMemo(
    () => {
      if (!hasSearchText) {
        return [];
      }

      if (serverBusResults.length > 0) {
        return serverBusResults;
      }

      return GARAGE_BUS_RESULTS.map((result) => ({
        ...result,
        name: `${trimmedSearchText}번`,
      }));
    },
    [hasSearchText, serverBusResults, trimmedSearchText],
  );

  useEffect(() => {
    if (!hasSearchText) {
      setServerBusResults([]);
      return undefined;
    }

    let isActive = true;

    async function loadBusRoutes() {
      try {
        const response = await searchBusRoutes({ keyword: trimmedSearchText });
        const routes = Array.isArray(response?.data) ? response.data : response;

        if (!isActive || !Array.isArray(routes)) {
          return;
        }

        setServerBusResults(
          routes.map((route) => ({
            id: route.id ?? route.routeId ?? route.busRouteId,
            interval: route.interval ?? route.dispatchInterval ?? "-",
            name:
              route.name ??
              route.routeName ??
              route.busNumber ??
              `${trimmedSearchText}번`,
            route:
              route.route ??
              route.description ??
              route.direction ??
              route.stationNames ??
              "",
          })),
        );
      } catch {
        if (isActive) {
          setServerBusResults([]);
        }
      }
    }

    loadBusRoutes();

    return () => {
      isActive = false;
    };
  }, [hasSearchText, trimmedSearchText]);

  return (
    <View style={styles.screen}>
      <Header
        headerStyle={styles.header}
        onBackPress={onBackPress}
        title="차고지 출발 알림 추가"
        titleStyle={styles.headerTitle}
        type="back"
      />

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

        {busResults.length > 0 ? (
          <View style={styles.resultList}>
            {busResults.map((bus, index) => (
              <Pressable
                accessibilityRole="button"
                key={bus.id}
                style={[
                  styles.resultItem,
                  index < busResults.length - 1 && styles.resultItemDivider,
                ]}
              >
                <BusIcon />
                <View style={styles.resultTextGroup}>
                  <Text style={styles.resultTitle}>{bus.name}</Text>
                  <Text style={styles.resultDescription}>
                    배차 간격 {bus.interval} · {bus.route}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
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
});
