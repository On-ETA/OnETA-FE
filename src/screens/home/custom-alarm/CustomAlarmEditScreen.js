import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import BigBusAsset from "../../../../assets/images/bigbus.svg";
import DirectionCircleAsset from "../../../../assets/images/circle.svg";
import StopLineAsset from "../../../../assets/images/line.svg";

import {
  getArrivalNotifications,
  getArrivalNotificationById,
  updateArrivalNotification,
} from "../../../api/notifications/arrival";
import { getBusRouteDirections } from "../../../api/busRoutes";
import { updateDepotNotification } from "../../../api/notifications/depot";
import { Header } from "../../../components";
import { RouteTimeline } from "../../../components/RouteTimeline";
import { colors, typography } from "../../../theme";
import { normalizeTimelineSegments } from "../../../utils/routeSegments";

const days = ["월", "화", "수", "목", "금", "토", "일"];
const apiDayToKoreanDay = {
  MON: "월",
  TUE: "화",
  WED: "수",
  THU: "목",
  FRI: "금",
  SAT: "토",
  SUN: "일",
};
const koreanDayToApiDay = {
  월: "MON",
  화: "TUE",
  수: "WED",
  목: "THU",
  금: "FRI",
  토: "SAT",
  일: "SUN",
};

// TODO: API 연동 시 아래 화면의 더미 경로/알림 데이터를 교체하세요.
// GET /home/custom-alarms/{alarmId}
// PATCH /home/custom-alarms/{alarmId}

function getNotificationId(alarm) {
  const id = alarm?.notificationId ?? alarm?.id;

  return typeof id === "string" ? id.replace(/^arrival-/, "") : id;
}

function formatArrivalTime(time) {
  if (!time) {
    return "시간 정보 없음";
  }

  if (typeof time === "string") {
    const [hour = "00", minute = "00"] = time.split(":");

    return `${hour}:${minute}`;
  }

  return `${String(time.hour ?? 0).padStart(2, "0")}:${String(
    time.minute ?? 0,
  ).padStart(2, "0")}`;
}

function formatTargetArrivalTimeForApi(time) {
  if (!time) {
    return "";
  }

  if (typeof time === "string") {
    const [hour = "00", minute = "00", second = "00"] = time.split(":");

    return {
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second),
      nano: 0,
    };
  }

  return {
    hour: Number(time.hour ?? 0),
    minute: Number(time.minute ?? 0),
    second: Number(time.second ?? 0),
    nano: Number(time.nano ?? 0),
  };
}

function getPrimaryTransitSegment(route) {
  return route?.segments?.find((segment) => segment.transitType !== "WALK");
}

function parseRouteDetails(routeDetails) {
  if (!routeDetails) {
    return null;
  }

  if (typeof routeDetails !== "string") {
    return routeDetails;
  }

  try {
    return JSON.parse(routeDetails);
  } catch {
    return null;
  }
}

function getAlarmRoute(alarm) {
  const parsedRouteDetails =
    parseRouteDetails(alarm?.routeDetails) ??
    parseRouteDetails(alarm?.raw?.routeDetails);

  return (
    alarm?.route ??
    alarm?.raw?.route ??
    parsedRouteDetails?.route ??
    parsedRouteDetails
  );
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

function formatKoreanTime(time) {
  const formatted = formatArrivalTime(time);
  const [rawHour = "0", rawMinute = "00"] = formatted.split(":");
  let hour = Number(rawHour);

  if (!Number.isFinite(hour)) {
    return formatted;
  }

  const period = hour >= 12 ? "오후" : "오전";
  hour %= 12;

  if (hour === 0) {
    hour = 12;
  }

  return `${period} ${String(hour).padStart(2, "0")} : ${rawMinute}`;
}

function getFormattedStartTime(arrivalTime, durationMinutes) {
  const formatted = formatArrivalTime(arrivalTime);
  const [rawHour = "0", rawMinute = "0"] = formatted.split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return "시간 정보 없음";
  }

  let totalMinutes = hour * 60 + minute - Number(durationMinutes || 0);
  totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;

  const startHour24 = Math.floor(totalMinutes / 60);
  const startMinute = totalMinutes % 60;
  const period = startHour24 >= 12 ? "오후" : "오전";
  let startHour12 = startHour24 % 12;

  if (startHour12 === 0) {
    startHour12 = 12;
  }

  return `${period} ${String(startHour12).padStart(2, "0")} : ${String(
    startMinute,
  ).padStart(2, "0")}`;
}

function getRepeatDays(repeatDays) {
  return Array.isArray(repeatDays)
    ? repeatDays.map((day) => apiDayToKoreanDay[day]).filter(Boolean)
    : [];
}

function getRouteDetails(alarm) {
  const parsedRouteDetails =
    parseRouteDetails(alarm?.routeDetails) ??
    parseRouteDetails(alarm?.raw?.routeDetails);
  const route = alarm?.route ?? alarm?.raw?.route ?? parsedRouteDetails?.route;

  if (parsedRouteDetails?.route) {
    return JSON.stringify({
      route: parsedRouteDetails.route,
      origin: parsedRouteDetails.origin,
      destination: parsedRouteDetails.destination,
      originAddress: parsedRouteDetails.originAddress,
      destinationAddress: parsedRouteDetails.destinationAddress,
      originPlace: parsedRouteDetails.originPlace,
      destinationPlace: parsedRouteDetails.destinationPlace,
    });
  }

  if (route) {
    return JSON.stringify({ route });
  }

  return alarm?.routeDetails;
}

export function ScheduleAlarmEditScreen({
  alarm,
  onBackPress,
  onResetRoutePress,
  onSavePress,
}) {
  const [routeName, setRouteName] = useState(alarm?.routeName ?? "출근길");
  const [selectedDays, setSelectedDays] = useState(
    getRepeatDays(alarm?.repeatDays),
  );
  const [arrivalAlarm, setArrivalAlarm] = useState(alarm);
  const [isLoadingAlarm, setIsLoadingAlarm] = useState(false);
  const [isSavingAlarm, setIsSavingAlarm] = useState(false);
  const [alarmError, setAlarmError] = useState("");
  const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);
  const notificationId = getNotificationId(alarm);
  const route = getAlarmRoute(arrivalAlarm);
  const primarySegment = useMemo(() => getPrimaryTransitSegment(route), [route]);
  const timelineSegments = useMemo(
    () => normalizeTimelineSegments(route?.segments ?? []),
    [route],
  );
  const arrivalTime = formatArrivalTime(
    arrivalAlarm?.targetArrivalTime ?? arrivalAlarm?.arrivalTime,
  );
  const formattedArrivalTime = formatKoreanTime(
    arrivalAlarm?.targetArrivalTime ?? arrivalAlarm?.arrivalTime,
  );
  const reminderText = Array.isArray(arrivalAlarm?.reminderOffsetMinutes)
    ? `${arrivalAlarm.reminderOffsetMinutes.join(", ")}분 전 알림`
    : "10분 전 알림";
  const reminderOffsets = Array.isArray(arrivalAlarm?.reminderOffsetMinutes)
    ? arrivalAlarm.reminderOffsetMinutes
    : [];
  const reminderOffsetsText = reminderOffsets
    .map((offset) => `${offset}분 전`)
    .join(", ");
  const toggleReminderOffset = (offset) => {
    const current = reminderOffsets.map(Number);
    const next = current.includes(Number(offset))
      ? current.filter((value) => value !== Number(offset))
      : [...current, Number(offset)].sort((a, b) => a - b);

    setArrivalAlarm((currentAlarm) => ({
      ...currentAlarm,
      reminderOffsetMinutes: next,
    }));
  };
  const totalDuration =
    route?.realTimeDurationMinutes ?? route?.totalDurationMinutes ?? 0;
  const formattedStartTime = getFormattedStartTime(
    arrivalAlarm?.targetArrivalTime ?? arrivalAlarm?.arrivalTime,
    totalDuration,
  );
  const firstReminderStartTime = reminderOffsets.length
    ? getFormattedStartTime(
        arrivalAlarm?.targetArrivalTime ?? arrivalAlarm?.arrivalTime,
        totalDuration + Number(reminderOffsets[0]),
      )
    : formattedStartTime;

  useEffect(() => {
    if (!notificationId) {
      return undefined;
    }

    let isActive = true;
    const controller = new AbortController();

    async function loadArrivalAlarm() {
      setIsLoadingAlarm(true);
      setAlarmError("");

      try {
        const nextAlarm = await getArrivalNotificationById({
          id: notificationId,
          signal: controller.signal,
        });

        if (isActive) {
          setArrivalAlarm(nextAlarm);
          setRouteName(nextAlarm.routeName ?? "");
          setSelectedDays(getRepeatDays(nextAlarm.repeatDays));
        }
      } catch (error) {
        if (isActive) {
          try {
            const notifications = await getArrivalNotifications({
              forceRefresh: true,
              signal: controller.signal,
            });
            const fallbackAlarm = notifications.find(
              (notification) =>
                String(notification?.notificationId ?? notification?.id).replace(
                  /^arrival-/,
                  "",
                ) === String(notificationId),
            );

            if (fallbackAlarm) {
              setArrivalAlarm(fallbackAlarm);
              setRouteName(fallbackAlarm.routeName ?? "");
              setSelectedDays(getRepeatDays(fallbackAlarm.repeatDays));
              setAlarmError("");
              return;
            }
          } catch {
            // Keep the original detail request error when the list fallback also fails.
          }

          setAlarmError(error?.message ?? "도착 알림을 불러오지 못했습니다.");
        }
      } finally {
        if (isActive) {
          setIsLoadingAlarm(false);
        }
      }
    }

    loadArrivalAlarm();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [notificationId]);

  const toggleDay = (day) => {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((selectedDay) => selectedDay !== day)
        : [...current, day],
    );
  };

  const handleSave = async () => {
    if (isSavingAlarm) {
      return;
    }

    if (!notificationId) {
      Alert.alert("알림 수정 실패", "수정할 알림 id를 찾지 못했습니다.");
      return;
    }

    const reminderOffsetMinutes = arrivalAlarm?.reminderOffsetMinutes ?? [];

    if (
      !Array.isArray(reminderOffsetMinutes) ||
      reminderOffsetMinutes.length === 0
    ) {
      Alert.alert("알림 수정 실패", "출발 전 알림 시간이 필요합니다.");
      return;
    }

    const payload = {
      routeName: routeName.trim() || undefined,
      targetArrivalTime: formatTargetArrivalTimeForApi(
        arrivalAlarm?.targetArrivalTime ?? arrivalAlarm?.arrivalTime,
      ),
      reminderOffsetMinutes,
      repeatDays: selectedDays
        .map((day) => koreanDayToApiDay[day])
        .filter(Boolean),
      routeDetails: getRouteDetails(arrivalAlarm),
      scheduleType: arrivalAlarm?.scheduleType,
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined || payload[key] === "") {
        delete payload[key];
      }
    });

    setIsSavingAlarm(true);

    try {
      await updateArrivalNotification({
        id: notificationId,
        payload,
      });

      onSavePress?.();
    } catch (error) {
      Alert.alert(
        "알림 수정 실패",
        error?.message ?? "도착 알림 수정에 실패했습니다.",
      );
    } finally {
      setIsSavingAlarm(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        headerStyle={styles.header}
        onBackPress={onBackPress}
        title="알림 편집"
        titleStyle={styles.headerTitle}
        type="back"
      />
      {isLoadingAlarm ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>알림 정보를 불러오는 중입니다.</Text>
        </View>
      ) : alarmError ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{alarmError}</Text>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.editScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.editScroll}
      >
        <View style={styles.routeHeader}>
          <View style={styles.routeTopRow}>
            <View style={styles.totalTime}>
              <Text style={styles.totalTimeNumber}>{totalDuration}</Text>
              <Text style={styles.totalTimeUnit}>분</Text>
            </View>
          </View>

          {timelineSegments.length > 0 ? (
            <RouteTimeline segments={timelineSegments} style={styles.routeTimeline} />
          ) : null}
        </View>

        <View style={styles.timeSection}>
          <View style={styles.timeSummaryRow}>
            <View style={styles.timeSummaryBlock}>
              <Text style={styles.fieldLabel}>출발 적정 시간</Text>
              <View style={styles.timeCard}>
                <Text style={styles.timeCardText}>{formattedStartTime}</Text>
              </View>
            </View>
            <ChevronRightIcon />
            <View style={styles.timeSummaryBlock}>
              <Text style={styles.fieldLabel}>도착 예정 시간</Text>
              <View style={styles.timeCard}>
                <Text style={styles.timeCardText}>{formattedArrivalTime}</Text>
              </View>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              onResetRoutePress?.({
                notificationId,
                routeName,
                reminderOffsetMinutes: arrivalAlarm?.reminderOffsetMinutes,
                repeatDays: selectedDays.map((day) => koreanDayToApiDay[day]).filter(Boolean),
                scheduleType: arrivalAlarm?.scheduleType ?? "NORMAL",
                arrivalTime:
                  arrivalAlarm?.targetArrivalTime ??
                  arrivalAlarm?.arrivalTime,
                routeDetails:
                  parseRouteDetails(getRouteDetails(arrivalAlarm)) ??
                  getAlarmRoute(arrivalAlarm),
              })
            }
            style={styles.resetButton}
          >
            <Text style={styles.resetButtonText}>경로 및 시간 재설정</Text>
          </Pressable>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>경로 이름</Text>
          <TextInput
            onChangeText={setRouteName}
            placeholder="경로 이름"
            placeholderTextColor={colors.gray06}
            style={styles.nameInput}
            value={routeName}
          />

          <Text style={styles.questionText}>출발 시간 몇 분 전에 알려드릴까요?</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsReminderModalVisible(true)}
            style={styles.reminderSelect}
          >
            <Text style={styles.reminderText}>{reminderText}</Text>
            <ChevronDownIcon />
          </Pressable>

          <Text style={styles.repeatQuestionText}>요일마다 반복할까요?</Text>
          <View style={styles.dayRow}>
            {days.map((day) => {
              const selected = selectedDays.includes(day);

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={day}
                  onPress={() => toggleDay(day)}
                  style={[styles.dayButton, selected && styles.dayButtonSelected]}
                >
                  <Text
                    style={[
                      styles.dayButtonText,
                      selected && styles.dayButtonTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{`${formattedArrivalTime}까지 도착할 수 있도록`}</Text>
            <Text style={styles.infoText}>
              {reminderOffsetsText
                ? `실시간 교통정보를 반영해 출발 적정 시간을 확인하고, ${reminderOffsetsText}에 알려드릴게요.`
                : "알림 시간을 선택하면 출발 전 알림을 알려드릴게요."}
            </Text>
          </View>
          <View style={styles.footerButtons}>
            <Pressable accessibilityRole="button" onPress={onBackPress} style={styles.cancelButton}>
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSavingAlarm}
              onPress={handleSave}
              style={[
                styles.saveButton,
                isSavingAlarm && styles.saveButtonDisabled,
              ]}
            >
              <Text style={styles.saveText}>
                {isSavingAlarm ? "저장 중" : "저장"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <ReminderModal
        onClose={() => setIsReminderModalVisible(false)}
        onToggle={toggleReminderOffset}
        reminders={reminderOffsets}
        visible={isReminderModalVisible}
      />
    </View>
  );
}

export function GarageDepartureAlarmEditScreen({
  alarm,
  onBackPress,
  onChangeBusPress,
  onSavePress,
}) {
  const initialDirectionId = alarm?.directionType ?? alarm?.raw?.direction ?? "";
  const [selectedDirectionId, setSelectedDirectionId] = useState(
    initialDirectionId,
  );
  const [directions, setDirections] = useState(alarm?.directions ?? []);
  const [busRouteInfo, setBusRouteInfo] = useState(null);
  const [isLoadingDirections, setIsLoadingDirections] = useState(false);
  const [isSavingAlarm, setIsSavingAlarm] = useState(false);

  useEffect(() => {
    const routeId = alarm?.routeId ?? alarm?.raw?.routeId;

    if (!routeId) {
      return undefined;
    }

    const controller = new AbortController();
    let isActive = true;

    async function loadDirections() {
      setIsLoadingDirections(true);

      try {
        const routeInfo = await getBusRouteDirections({
          routeId,
          signal: controller.signal,
        });

        if (!isActive) {
          return;
        }

        setBusRouteInfo(routeInfo);
        setDirections(routeInfo.directions ?? []);
        setSelectedDirectionId((current) => current || routeInfo.directions?.[0]?.id || "");
      } catch (error) {
        if (isActive && error?.name !== "AbortError") {
          Alert.alert(
            "방면 정보 조회 실패",
            error?.message ?? "버스 방면 정보를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingDirections(false);
        }
      }
    }

    loadDirections();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [alarm?.raw?.routeId, alarm?.routeId]);

  const selectedDirection = directions.find(
    (direction) => direction.id === selectedDirectionId,
  );

  const handleSave = async () => {
    const userBusId = alarm?.userBusId ?? alarm?.id;
    const direction = selectedDirection?.type ?? selectedDirection?.direction ?? selectedDirection?.id;
    const directionName =
      direction === "DEPOT"
        ? busRouteInfo?.depotName
        : direction === "TURNAROUND"
          ? busRouteInfo?.turnaroundName
          : selectedDirection?.directionName ??
            selectedDirection?.name ??
            String(selectedDirection?.title ?? "").replace(/\s*방면$/, "").trim();

    if (!userBusId || !direction || !directionName) {
      Alert.alert(
        "알림 수정 실패",
        "차고지 알림 수정에 필요한 정보를 찾지 못했습니다.",
      );
      return;
    }

    if (isSavingAlarm) {
      return;
    }

    setIsSavingAlarm(true);

    try {
      await updateDepotNotification({
        userBusId,
        payload: {
          direction,
          directionName,
        },
      });

      onSavePress?.();
    } catch (error) {
      Alert.alert(
        "알림 수정 실패",
        error?.message ?? "차고지 출발 알림 수정에 실패했습니다.",
      );
    } finally {
      setIsSavingAlarm(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        headerStyle={styles.header}
        onBackPress={onBackPress}
        title="알림 편집"
        titleStyle={styles.headerTitle}
        type="back"
      />

      <View style={styles.garageContent}>
        <View style={styles.garageBusHeader}>
          <View style={styles.garageBusTitleRow}>
            <BusIcon />
            <View>
              <Text style={styles.garageBusName}>
                {alarm?.routeName ?? alarm?.routeNumber ?? "버스 정보 없음"}
              </Text>
              <Text style={styles.garageBusDescription}>
                {busRouteInfo?.route || alarm?.raw?.route || "방면을 선택해 주세요"}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onChangeBusPress}
            style={styles.changeButton}
          >
            <Text style={styles.changeButtonText}>변경</Text>
          </Pressable>
        </View>

        <View style={styles.directionList}>
          {isLoadingDirections && directions.length === 0 ? (
            <Text style={styles.directionDescription}>방면 정보를 불러오는 중입니다.</Text>
          ) : null}
          {directions.map((direction) => {
            const selected = selectedDirectionId === direction.id;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={direction.id}
                onPress={() => setSelectedDirectionId(direction.id)}
                style={[styles.directionCard, selected && styles.directionCardSelected]}
              >
                <Text style={styles.directionTitle}>{direction.title}</Text>
                <Text style={styles.directionDescription}>{direction.description}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.garageFooter}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>버스가 차고지에서 출발할 때 알려드릴게요.</Text>
          <Text style={styles.infoText}>
            알림은 1회 발송 후 자동으로 꺼지니 필요할 때 다시 켜주세요.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={isSavingAlarm || isLoadingDirections}
          onPress={handleSave}
          style={[
            styles.fullSaveButton,
            (isSavingAlarm || isLoadingDirections) && styles.saveButtonDisabled,
          ]}
        >
          <Text style={styles.saveText}>{isSavingAlarm ? "저장 중" : "저장"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CloseIcon() {
  return (
    <Svg height={20} viewBox="0 0 20 20" width={20}>
      <Path
        d="m5.5 5.5 9 9M14.5 5.5l-9 9"
        fill="none"
        stroke={colors.gray05}
        strokeLinecap="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function ReminderModal({ onClose, onToggle, reminders, visible }) {
  const options = [[1, "1분 전"], [3, "3분 전"], [5, "5분 전"], [10, "10분 전"], [15, "15분 전"], [30, "30분 전"], [60, "1시간 전"]];

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.reminderOverlay}>
        <View style={styles.reminderCard}>
          <View style={styles.reminderHeader}>
            <Text style={styles.reminderTitle}>미리 알림 설정</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.reminderCloseButton}>
              <CloseIcon />
            </Pressable>
          </View>
          {options.map(([value, label]) => {
            const selected = reminders.map(Number).includes(value);
            return (
              <Pressable key={value} onPress={() => onToggle(value)} style={styles.reminderRow}>
                <Text style={styles.reminderOptionText}>{label}</Text>
                <View style={[styles.reminderSwitch, selected && styles.reminderSwitchOn]}>
                  <View style={styles.reminderSwitchThumb} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

function BusIcon() {
  return (
    <View style={styles.busIconCircle}>
      <Svg height={14} viewBox="0 0 16 16" width={14}>
        <Path
          d="M4.2 1.5h7.6c1.1 0 2 .9 2 2v7.4c0 .9-.6 1.7-1.4 1.9v1.1c0 .3-.3.6-.6.6h-.7c-.3 0-.6-.3-.6-.6v-1H5.5v1c0 .3-.3.6-.6.6h-.7c-.3 0-.6-.3-.6-.6v-1.1c-.8-.3-1.4-1-1.4-1.9V3.5c0-1.1.9-2 2-2Zm.4 2.2v3.7h6.8V3.7H4.6Zm1 7.4a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm4.8-1.1a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 0 0-2.2 0Z"
          fill={colors.white}
        />
      </Svg>
    </View>
  );
}

function StopRow({
  active = false,
  label,
  name,
  style,
}) {
  return (
    <View style={[styles.stopRow, style]}>
      <View style={[styles.stopOuter, active && styles.stopOuterActive]}>
        <View style={[styles.stopInner, active && styles.stopInnerActive]}>
          <View style={styles.stopCenter} />
        </View>
      </View>
      <Text style={styles.stopLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.stopName}>{name}</Text>
    </View>
  );
}

function ChevronRightIcon() {
  return (
    <Svg height={24} viewBox="0 0 24 24" width={24}>
      <Path
        d="m9 6 6 6-6 6"
        fill="none"
        stroke={colors.gray05}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function ChevronDownIcon() {
  return (
    <Svg height={20} viewBox="0 0 20 20" width={20}>
      <Path
        d="M5.5 7.5 10 12l4.5-4.5"
        fill="none"
        stroke={colors.gray06}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.gray01,
  },
  header: {
    borderBottomColor: colors.gray04,
  },
  headerTitle: {
    ...typography.head01Sb,
    color: colors.black,
  },
  editScroll: {
    flex: 1,
  },
  editScrollContent: {
    flexGrow: 1,
    backgroundColor: colors.white,
  },
  routeHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: colors.gray02,
  },
  routeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBox: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.gray02,
  },
  statusText: {
    ...typography.caption01M,
    color: colors.gray07,
  },
  busInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  routeClockGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  routeClockText: {
    fontFamily: "SUIT",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
    color: colors.gray09,
  },
  busIconCircle: {
    width: 22,
    height: 22,
    marginRight: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.bus,
  },
  busNumber: {
    fontFamily: "SUIT",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 25.2,
    color: colors.gray09,
  },
  busDirection: {
    flex: 1,
    fontFamily: "SUIT",
    fontSize: 13,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 18.2,
    letterSpacing: -0.13,
    color: colors.gray06,
  },
  busDirectionRow: {
    marginLeft: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 0,
    flexShrink: 1,
  },
  totalTime: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  totalTimeNumber: {
    fontFamily: "SUIT",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
    color: colors.gray09,
  },
  totalTimeUnit: {
    marginBottom: 2,
    marginLeft: 3,
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray09,
  },
  timeSection: {
    display: "flex",
    padding: 16,
    flexDirection: "column",
    alignItems: "flex-start",
    alignSelf: "stretch",
    gap: 12,
    backgroundColor: colors.gray02,
  },
  timeSummaryRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  timeSummaryBlock: {
    flex: 1,
  },
  fieldLabel: {
    marginBottom: 8,
    fontFamily: "SUIT",
    fontSize: 14,
    fontStyle: "normal",
    fontWeight: "500",
    lineHeight: 19.6,
    letterSpacing: -0.14,
    color: colors.gray07,
  },
  timeCard: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  timeCardText: {
    fontFamily: "SUIT",
    fontSize: 18,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 18,
    letterSpacing: -0.18,
    textAlign: "right",
    color: colors.gray07,
  },
  resetButton: {
    height: 46,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  stopRows: {
    marginTop: 16,
    position: "relative",
  },
  stopLine: {
    position: "absolute",
    left: 11,
    top: 7,
    zIndex: 0,
  },
  stopRow: {
    height: 18,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },
  dropoffRow: {
    marginTop: 8,
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
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray06,
  },
  stopInnerActive: {
    backgroundColor: colors.main,
  },
  stopCenter: {
    display: "flex",
    width: 6,
    height: 6,
    flexDirection: "column",
    alignItems: "flex-start",
    flexShrink: 0,
    borderRadius: 100,
    backgroundColor: colors.white,
  },
  stopLabel: {
    width: 32,
    fontFamily: "SUIT",
    fontSize: 14,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 19.6,
    letterSpacing: -0.14,
    color: colors.gray07,
  },
  stopName: {
    flex: 1,
    minWidth: 0,
    fontFamily: "SUIT",
    fontSize: 14,
    fontStyle: "normal",
    fontWeight: "600",
    lineHeight: 19.6,
    letterSpacing: -0.14,
    color: colors.gray08,
  },
  routeTimeline: {
    height: 16,
    marginTop: 12,
  },
  resetButtonText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray08,
  },
  formSection: {
    paddingTop: 28,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
  },
  sectionLabel: {
    marginBottom: 12,
    fontFamily: "SUIT",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    color: colors.gray09,
  },
  questionText: {
    marginBottom: 12,
    fontFamily: "SUIT",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    color: colors.gray09,
  },
  repeatQuestionText: {
    marginTop: 28,
    marginBottom: 12,
    fontFamily: "SUIT",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    color: colors.gray09,
  },
  nameInput: {
    height: 54,
    marginBottom: 28,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    color: colors.gray09,
  },
  reminderSelect: {
    height: 54,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  reminderText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray08,
  },
  dayRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  dayButton: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray04,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  dayButtonSelected: {
    borderColor: colors.main,
    backgroundColor: colors.main,
  },
  dayButtonText: {
    fontFamily: "SUIT",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19.6,
    color: colors.gray07,
  },
  dayButtonTextSelected: {
    color: colors.white,
  },
  footer: {
    marginTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 28,
    backgroundColor: colors.white,
  },
  infoBox: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: colors.gray02,
  },
  infoText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    color: colors.gray07,
  },
  footerButtons: {
    marginTop: 14,
    flexDirection: "row",
    gap: 14,
  },
  cancelButton: {
    flex: 1,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray05,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  cancelText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22.4,
    color: colors.gray08,
  },
  saveButton: {
    flex: 1,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.main,
  },
  saveButtonDisabled: {
    backgroundColor: colors.gray05,
  },
  saveText: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22.4,
    color: colors.white,
  },
  garageContent: {
    flex: 1,
    paddingTop: 28,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
  },
  garageBusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  garageBusTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  garageBusName: {
    fontFamily: "SUIT",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 25.2,
    color: colors.gray09,
  },
  garageBusDescription: {
    marginTop: 2,
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16.8,
    color: colors.gray07,
  },
  changeButton: {
    height: 34,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gray05,
    borderRadius: 17,
    backgroundColor: colors.white,
  },
  changeButtonText: {
    fontFamily: "SUIT",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16.8,
    color: colors.gray08,
  },
  directionList: {
    marginTop: 24,
    gap: 12,
  },
  directionCard: {
    minHeight: 86,
    paddingVertical: 20,
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
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23.8,
    color: colors.gray08,
  },
  directionDescription: {
    marginTop: 8,
    fontFamily: "SUIT",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18.2,
    color: colors.gray06,
  },
  garageFooter: {
    paddingHorizontal: 20,
    paddingBottom: 56,
    backgroundColor: colors.white,
  },
  fullSaveButton: {
    height: 54,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.main,
  },
  reminderOverlay: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    backgroundColor: "rgba(52, 56, 59, 0.32)",
  },
  reminderCard: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 26,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  reminderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reminderTitle: {
    fontFamily: "SUIT",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22.4,
    color: colors.gray07,
  },
  reminderCloseButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderRow: {
    minHeight: 35,
    marginTop: 21,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reminderOptionText: {
    fontFamily: "SUIT",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
    color: colors.gray08,
  },
  reminderSwitch: {
    width: 44,
    height: 26,
    padding: 3,
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: colors.gray05,
  },
  reminderSwitchOn: { alignItems: "flex-end", backgroundColor: colors.main },
  reminderSwitchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
});
