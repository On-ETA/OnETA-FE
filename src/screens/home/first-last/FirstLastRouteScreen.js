import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import ArrowRightIcon from "../../../../assets/images/R.svg";
import ChangeIcon from "../../../../public/images/change.svg";
import CloseIcon from "../../../../public/images/close.svg";
import LoadIcon from "../../../../public/images/load.svg";
import SettingIcon from "../../../../public/images/setting.svg";
import { colors } from "../../../theme";

const PRE_DEPARTURE_ALARMS = [
  { key: "1", label: "1분 전" },
  { key: "3", label: "3분 전" },
  { key: "5", label: "5분 전" },
  { key: "10", label: "10분 전" },
  { key: "15", label: "15분 전" },
  { key: "30", label: "30분 전" },
  { key: "60", label: "1시간 전" },
];

// TODO: API 연동 시 아래 더미 데이터를 교체하세요.
// GET /home/first-last-route
// - routeType: "first" | "last"
// - remainingMinutes: number
// - departureTime: string
// - routeNumber: string
// - routeDirection: string
// - walkMinutes: number
// - busMinutes: number
// - afterWalkMinutes: number
// - boardingStopName: string
// - boardingTime: string
// - arrivalStopName: string
// - arrivalTime: string
// - preDepartureAlarmMinutes: number
const routeSummary = null;

// const routeSummary = {
//   remainingMinutes: 12,
//   departureTime: "23:42",
//   routeNumber: "147",
//   routeDirection: "강남역 방면",
//   walkMinutes: 5,
//   busMinutes: 4,
//   afterWalkMinutes: 8,
//   boardingStopName: "홍대정문",
//   boardingTime: "23:47",
//   arrivalStopName: "도착정류장",
//   arrivalTime: "23:51",
//   preDepartureAlarmMinutes: 10,
// };

export function FirstLastRouteScreen({ onRouteDetailPress }) {
  const [isLastRouteFirst, setIsLastRouteFirst] = useState(false);
  const [isAlarmModalVisible, setIsAlarmModalVisible] = useState(false);
  const [alarmSettings, setAlarmSettings] = useState({
    1: false,
    3: false,
    5: true,
    10: true,
    15: false,
    30: true,
    60: false,
  });
  const hasConfiguredRoute = Boolean(routeSummary);

  const closeAlarmModal = () => {
    setIsAlarmModalVisible(false);
  };

  const toggleAlarm = (alarmKey) => {
    setAlarmSettings((current) => ({
      ...current,
      [alarmKey]: !current[alarmKey],
    }));
  };

  return (
    <View style={styles.homeBody}>
      <View style={styles.routeCard}>
        <View style={styles.routeCardPanel}>
          <View style={styles.routeCardTop}>
            <View style={styles.routeTitleGroup}>
              <Text
                style={[
                  styles.routeTitle,
                  isLastRouteFirst && styles.routeTitleMuted,
                ]}
              >
                첫차
              </Text>
              <Pressable
                accessibilityLabel="첫차 막차 전환"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setIsLastRouteFirst((current) => !current)}
                style={styles.changeButton}
              >
                <ChangeIcon height={17} width={17} />
              </Pressable>
              <Text
                style={[
                  styles.routeTitleMuted,
                  isLastRouteFirst && styles.routeTitle,
                ]}
              >
                막차
              </Text>
            </View>
            <Pressable accessibilityRole="button" style={styles.resetButton}>
              <LoadIcon height={17} width={17} />
              <Text style={styles.resetText}>경로 재설정</Text>
            </Pressable>
          </View>

          <View style={styles.routeSectionDivider} />

          {hasConfiguredRoute ? (
            <>
              <View style={styles.summaryRow}>
                <View style={styles.summaryBlock}>
                  <Text style={styles.summaryLabel}>남은 시간</Text>
                  <View style={styles.remainingGroup}>
                    <Text style={styles.remainingNumber}>
                      {routeSummary.remainingMinutes}
                    </Text>
                    <Text style={styles.remainingUnit}>분</Text>
                  </View>
                </View>
                <View style={[styles.summaryBlock, styles.summaryBlockRight]}>
                  <Text style={styles.summaryLabel}>출발 적정 시간</Text>
                  <Text style={styles.departureTime}>
                    {routeSummary.departureTime}
                  </Text>
                </View>
              </View>

              <View style={styles.timeline}>
                <View style={[styles.timelineSegment, styles.walkSegment]}>
                  <View style={styles.walkDot}>
                    <WalkIcon />
                  </View>
                  <View style={styles.timelineLabelWrap}>
                    <Text style={styles.timelineLabel}>
                      {routeSummary.walkMinutes}분
                    </Text>
                  </View>
                </View>
                <View style={[styles.timelineSegment, styles.busSegment]}>
                  <View style={styles.busDot}>
                    <BusIcon />
                  </View>
                  <View style={styles.timelineLabelWrap}>
                    <Text style={styles.timelineLabelOn}>
                      {routeSummary.busMinutes}분
                    </Text>
                  </View>
                </View>
                <View style={[styles.timelineSegment, styles.afterWalkSegment]}>
                  <View style={styles.timelineLabelWrap}>
                    <Text style={styles.timelineLabel}>
                      {routeSummary.afterWalkMinutes}분
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.routeSectionDivider} />

              <View style={styles.busInfoRow}>
                <View style={styles.busBadge}>
                  <BusIcon size={13} />
                </View>
                <Text style={styles.busNumber}>{routeSummary.routeNumber}</Text>
                <Text style={styles.busDirection}>
                  · {routeSummary.routeDirection}
                </Text>
              </View>

              <View style={styles.stopRows}>
                <StopRow
                  active
                  label="승차"
                  name={routeSummary.boardingStopName}
                  time={routeSummary.boardingTime}
                />
                <StopRow
                  label="하차"
                  name={routeSummary.arrivalStopName}
                  time={routeSummary.arrivalTime}
                />
              </View>
            </>
          ) : (
            <View style={styles.emptyRouteState}>
              <Text style={styles.emptyRouteText}>
                버스 경로를 설정해보세요
              </Text>
            </View>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={hasConfiguredRoute ? onRouteDetailPress : undefined}
          style={styles.routeAction}
        >
          <Text style={styles.routeActionText}>
            {hasConfiguredRoute ? "경로 자세히 보기" : "경로 설정하기"}
          </Text>
          <ArrowRightIcon height={25} style={styles.routeActionIcon} width={25} />
        </Pressable>
      </View>

      <View style={styles.noticeBubble}>
        <Text style={styles.noticeText}>
          {hasConfiguredRoute
            ? `출발 ${routeSummary.preDepartureAlarmMinutes}분 전에 알려드릴게요!`
            : "출발 전 미리 알림을 설정할 수 있어요!"}
        </Text>
        <Pressable
          accessibilityLabel="출발 전 알림 설정"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setIsAlarmModalVisible(true)}
          style={styles.noticeSettingButton}
        >
          <SettingIcon height={21} width={21} />
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={closeAlarmModal}
        transparent
        visible={isAlarmModalVisible}
      >
        <View style={styles.alarmModalOverlay}>
          <View style={styles.alarmModalCard}>
            <View style={styles.alarmModalHeader}>
              <Text style={styles.alarmModalTitle}>미리 알림 설정</Text>
              <Pressable
                accessibilityLabel="미리 알림 설정 닫기"
                accessibilityRole="button"
                hitSlop={10}
                onPress={closeAlarmModal}
                style={styles.alarmModalCloseButton}
              >
                <CloseIcon height={24} width={24} />
              </Pressable>
            </View>

            <View style={styles.alarmList}>
              {PRE_DEPARTURE_ALARMS.map((alarm) => {
                const isEnabled = alarmSettings[alarm.key];

                return (
                  <View key={alarm.key} style={styles.alarmRow}>
                    <Text style={styles.alarmLabel}>{alarm.label}</Text>
                    <Pressable
                      accessibilityLabel={`${alarm.label} 알림 ${
                        isEnabled ? "끄기" : "켜기"
                      }`}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: isEnabled }}
                      onPress={() => toggleAlarm(alarm.key)}
                      style={[
                        styles.alarmSwitch,
                        isEnabled && styles.alarmSwitchOn,
                      ]}
                    >
                      <View
                        style={[
                          styles.alarmSwitchThumb,
                          isEnabled && styles.alarmSwitchThumbOn,
                        ]}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StopRow({ active = false, label, name, time }) {
  return (
    <View style={styles.stopRow}>
      <View style={[styles.stopOuter, active && styles.stopOuterActive]}>
        <View style={[styles.stopInner, active && styles.stopInnerActive]} />
      </View>
      <Text style={styles.stopLabel}>{label}</Text>
      <Text style={styles.stopName}>{name}</Text>
      <Text style={styles.stopTime}>{time}</Text>
    </View>
  );
}

function WalkIcon() {
  return (
    <Svg height={12} viewBox="0 0 12 12" width={12}>
      <Circle cx={6} cy={2.2} fill={colors.white} r={1.4} />
      <Path
        d="M5.4 4.1 3.7 6.1c-.2.2-.2.6.1.8.2.2.6.2.8-.1l.9-1.1.8 1.1-1.3 3c-.1.3 0 .7.3.8.3.1.7 0 .8-.3l1.1-2.5 1.2 1.5c.2.3.6.3.8.1.3-.2.3-.6.1-.8L7.8 6.7 7 4.8l.9.6c.3.2.6.1.8-.1.2-.3.1-.6-.1-.8L7 3.4c-.5-.3-1.1-.1-1.6.7Z"
        fill={colors.white}
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

const styles = StyleSheet.create({
  homeBody: {
    flex: 1,
    alignItems: "center",
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  routeCard: {
    width: 328,
    maxWidth: "100%",
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: colors.white,
    shadowColor: "#3D445E",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 13,
    elevation: 2,
  },
  routeCardPanel: {
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 26,
    gap: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.gray04,
    backgroundColor: colors.white,
  },
  routeCardTop: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routeTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  routeTitle: {
    fontFamily: "SUIT",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 25.2,
    color: colors.gray09,
  },
  routeTitleMuted: {
    fontFamily: "SUIT",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 25.2,
    color: colors.gray05,
  },
  changeButton: {
    width: 18,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  resetButton: {
    height: 32,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  resetText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19.6,
    color: colors.gray07,
  },
  routeSectionDivider: {
    height: 1,
    alignSelf: "stretch",
    backgroundColor: colors.gray03,
  },
  emptyRouteState: {
    minHeight: 75,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyRouteText: {
    fontFamily: "SUIT",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    color: colors.gray06,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryBlock: {
    gap: 8,
  },
  summaryBlockRight: {
    alignItems: "flex-end",
  },
  summaryLabel: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18.2,
    color: colors.gray06,
  },
  remainingGroup: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  remainingNumber: {
    fontFamily: "SUIT",
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 42,
    color: colors.black,
  },
  remainingUnit: {
    marginBottom: 4,
    fontFamily: "SUIT",
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 38,
    color: colors.black,
  },
  departureTime: {
    fontFamily: "SUIT",
    fontSize: 34,
    fontWeight: "400",
    lineHeight: 42,
    color: colors.gray08,
  },
  timeline: {
    height: 18,
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
  walkSegment: {
    flex: 1.1,
  },
  busSegment: {
    flex: 1.05,
    borderRadius: 10,
    backgroundColor: colors.main,
  },
  afterWalkSegment: {
    flex: 1.9,
  },
  walkDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray06,
    zIndex: 1,
  },
  busDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.main,
    zIndex: 1,
  },
  timelineLabelWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  dotIcon: {
    fontSize: 8,
    fontWeight: "700",
    lineHeight: 10,
    color: colors.white,
  },
  busDotIcon: {
    fontSize: 8,
    fontWeight: "700",
    lineHeight: 10,
    color: colors.white,
  },
  timelineLabel: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    color: colors.gray07,
  },
  timelineLabelOn: {
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    color: colors.white,
  },
  busInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  busBadge: {
    width: 20,
    height: 20,
    marginRight: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.main,
  },
  busNumber: {
    fontFamily: "SUIT",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 25.2,
    color: colors.gray09,
  },
  busDirection: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19.6,
    color: colors.gray06,
  },
  stopRows: {
    gap: 12,
  },
  stopRow: {
    height: 23,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gray06,
  },
  stopInnerActive: {
    backgroundColor: colors.main,
  },
  stopLabel: {
    width: 42,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19.6,
    color: colors.gray07,
  },
  stopName: {
    flex: 1,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray08,
  },
  stopTime: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 19.6,
    color: colors.gray06,
  },
  routeAction: {
    height: 54,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.main,
  },
  routeActionText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.white,
  },
  routeActionIcon: {
    color: colors.white,
  },
  noticeBubble: {
    width: 328,
    maxWidth: "100%",
    minHeight: 66,
    marginTop: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.gray02,
  },
  noticeText: {
    flex: 1,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray08,
  },
  noticeSettingButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  alarmModalOverlay: {
    flex: 1,
    paddingTop: 144,
    paddingHorizontal: 13,
    backgroundColor: "rgba(52, 56, 59, 0.28)",
  },
  alarmModalCard: {
    width: 328,
    alignSelf: "center",
    padding: 20,
    gap: 20,
    borderRadius: 16,
    backgroundColor: colors.white,
    shadowColor: "#B9C8D0",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 3,
  },
  alarmModalHeader: {
    minHeight: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  alarmModalTitle: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray07,
  },
  alarmModalCloseButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  alarmList: {
    gap: 21,
  },
  alarmRow: {
    minHeight: 35,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  alarmLabel: {
    fontFamily: "SUIT",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
    color: colors.gray08,
  },
  alarmSwitch: {
    width: 44,
    height: 26,
    padding: 3,
    alignItems: "flex-start",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: colors.gray05,
  },
  alarmSwitchOn: {
    alignItems: "flex-end",
    backgroundColor: colors.main,
  },
  alarmSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  alarmSwitchThumbOn: {
    backgroundColor: colors.white,
  },
});
