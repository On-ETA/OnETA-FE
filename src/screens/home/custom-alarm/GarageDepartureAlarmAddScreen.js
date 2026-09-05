import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Header } from "../../../components";
import { colors, typography } from "../../../theme";

const GARAGE_BUS_RESULTS = [
  {
    id: "147-1",
    interval: "15분",
    route: "망원유수지 - 신촌역",
    directions: [
      {
        id: "sinchon",
        title: "신촌역 방면",
        description: "망원유수지 정류장에서 출고 시 1회 알림",
      },
      {
        id: "mangwon",
        title: "망원유수지 방면",
        description: "신촌역 정류장에서 출고 시 1회 알림",
      },
      {
        id: "hapjeong",
        title: "합정역 방면",
        description: "신촌역 정류장에서 출고 시 1회 알림",
      },
    ],
  },
  {
    id: "147-2",
    interval: "15분",
    route: "망원유수지 - 신촌역",
    directions: [
      {
        id: "sinchon",
        title: "신촌역 방면",
        description: "망원유수지 정류장에서 출고 시 1회 알림",
      },
      {
        id: "mangwon",
        title: "망원유수지 방면",
        description: "신촌역 정류장에서 출고 시 1회 알림",
      },
      {
        id: "hongdae",
        title: "홍대입구역 방면",
        description: "망원유수지 정류장에서 출고 시 1회 알림",
      },
    ],
  },
  {
    id: "147-3",
    interval: "12분",
    route: "월드컵경기장 - 한성대입구",
    directions: [
      {
        id: "hansung",
        title: "한성대입구 방면",
        description: "월드컵경기장 정류장에서 출고 시 1회 알림",
      },
      {
        id: "stadium",
        title: "월드컵경기장 방면",
        description: "한성대입구 정류장에서 출고 시 1회 알림",
      },
      {
        id: "cityhall",
        title: "시청 방면",
        description: "월드컵경기장 정류장에서 출고 시 1회 알림",
      },
    ],
  },
];

export function GarageDepartureAlarmAddScreen({ onBackPress }) {
  const [selectedBus, setSelectedBus] = useState(null);
  const [selectedDirectionId, setSelectedDirectionId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const isDirectionStep = Boolean(selectedBus);
  const trimmedSearchText = searchText.trim();
  const hasSearchText = trimmedSearchText.length > 0;
  const busResults = useMemo(
    () =>
      hasSearchText
        ? GARAGE_BUS_RESULTS.map((result) => ({
            ...result,
            name: `${trimmedSearchText}번`,
          }))
        : [],
    [hasSearchText, trimmedSearchText],
  );
  const selectedDirection = selectedBus?.directions.find(
    (direction) => direction.id === selectedDirectionId,
  );

  const handleBackPress = () => {
    if (isDirectionStep) {
      setSelectedBus(null);
      setSelectedDirectionId(null);
      return;
    }

    onBackPress?.();
  };

  const handleAlarmSubmit = () => {
    // TODO: POST /home/custom-alarm/garage-departure
    // body: { busId: selectedBus.id, directionId: selectedDirection.id }
    if (selectedBus && selectedDirection) {
      onBackPress?.();
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

          {busResults.length > 0 ? (
            <ScrollView
              contentContainerStyle={styles.resultList}
              showsVerticalScrollIndicator={false}
            >
              {busResults.map((bus, index) => (
                <Pressable
                  accessibilityRole="button"
                  key={bus.id}
                  onPress={() => {
                    setSelectedBus(bus);
                    setSelectedDirectionId(null);
                  }}
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
            </ScrollView>
          ) : null}
        </View>
      )}
    </View>
  );
}

function BusDirectionStep({
  bus,
  onChangeBus,
  onDirectionPress,
  onSubmit,
  selectedDirectionId,
}) {
  const canSubmit = Boolean(selectedDirectionId);

  return (
    <View style={styles.directionStep}>
      <View style={styles.directionContent}>
        <View style={styles.selectedBusHeader}>
          <View style={styles.selectedBusTitleRow}>
            <BusIcon />
            <View style={styles.selectedBusTextGroup}>
              <Text style={styles.selectedBusName}>{bus.name}</Text>
              <Text style={styles.selectedBusDescription}>
                배차 간격 {bus.interval} · {bus.route}
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
            알림 설정
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
