import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import BackIcon from "../../../../assets/images/L.svg";
import { colors } from "../../../theme";

// TODO: API 연동 시 아래 더미 데이터를 교체하세요.
// GET /home/first-last-route/detail
// - timeline: Array<{ type: "walk" | "bus"; minutes: number }>
// - origin: { name: string; address: string; time: string }
// - destination: { name: string; address: string; time: string }
// - steps: Array<
//   | { type: "walk"; distanceText: string; minutes: number }
//   | {
//       type: "bus";
//       routeNumber: string;
//       stopCount: number;
//       minutes: number;
//       boardingStopName: string;
//       boardingTime: string;
//       arrivalStopName: string;
//       arrivalTime: string;
//       viaStops: string[];
//     }
//   >
const routeDetail = {
  timeline: [
    { type: "walk", minutes: 5 },
    { type: "bus", minutes: 4 },
    { type: "walk", minutes: 8 },
  ],
  origin: {
    name: "홍익대학교 서울캠퍼스",
    address: "서울특별시 와우산로 94",
    time: "23:42",
  },
  destination: {
    name: "우리집",
    address: "서울특별시 와우산로 94",
    time: "23:59",
  },
  steps: [
    { type: "walk", distanceText: "도보 339m", minutes: 5 },
    {
      type: "bus",
      routeNumber: "147번",
      stopCount: 3,
      minutes: 4,
      boardingStopName: "홍대정문",
      boardingTime: "23:47",
      arrivalStopName: "도착정류장",
      arrivalTime: "23:51",
      viaStops: ["중간정류장", "중간두번째정류장", "중간세번째정류장"],
    },
    { type: "walk", distanceText: "도보 339m", minutes: 8 },
  ],
};

export function FirstLastRouteDetailScreen({ onBackPress }) {
  return (
    <View style={styles.screen}>
      <View style={styles.topSpacer} />
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onBackPress}
          style={styles.backButton}
        >
          <BackIcon height={24} width={24} />
        </Pressable>
        <Text style={styles.headerTitle}>경로 상세</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TimelineSummary items={routeDetail.timeline} />
        <PlaceRow place={routeDetail.origin} type="origin" />

        <View style={styles.stepsWrap}>
          {routeDetail.steps.map((step, index) =>
            step.type === "walk" ? (
              <WalkStep key={`walk-${index}`} step={step} />
            ) : (
              <BusStep key={`bus-${index}`} step={step} />
            )
          )}
        </View>

        <PlaceRow place={routeDetail.destination} type="destination" />
      </ScrollView>
    </View>
  );
}

function TimelineSummary({ items }) {
  return (
    <View style={styles.timeline}>
      {items.map((item, index) => (
        <View
          key={`${item.type}-${index}`}
          style={[
            styles.timelineSegment,
            item.type === "bus" ? styles.timelineBusSegment : styles.timelineWalkSegment,
          ]}
        >
          {item.type === "walk" ? (
            <View style={styles.timelineIcon}>
              <WalkIcon size={12} />
            </View>
          ) : (
            <View style={[styles.timelineIcon, styles.timelineBusIcon]}>
              <BusIcon size={12} />
            </View>
          )}
          <View style={styles.timelineTextWrap}>
            <Text
              style={[
                styles.timelineText,
                item.type === "bus" && styles.timelineTextOn,
              ]}
            >
              {item.minutes}분
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function PlaceRow({ place, type }) {
  const isDestination = type === "destination";

  return (
    <View style={styles.placeRow}>
      <View style={[styles.placeMarker, isDestination && styles.placeMarkerDark]}>
        <MapPinIcon color={isDestination ? colors.gray08 : colors.main} />
      </View>
      <View style={styles.placeTextGroup}>
        <Text style={styles.placeName}>{place.name}</Text>
        <Text style={styles.placeAddress}>{place.address}</Text>
      </View>
      <Text style={styles.placeTime}>{place.time}</Text>
    </View>
  );
}

function WalkStep({ step }) {
  return (
    <View style={styles.walkStep}>
      <View style={styles.walkStepInner}>
        <View style={styles.walkStepIcon}>
          <WalkIcon color={colors.white} size={13} />
        </View>
        <Text style={styles.walkText}>{step.distanceText}</Text>
        <View style={styles.dottedLine} />
        <Text style={styles.walkMinutes}>{step.minutes}분</Text>
      </View>
    </View>
  );
}

function BusStep({ step }) {
  return (
    <View style={styles.busStep}>
      <View style={styles.busRail}>
        <View style={styles.stopCircleActive}>
          <View style={styles.stopCircleInner} />
        </View>
        <View style={styles.railLine} />
        <View style={styles.stopCircleOff}>
          <View style={styles.stopCircleOffInner} />
        </View>
      </View>

      <View style={styles.busStepContent}>
        <View style={styles.stopHeader}>
          <View style={styles.stopTitleGroup}>
            <Text style={styles.stopName}>{step.boardingStopName}</Text>
            <Text style={styles.stopKind}>승차</Text>
          </View>
          <Text style={styles.stopTime}>{step.boardingTime}</Text>
        </View>

        <View style={styles.busInfoLine}>
          <View style={styles.busBadge}>
            <BusIcon size={13} />
            <Text style={styles.busBadgeText}>{step.routeNumber}</Text>
          </View>
          <Text style={styles.busMoveText}>{step.stopCount}개 정류장 이동</Text>
          <View style={styles.busDottedLine} />
          <Text style={styles.busMinutes}>{step.minutes}분</Text>
        </View>

        <View style={styles.viaStops}>
          {step.viaStops.map((stop) => (
            <Text key={stop} style={styles.viaStopText}>
              {stop}
            </Text>
          ))}
        </View>

        <View style={styles.stopHeader}>
          <View style={styles.stopTitleGroup}>
            <Text style={styles.stopName}>{step.arrivalStopName}</Text>
            <Text style={styles.stopKind}>하차</Text>
          </View>
          <Text style={styles.stopTime}>{step.arrivalTime}</Text>
        </View>
      </View>
    </View>
  );
}

function WalkIcon({ color = colors.white, size = 12 }) {
  return (
    <Svg height={size} viewBox="0 0 12 12" width={size}>
      <Circle cx={6} cy={2.2} fill={color} r={1.4} />
      <Path
        d="M5.4 4.1 3.7 6.1c-.2.2-.2.6.1.8.2.2.6.2.8-.1l.9-1.1.8 1.1-1.3 3c-.1.3 0 .7.3.8.3.1.7 0 .8-.3l1.1-2.5 1.2 1.5c.2.3.6.3.8.1.3-.2.3-.6.1-.8L7.8 6.7 7 4.8l.9.6c.3.2.6.1.8-.1.2-.3.1-.6-.1-.8L7 3.4c-.5-.3-1.1-.1-1.6.7Z"
        fill={color}
      />
    </Svg>
  );
}

function BusIcon({ size = 13 }) {
  return (
    <Svg height={size} viewBox="0 0 16 16" width={size}>
      <Path
        d="M4.2 1.5h7.6c1.1 0 2 .9 2 2v7.4c0 .9-.6 1.7-1.4 1.9v1.1c0 .3-.3.6-.6.6h-.7c-.3 0-.6-.3-.6-.6v-1H5.5v1c0 .3-.3.6-.6.6h-.7c-.3 0-.6-.3-.6-.6v-1.1c-.8-.3-1.4-1-1.4-1.9V3.5c0-1.1.9-2 2-2Zm.4 2.2v3.7h6.8V3.7H4.6Zm1 7.4a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm4.8-1.1a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 0 0-2.2 0Z"
        fill={colors.white}
      />
    </Svg>
  );
}

function MapPinIcon({ color }) {
  return (
    <Svg height={26} viewBox="0 0 24 24" width={26}>
      <Path
        d="M12 2.5c-4.1 0-7.4 3.2-7.4 7.3 0 5.4 7.4 11.7 7.4 11.7s7.4-6.3 7.4-11.7c0-4.1-3.3-7.3-7.4-7.3Z"
        fill={color}
      />
      <Circle cx={12} cy={9.8} fill={colors.white} r={3.1} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.gray01,
  },
  topSpacer: {
    height: 24,
    backgroundColor: colors.gray01,
  },
  header: {
    height: 64,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.gray03,
    backgroundColor: colors.gray01,
  },
  backButton: {
    width: 32,
    height: 32,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "SUIT",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    color: colors.gray08,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 42,
  },
  timeline: {
    height: 18,
    marginHorizontal: 20,
    marginBottom: 30,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: colors.gray04,
  },
  timelineSegment: {
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  timelineWalkSegment: {
    flex: 1,
  },
  timelineBusSegment: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.main,
  },
  timelineIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.gray06,
  },
  timelineBusIcon: {
    backgroundColor: colors.main,
  },
  timelineTextWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineText: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    color: colors.gray07,
  },
  timelineTextOn: {
    color: colors.white,
  },
  placeRow: {
    minHeight: 54,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  placeMarker: {
    width: 26,
    height: 26,
    marginTop: 3,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  placeMarkerDark: {
    opacity: 1,
  },
  placeTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  placeName: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22.4,
    color: colors.gray09,
  },
  placeAddress: {
    marginTop: 2,
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16.8,
    color: colors.gray06,
  },
  placeTime: {
    marginLeft: 10,
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22.4,
    color: colors.gray08,
  },
  stepsWrap: {
    marginTop: 22,
    marginBottom: 24,
  },
  walkStep: {
    height: 54,
    paddingLeft: 68,
    paddingRight: 20,
    justifyContent: "center",
  },
  walkStepInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  walkStepIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.gray06,
  },
  walkText: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18.2,
    color: colors.gray07,
  },
  dottedLine: {
    flex: 1,
    height: 1,
    marginHorizontal: 22,
    borderTopWidth: 2,
    borderStyle: "dotted",
    borderColor: colors.gray05,
  },
  walkMinutes: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18.2,
    color: colors.gray07,
  },
  busStep: {
    minHeight: 172,
    paddingLeft: 28,
    paddingRight: 20,
    flexDirection: "row",
    backgroundColor: colors.gray02,
  },
  busRail: {
    width: 24,
    marginRight: 16,
    alignItems: "center",
  },
  stopCircleActive: {
    width: 20,
    height: 20,
    marginTop: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.sub,
  },
  stopCircleInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.main,
  },
  railLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.main,
  },
  stopCircleOff: {
    width: 20,
    height: 20,
    marginBottom: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.gray04,
  },
  stopCircleOffInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray06,
  },
  busStepContent: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 20,
  },
  stopHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stopTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  stopName: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19.6,
    color: colors.gray09,
  },
  stopKind: {
    marginLeft: 8,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray07,
  },
  stopTime: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18.2,
    color: colors.gray06,
  },
  busInfoLine: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  busBadge: {
    height: 24,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    backgroundColor: colors.main,
  },
  busBadgeText: {
    marginLeft: 4,
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18.2,
    color: colors.white,
  },
  busMoveText: {
    marginLeft: 8,
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18.2,
    color: colors.main,
  },
  busDottedLine: {
    flex: 1,
    height: 1,
    marginHorizontal: 22,
    borderTopWidth: 2,
    borderStyle: "dotted",
    borderColor: "#93E9B7",
  },
  busMinutes: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18.2,
    color: colors.main,
  },
  viaStops: {
    marginTop: 10,
    marginBottom: 18,
    gap: 8,
  },
  viaStopText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16.8,
    color: colors.gray07,
  },
});
