import React from "react";
import { StyleSheet, Text, View } from "react-native";

import SmallBusAsset from "../../assets/images/smallbus.svg";
import WalkAsset from "../../assets/images/man.svg";
import { colors } from "../theme";
import { normalizeTimelineSegments } from "../utils/routeSegments";

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
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={isTransit ? styles.textOn : styles.text}
              >
                {duration}분
              </Text>
            </View>
          </View>
        );
      })}
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
    letterSpacing: -0.12,
    textAlign: "center",
    color: colors.gray07,
  },
  textOn: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.2,
    letterSpacing: -0.12,
    textAlign: "center",
    color: colors.white,
  },
});
