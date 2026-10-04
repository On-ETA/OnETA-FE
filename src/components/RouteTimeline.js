import React from "react";
import { StyleSheet, Text, View } from "react-native";

import SmallBusAsset from "../../assets/images/smallbus.svg";
import BusGreenAsset from "../../assets/images/bus_g.svg";
import WalkAsset from "../../assets/images/man.svg";
import { colors } from "../theme";
import { normalizeTimelineSegments } from "../utils/routeSegments";

function formatBusNumberLabel(busNumber) {
  const text = String(busNumber ?? "").trim();

  if (!text) {
    return "버스";
  }

  return text.endsWith("번") || text.endsWith("호선") ? text : `${text}번`;
}

export function RouteTimeline({ segments: routeSegments = [], style }) {
  const segments = normalizeTimelineSegments(routeSegments);

  if (segments.length === 0) {
    return null;
  }

  const totalDuration = segments.reduce(
    (sum, segment) => sum + Math.max(segment.durationMinutes ?? 0, 1),
    0,
  );

  return (
    <View>
      <View style={[styles.timeline, style]}>
      {segments.map((segment, index) => {
        const isTransit = segment.transitType !== "WALK";
        const duration = Math.max(segment.durationMinutes ?? 0, 0);

        return (
          <View
            key={segment.id ?? `${segment.transitType}-${index}`}
            style={[
              styles.segment,
              isTransit ? styles.busSegment : styles.walkSegment,
              {
                flexGrow: 1 + Math.sqrt(Math.max(duration, 1) / totalDuration),
                flexBasis: 0,
                flexShrink: 1,
              },
            ]}
          >
            {isTransit || index === 0 ? (
              <View style={isTransit ? styles.busIcon : styles.walkIcon}>
                {isTransit ? (
                  <SmallBusAsset width={7} height={8} />
                ) : (
                  <WalkAsset width={6} height={10} />
                )}
              </View>
            ) : null}

            <View style={styles.textWrap}>
              <Text
                numberOfLines={1}
                style={isTransit ? styles.textOn : styles.text}
              >
                {duration}분
              </Text>
            </View>
          </View>
        );
      })}
      </View>
      <View style={styles.stopDetails}>
        {segments
          .filter((segment) => segment.transitType !== "WALK")
          .map((segment, transitIndex, transitSegments) => {
            const stations = Array.isArray(segment.stations) ? segment.stations : [];
            const boardingStop = segment.startStation || segment.boardingStopName || stations[0]?.name || "승차 정류장";
            const arrivalStop = segment.endStation || segment.arrivalStopName || stations[stations.length - 1]?.name || "하차 정류장";
            const busNumber = formatBusNumberLabel(
              segment.transitName ||
                segment.routeNumber ||
                segment.busNumber ||
                segment.raw?.transitName,
            );
            const isFirst = transitIndex === 0;
            const isLast = transitIndex === transitSegments.length - 1;
            const rows = [
              { label: isFirst ? "승차" : "환승", name: boardingStop, active: true },
              ...(isLast ? [{ label: "하차", name: arrivalStop, active: false }] : []),
            ];

            return rows.map((row, rowIndex) => (
              <View key={`${segment.id}-${row.label}-${rowIndex}`} style={styles.stopRow}>
                <View style={[styles.stopOuter, row.active ? styles.stopOuterActive : null]}>
                  <View style={[styles.stopInner, row.active ? styles.stopInnerActive : null]}>
                    <View style={styles.stopCenter} />
                  </View>
                </View>
                <Text style={styles.stopLabel}>{row.label}</Text>
                <Text numberOfLines={1} style={styles.stopName}>{row.name}</Text>
                {row.active ? (
                  <View style={styles.busBadge}>
                    <BusGreenAsset width={13} height={13} />
                    <Text style={styles.busNumber}>{busNumber}</Text>
                  </View>
                ) : null}
              </View>
            ));
          })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: {
    height: 16,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: colors.gray04,
  },
  stopDetails: {
    marginTop: 10,
    gap: 7,
  },
  stopRow: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
  },
  stopOuter: {
    width: 23,
    height: 23,
    marginRight: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.gray04,
  },
  stopOuterActive: {
    backgroundColor: colors.sub,
  },
  stopInner: {
    width: 16,
    height: 16,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray06,
  },
  stopInnerActive: {
    backgroundColor: colors.main,
  },
  stopCenter: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  stopLabel: {
    width: 42,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray07,
  },
  stopName: {
    flexShrink: 1,
    marginLeft: 3,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray08,
  },
  busBadge: {
    minHeight: 24,
    marginLeft: 8,
    paddingRight: 6,
    paddingLeft: 4,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.main,
    backgroundColor: colors.white,
  },
  busNumber: {
    marginLeft: 3,
    fontFamily: "SUIT",
    fontSize: 13,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 18.2,
    letterSpacing: -0.13,
    color: colors.main,
  },
  segment: {
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  walkSegment: {
    flex: 1.1,
  },
  busSegment: {
    flex: 1.05,
    borderRadius: 10,
    backgroundColor: colors.bus,
  },
  walkIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.gray06,
  },
  busIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.bus,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.2,
    letterSpacing: 0,
    textAlign: "center",
    color: colors.gray07,
  },
  textOn: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.2,
    letterSpacing: 0,
    textAlign: "center",
    color: colors.white,
  },
});
